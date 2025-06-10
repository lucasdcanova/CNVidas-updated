import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Clock, Copy, Loader2, Save, 
  AlertCircle, CheckCircle, RefreshCw 
} from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface DayAvailability {
  dayOfWeek: number;
  dayName: string;
  date?: Date;
  slots: TimeSlot[];
  enabled: boolean;
}

interface RecurringPattern {
  startTime: string;
  endTime: string;
  interval: number; // em minutos
  daysOfWeek: number[];
}

export function AvailabilityManagerEnhanced() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('simple');
  const [saving, setSaving] = useState(false);
  const [weeklyAvailability, setWeeklyAvailability] = useState<DayAvailability[]>(generateWeekTemplate());
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>({
    startTime: '09:00',
    endTime: '18:00',
    interval: 30,
    daysOfWeek: [1, 2, 3, 4, 5] // Segunda a sexta
  });

  // Buscar disponibilidade existente
  const { data: existingAvailability, isLoading } = useQuery({
    queryKey: ['/api/doctors/availability'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/doctors/availability');
      const data = await response.json();
      return data.availability || [];
    }
  });

  // Atualizar estado quando carregar disponibilidade existente
  useEffect(() => {
    if (existingAvailability && existingAvailability.length > 0) {
      const newAvailability = generateWeekTemplate();
      
      // Mapear slots existentes para o template
      existingAvailability.forEach((slot: any) => {
        const dayIndex = slot.dayOfWeek;
        if (dayIndex >= 0 && dayIndex < 7) {
          newAvailability[dayIndex].enabled = true;
          
          // Marcar os slots correspondentes como disponíveis
          const slotIndex = newAvailability[dayIndex].slots.findIndex(
            s => s.time === slot.startTime
          );
          if (slotIndex !== -1) {
            newAvailability[dayIndex].slots[slotIndex].available = true;
          }
        }
      });
      
      setWeeklyAvailability(newAvailability);
    }
  }, [existingAvailability]);

  // Gerar template da semana
  function generateWeekTemplate(): DayAvailability[] {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days.map((dayName, index) => ({
      dayOfWeek: index,
      dayName,
      slots: generateTimeSlots(),
      enabled: index >= 1 && index <= 5 // Segunda a sexta habilitados por padrão
    }));
  }

  // Gerar slots de tempo
  function generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({ time, available: false });
      }
    }
    return slots;
  }

  // Alternar disponibilidade de um slot
  const toggleSlot = (dayIndex: number, slotIndex: number) => {
    const newAvailability = [...weeklyAvailability];
    newAvailability[dayIndex].slots[slotIndex].available = 
      !newAvailability[dayIndex].slots[slotIndex].available;
    setWeeklyAvailability(newAvailability);
  };

  // Aplicar padrão recorrente
  const applyRecurringPattern = () => {
    const newAvailability = [...weeklyAvailability];
    
    recurringPattern.daysOfWeek.forEach(dayIndex => {
      if (dayIndex >= 0 && dayIndex < 7) {
        newAvailability[dayIndex].enabled = true;
        newAvailability[dayIndex].slots = newAvailability[dayIndex].slots.map(slot => {
          const slotHour = parseInt(slot.time.split(':')[0]);
          const slotMinute = parseInt(slot.time.split(':')[1]);
          const startHour = parseInt(recurringPattern.startTime.split(':')[0]);
          const startMinute = parseInt(recurringPattern.startTime.split(':')[1]);
          const endHour = parseInt(recurringPattern.endTime.split(':')[0]);
          const endMinute = parseInt(recurringPattern.endTime.split(':')[1]);
          
          const slotTotalMinutes = slotHour * 60 + slotMinute;
          const startTotalMinutes = startHour * 60 + startMinute;
          const endTotalMinutes = endHour * 60 + endMinute;
          
          return {
            ...slot,
            available: slotTotalMinutes >= startTotalMinutes && slotTotalMinutes < endTotalMinutes
          };
        });
      }
    });
    
    setWeeklyAvailability(newAvailability);
    toast({
      title: "Padrão aplicado",
      description: "O padrão recorrente foi aplicado aos dias selecionados.",
    });
  };

  // Copiar disponibilidade de um dia para outro
  const copyDayAvailability = (fromDay: number, toDay: number) => {
    const newAvailability = [...weeklyAvailability];
    newAvailability[toDay] = {
      ...newAvailability[toDay],
      slots: newAvailability[fromDay].slots.map(slot => ({ ...slot })),
      enabled: newAvailability[fromDay].enabled
    };
    setWeeklyAvailability(newAvailability);
  };

  // Salvar disponibilidade
  const saveAvailability = async () => {
    setSaving(true);
    try {
      // Converter para formato da API
      const availabilityData = weeklyAvailability.flatMap(day => {
        if (!day.enabled) return [];
        
        const availableSlots = day.slots
          .filter(slot => slot.available)
          .map(slot => ({
            dayOfWeek: day.dayOfWeek,
            startTime: slot.time,
            endTime: addMinutes(slot.time, 30), // Assumindo slots de 30 minutos
            isAvailable: true
          }));
        
        return availableSlots;
      });

      const response = await apiRequest('POST', '/api/doctors/availability', {
        slots: availabilityData
      });

      if (!response.ok) throw new Error('Erro ao salvar disponibilidade');

      toast({
        title: "Disponibilidade salva",
        description: "Sua disponibilidade foi atualizada com sucesso.",
      });
      
      // Invalidar cache para forçar reload dos dados
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/availability'] });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar sua disponibilidade. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper para adicionar minutos a um horário
  const addMinutes = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Gerenciar Disponibilidade
            </CardTitle>
            <CardDescription>
              Configure seus horários disponíveis para consultas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gerenciar Disponibilidade
          </CardTitle>
          <CardDescription>
            Configure seus horários disponíveis para consultas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple">Configuração Rápida</TabsTrigger>
              <TabsTrigger value="detailed">Configuração Detalhada</TabsTrigger>
            </TabsList>

            {/* Configuração Rápida */}
            <TabsContent value="simple" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Configure um padrão de horários que será aplicado aos dias selecionados
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {/* Horários */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Horário de início</Label>
                    <Select
                      value={recurringPattern.startTime}
                      onValueChange={(value) => 
                        setRecurringPattern({...recurringPattern, startTime: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {generateTimeOptions().map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário de término</Label>
                    <Select
                      value={recurringPattern.endTime}
                      onValueChange={(value) => 
                        setRecurringPattern({...recurringPattern, endTime: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {generateTimeOptions().map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dias da semana */}
                <div className="space-y-2">
                  <Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {weeklyAvailability.map((day, index) => (
                      <Badge
                        key={index}
                        variant={recurringPattern.daysOfWeek.includes(index) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const newDays = recurringPattern.daysOfWeek.includes(index)
                            ? recurringPattern.daysOfWeek.filter(d => d !== index)
                            : [...recurringPattern.daysOfWeek, index];
                          setRecurringPattern({...recurringPattern, daysOfWeek: newDays});
                        }}
                      >
                        {day.dayName}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={applyRecurringPattern}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aplicar Padrão
                </Button>
              </div>
            </TabsContent>

            {/* Configuração Detalhada */}
            <TabsContent value="detailed" className="space-y-4">
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Clique nos horários para marcar como disponível/indisponível
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-7 gap-2">
                {weeklyAvailability.map((day, dayIndex) => (
                  <div key={dayIndex} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{day.dayName}</Label>
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(checked) => {
                          const newAvailability = [...weeklyAvailability];
                          newAvailability[dayIndex].enabled = checked;
                          setWeeklyAvailability(newAvailability);
                        }}
                      />
                    </div>
                    
                    {day.enabled && (
                      <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {day.slots.map((slot, slotIndex) => (
                          <Button
                            key={slotIndex}
                            variant={slot.available ? "default" : "outline"}
                            size="sm"
                            className="w-full text-xs h-8"
                            onClick={() => toggleSlot(dayIndex, slotIndex)}
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Botões de ação */}
          <div className="flex justify-end gap-2 mt-6 mb-4 md:mb-0">
            <Button variant="outline" onClick={() => setWeeklyAvailability(generateWeekTemplate())}>
              Limpar Tudo
            </Button>
            <Button onClick={saveAvailability} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Disponibilidade
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper para gerar opções de horário
function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return times;
}