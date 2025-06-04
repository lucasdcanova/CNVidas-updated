import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Clock, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, parseISO, startOfWeek, addDays, isSameDay, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

// Tipos para slots de disponibilidade
interface AvailabilitySlot {
  id?: number;
  doctorId: number;
  dayOfWeek: number; // 0-6 (domingo-sábado)
  startTime: string; // formato HH:MM
  endTime: string; // formato HH:MM
  isAvailable: boolean;
}

// Componente TimeSlot para selecionar horários disponíveis
const TimeSlot = ({ dayIndex, hour, minute, selected, onChange }: {
  dayIndex: number; 
  hour: number; 
  minute: number; 
  selected: boolean; 
  onChange: (day: number, hour: number, minute: number, selected: boolean) => void;
}) => {
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  return (
    <div 
      className={`p-2 text-xs border rounded-md cursor-pointer m-1 ${
        selected ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'
      }`}
      onClick={() => onChange(dayIndex, hour, minute, !selected)}
    >
      {timeString}
    </div>
  );
};

// Componente para o dia da semana
const DayColumn = ({ 
  dayIndex, 
  dayName, 
  slots, 
  onSlotChange 
}: { 
  dayIndex: number; 
  dayName: string; 
  slots: {hour: number; minute: number; selected: boolean}[]; 
  onSlotChange: (day: number, hour: number, minute: number, selected: boolean) => void;
}) => {
  return (
    <div className="flex flex-col items-center">
      <h3 className="font-medium text-sm mb-2">{dayName}</h3>
      <div className="flex flex-col items-center">
        {slots.map((slot, idx) => (
          <TimeSlot 
            key={idx}
            dayIndex={dayIndex}
            hour={slot.hour}
            minute={slot.minute}
            selected={slot.selected}
            onChange={onSlotChange}
          />
        ))}
      </div>
    </div>
  );
};

export default function DoctorAvailabilityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("weekly");
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{[key: number]: {hour: number; minute: number; selected: boolean}[]}>(
    // Inicializa com horários padrão para cada dia da semana (8h às 18h, a cada 30 min)
    Array(7).fill(0).reduce((acc, _, dayIndex) => {
      acc[dayIndex] = [];
      for (let hour = 8; hour < 18; hour++) {
        for (let minute of [0, 30]) {
          acc[dayIndex].push({ hour, minute, selected: false });
        }
      }
      return acc;
    }, {} as {[key: number]: {hour: number; minute: number; selected: boolean}[]})
  );

  // Buscar o perfil do médico
  const { data: doctorProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ["/api/doctors/profile"],
    queryFn: ({ signal }) => 
      fetch("/api/doctors/profile", { 
        signal,
        credentials: "include"
      })
      .then(res => {
        if (!res.ok) throw new Error("Falha ao buscar perfil do médico");
        return res.json();
      }),
  });

  // Buscar os slots de disponibilidade do médico
  const { data: availabilityData, isLoading: loadingAvailability } = useQuery({
    queryKey: ["/api/doctors/availability-slots"],
    queryFn: ({ signal }) => 
      fetch("/api/doctors/availability-slots", { 
        signal,
        credentials: "include"
      })
      .then(res => {
        if (!res.ok) throw new Error("Falha ao buscar slots de disponibilidade");
        return res.json();
      }),
    enabled: !!doctorProfile,
  });

  // Mutation para salvar os slots de disponibilidade
  const saveAvailabilityMutation = useMutation({
    mutationFn: async (slots: AvailabilitySlot[]) => {
      const res = await apiRequest("POST", "/api/doctors/availability-slots", { slots });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Disponibilidade salva",
        description: "Seus horários de disponibilidade foram atualizados com sucesso.",
      });
      // Recarregar dados
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/availability-slots"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar disponibilidade",
        description: error.message || "Ocorreu um erro ao salvar seus horários. Tente novamente.",
        variant: "destructive"
      });
    }
  });

  // Mutation para toggle de disponibilidade para emergências
  const toggleEmergencyMutation = useMutation({
    mutationFn: async (available: boolean) => {
      const res = await apiRequest("POST", "/api/doctors/toggle-availability", { available });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.availableForEmergency ? "Disponível para emergências" : "Indisponível para emergências",
        description: data.availableForEmergency 
          ? "Você começará a receber consultas de emergência." 
          : "Você não receberá mais consultas de emergência.",
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar disponibilidade",
        description: error.message || "Ocorreu um erro ao atualizar sua disponibilidade para emergências.",
        variant: "destructive"
      });
    }
  });

  // Preencher os slots com os dados existentes quando disponíveis
  useEffect(() => {
    if (availabilityData?.slots) {
      // Atualizar o estado com os slots existentes
      setAvailabilitySlots(availabilityData.slots);
      
      // Atualizar a interface visual
      const newTimeSlots = {...timeSlots};
      
      availabilityData.slots.forEach((slot: AvailabilitySlot) => {
        const [hour, minute] = slot.startTime.split(':').map(Number);
        
        const slotIndex = newTimeSlots[slot.dayOfWeek].findIndex(
          s => s.hour === hour && s.minute === minute
        );
        
        if (slotIndex !== -1) {
          newTimeSlots[slot.dayOfWeek][slotIndex].selected = slot.isAvailable;
        }
      });
      
      setTimeSlots(newTimeSlots);
    }
  }, [availabilityData]);

  // Função para lidar com a alteração de um slot de horário
  const handleSlotChange = (day: number, hour: number, minute: number, selected: boolean) => {
    // Atualizar a interface visual
    const newTimeSlots = {...timeSlots};
    const slotIndex = newTimeSlots[day].findIndex(
      s => s.hour === hour && s.minute === minute
    );
    
    if (slotIndex !== -1) {
      newTimeSlots[day][slotIndex].selected = selected;
      setTimeSlots(newTimeSlots);
    }
  };

  // Função para salvar as alterações de disponibilidade
  const handleSaveAvailability = () => {
    setIsLoading(true);
    
    // Converter timeSlots para o formato do backend
    const slots: AvailabilitySlot[] = [];
    
    Object.keys(timeSlots).forEach(dayKey => {
      const day = parseInt(dayKey);
      timeSlots[day].forEach(slot => {
        // Para cada slot selecionado, cria um período de 30 minutos
        if (slot.selected) {
          const startHour = slot.hour.toString().padStart(2, '0');
          const startMinute = slot.minute.toString().padStart(2, '0');
          
          // Calcular a hora de término (30 minutos depois)
          let endHour = slot.hour;
          let endMinute = slot.minute + 30;
          
          if (endMinute >= 60) {
            endHour += 1;
            endMinute -= 60;
          }
          
          const endHourStr = endHour.toString().padStart(2, '0');
          const endMinuteStr = endMinute.toString().padStart(2, '0');
          
          slots.push({
            doctorId: doctorProfile.id,
            dayOfWeek: day,
            startTime: `${startHour}:${startMinute}`,
            endTime: `${endHourStr}:${endMinuteStr}`,
            isAvailable: true
          });
        }
      });
    });
    
    saveAvailabilityMutation.mutate(slots);
    setIsLoading(false);
  };

  // Função para lidar com toggle de disponibilidade para emergências
  const handleEmergencyToggle = (checked: boolean) => {
    // Verificar se o médico tem preço de consulta definido
    if (!doctorProfile?.consultationFee) {
      toast({
        title: "Preço da consulta não definido",
        description: "Você precisa definir o preço da consulta no seu perfil antes de ficar disponível para atendimentos.",
        variant: "destructive"
      });
      return;
    }
    
    toggleEmergencyMutation.mutate(checked);
  };

  // Nomes dos dias da semana em português
  const weekDays = [
    "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
  ];

  if (loadingProfile || loadingAvailability) {
    return (
      <DashboardLayout title="Gerenciamento de Disponibilidade">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Carregando informações...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gerenciamento de Disponibilidade">
      <div className="space-y-6">
        {/* Card de disponibilidade para emergências */}
        <Card className="bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Disponibilidade para Emergências</CardTitle>
            <CardDescription>
              Configure sua disponibilidade para atendimentos de emergência que podem ocorrer a qualquer momento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-4">
              <div className="space-y-0.5">
                <h3 className="font-medium text-base">Disponível para emergências agora</h3>
                <p className="text-sm text-muted-foreground">
                  Ative esta opção para receber solicitações de teleconsultas de emergência
                </p>
              </div>
              {doctorProfile?.consultationFee ? (
                <Switch 
                  checked={doctorProfile?.availableForEmergency || false}
                  onCheckedChange={handleEmergencyToggle}
                  disabled={toggleEmergencyMutation.isPending}
                />
              ) : (
                <div className="text-right">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mb-1">
                    Preço não definido
                  </Badge>
                  <p className="text-xs text-amber-600">
                    Defina o valor da consulta no seu perfil primeiro
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card de disponibilidade para consultas agendadas */}
        <Card className="bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Disponibilidade para Consultas Regulares</CardTitle>
            <CardDescription>
              Configure os horários em que você está disponível para atender consultas regulares agendadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="weekly" onValueChange={setCurrentTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="weekly">Semanal</TabsTrigger>
                <TabsTrigger value="appointments">Consultas Agendadas</TabsTrigger>
              </TabsList>

              <TabsContent value="weekly">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Selecione os horários em que você está disponível para atender consultas agendadas.
                    Cada slot representa 30 minutos de disponibilidade.
                  </p>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                  <div className="flex space-x-2 pb-4">
                    {weekDays.map((day, idx) => (
                      <DayColumn 
                        key={idx} 
                        dayIndex={idx} 
                        dayName={day} 
                        slots={timeSlots[idx]} 
                        onSlotChange={handleSlotChange}
                      />
                    ))}
                  </div>
                </ScrollArea>

                <Button 
                  className="mt-4" 
                  onClick={handleSaveAvailability}
                  disabled={isLoading || saveAvailabilityMutation.isPending}
                >
                  {(isLoading || saveAvailabilityMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar Disponibilidade
                </Button>
              </TabsContent>

              <TabsContent value="appointments">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    Visualize suas consultas agendadas para as próximas semanas.
                  </p>
                </div>

                <Table>
                  <TableCaption>Lista de consultas agendadas</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Calendar className="h-10 w-10 mb-2 text-muted-foreground/60" />
                          <p className="font-medium">Sem consultas agendadas no momento</p>
                          <p className="text-sm mt-1">As consultas agendadas pelos pacientes aparecerão aqui</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}