import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Calendar, User, Clock, VideoIcon, PhoneCall, 
  Video, Trash2, Ban, AlertCircle, X 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { format, isPast, isToday, addMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { WaitingPatientIndicator } from '@/components/doctor/WaitingPatientIndicator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Importamos o componente simplificado
import { EmergencyBannerSimple } from '@/components/doctor/EmergencyBannerSimple';
import { EmergencyNotification } from '@/components/doctor/EmergencyNotification';

// Definimos uma versão simplificada do EmergencyBanner que não causa erros de hooks
const EmergencyBanner = () => {
  // Get doctor profile
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

  if (loadingProfile) {
    return (
      <Card className="bg-background">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Usamos o componente simplificado que não causa erro de hooks
  return <EmergencyBannerSimple doctorProfile={doctorProfile} />;
};

const AppointmentItem = ({ appointment, onDeleteEmergencyAppointment }: { appointment: any, onDeleteEmergencyAppointment?: (id: string) => void }) => {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const isExpired = isPast(new Date(appointment.date)) && !isToday(new Date(appointment.date));
  const isActive = !isExpired;
  const isEmergency = appointment.isEmergency;
  const isCanceled = appointment.status === "canceled";
  const endTime = addMinutes(parseISO(appointment.date), appointment.duration || 30);
  
  // Para o modal de cancelamento
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Mutação para cancelar consulta
  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number, reason: string }) => {
      const res = await apiRequest("POST", `/api/appointments/${id}/cancel`, { reason });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro ao cancelar consulta");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Consulta cancelada",
        description: "A consulta foi cancelada com sucesso e o paciente foi notificado.",
      });
      // Invalidar consultas para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/appointments"] });
      setShowCancelDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar consulta",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para excluir consulta
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("DELETE", `/api/appointments/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro ao excluir consulta");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Consulta excluída",
        description: "A consulta foi excluída com sucesso e o paciente foi notificado.",
      });
      
      // Se for uma consulta de emergência, adicionar ao estado de excluídas
      if (appointment.isEmergency && typeof appointment.id === 'string' && appointment.id.startsWith('emergency-doctor-')) {
        onDeleteEmergencyAppointment?.(appointment.id);
      } else {
        // Para consultas normais, invalidar queries
        queryClient.invalidateQueries({ queryKey: ["/api/doctors/appointments"] });
      }
      
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir consulta",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleCancelAppointment = () => {
    if (!cancelReason.trim()) {
      toast({
        title: "Erro ao cancelar",
        description: "Por favor, informe o motivo do cancelamento.",
        variant: "destructive",
      });
      return;
    }
    
    cancelAppointmentMutation.mutate({
      id: appointment.id,
      reason: cancelReason
    });
  };
  
  const handleDeleteAppointment = () => {
    deleteAppointmentMutation.mutate(appointment.id);
  };
  
  const formatDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };
  
  const formatTime = (date: string) => {
    return format(new Date(date), "HH:mm", { locale: ptBR });
  };
  
  const getStatusBadge = () => {
    if (isCanceled) {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    if (isExpired) {
      return <Badge variant="outline">Concluída</Badge>;
    }
    if (isToday(new Date(appointment.date))) {
      return <Badge variant="default" className="bg-green-500">Hoje</Badge>;
    }
    return <Badge variant="secondary">Agendada</Badge>;
  };
  
  // Classe condicional para o card de consulta de emergência
  const cardClassName = `mb-4 ${isEmergency ? 'ring-2 ring-red-500 relative overflow-hidden' : ''} ${isCanceled ? 'opacity-70' : ''}`;
  
  return (
    <>
      <Card className={cardClassName}>
        {isEmergency && (
          <div className="absolute top-0 right-0 bg-red-500 text-white px-2 py-1 text-xs font-bold transform translate-x-2 -translate-y-0 rotate-12 shadow-md">
            EMERGÊNCIA
          </div>
        )}
        <CardContent className={`p-6 ${isEmergency ? 'border-l-4 border-red-500' : ''}`}>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                  {appointment.patientProfileImage ? (
                    <img 
                      src={appointment.patientProfileImage} 
                      alt={appointment.patientName || "Paciente"} 
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    appointment.patientName?.charAt(0) || "P"
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">
                    {appointment.patientName || "Paciente"}
                    {appointment.patientAge && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({appointment.patientAge} anos)
                      </span>
                    )}
                    {isEmergency && <span className="ml-2 text-red-500 text-sm font-normal">Consulta de Emergência</span>}
                  </h3>
                  {getStatusBadge()}
                </div>
                <div className="flex flex-col mt-2 gap-1 text-sm">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{formatDate(appointment.date)}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{formatTime(appointment.date)} - {format(endTime, "HH:mm")}</span>
                  </div>
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <span>{appointment.type === "telemedicine" ? "Telemedicina" : "Presencial"}</span>
                  </div>
                  {appointment.patientEmail && (
                    <div className="flex items-center mt-1">
                      <span className="text-xs text-muted-foreground">Email: {appointment.patientEmail}</span>
                    </div>
                  )}
                  {appointment.patientPhone && (
                    <div className="flex items-center">
                      <span className="text-xs text-muted-foreground">Telefone: {appointment.patientPhone}</span>
                    </div>
                  )}
                  {appointment.patientBirthDate && (
                    <div className="flex items-center">
                      <span className="text-xs text-muted-foreground">
                        Data de nascimento: {format(new Date(appointment.patientBirthDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  {isCanceled && appointment.notes && (
                    <div className="flex items-center mt-2">
                      <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                      <span className="text-xs text-destructive">{appointment.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-end md:self-center">
              {/* Adicionar botões apenas para consultas não canceladas */}
              {!isCanceled && (
                <>
                  {isActive && (
                    <Button 
                      onClick={() => {
                        if (isEmergency) {
                          // Para consultas de emergência, abrir diretamente a sala
                          if (appointment.roomUrl) {
                            window.open(appointment.roomUrl, '_blank');
                            toast({
                              title: "Entrando na sala de emergência",
                              description: "Conectando com o paciente...",
                            });
                          } else {
                            toast({
                              title: "Erro",
                              description: "URL da sala não encontrada",
                              variant: "destructive",
                            });
                          }
                        } else {
                          // Consulta normal de telemedicina
                          navigate(`/telemedicine-consultation?appointmentId=${appointment.id}`);
                        }
                      }}
                      className={`flex items-center gap-2 ${isEmergency ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                    >
                      <VideoIcon className="h-4 w-4" />
                      <span>{isEmergency ? 'Atender Emergência' : 'Iniciar Consulta'}</span>
                    </Button>
                  )}
                  
                  {isActive && (
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 text-destructive hover:bg-destructive/10"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <Ban className="h-4 w-4" />
                      <span>Cancelar</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              {isExpired && !isCanceled && (
                <Button variant="outline" disabled>
                  Finalizada
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Dialog para cancelar consulta */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Consulta</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento. O paciente será notificado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo do cancelamento</Label>
              <Textarea
                id="reason"
                placeholder="Explique o motivo do cancelamento..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelAppointment}
              disabled={cancelAppointmentMutation.isPending || !cancelReason.trim()}
            >
              {cancelAppointmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Alert Dialog para excluir consulta */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Consulta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta consulta? Esta ação não pode ser desfeita.
              O paciente será notificado que a consulta foi removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAppointmentMutation.isPending}
            >
              {deleteAppointmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default function DoctorTelemedicinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estado para controlar consultas de emergência excluídas
  const [deletedEmergencyAppointments, setDeletedEmergencyAppointments] = useState<string[]>([]);
  
  // Função para adicionar consulta de emergência à lista de excluídas
  const handleDeleteEmergencyAppointment = (appointmentId: string) => {
    setDeletedEmergencyAppointments(prev => [...prev, appointmentId]);
  };

  // Get doctor profile to pass doctor ID to emergency notifications
  const { data: doctorProfile } = useQuery({
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
  
  // Get doctor appointments (includes emergency consultations)
  const { data: appointmentsResponse, isLoading: loadingAppointments } = useQuery({
    queryKey: ["/api/doctors/appointments"],
    queryFn: ({ signal }) => 
      fetch("/api/doctors/appointments", { 
        signal,
        credentials: "include"
      })
        .then(res => {
          if (!res.ok) throw new Error("Falha ao buscar consultas");
          return res.json();
        }),
    refetchInterval: 5000, // Poll every 5 seconds to get new emergency consultations
  });
  
  // Extrair array de appointments da resposta
  const appointments = appointmentsResponse?.appointments || [];

  // Get emergency consultations for this doctor
  const { data: emergencyConsultations } = useQuery({
    queryKey: ["/api/emergency/v2/notifications", doctorProfile?.id],
    queryFn: ({ signal }) => 
      doctorProfile?.id ? fetch(`/api/emergency/v2/notifications/${doctorProfile.id}`, { 
        signal,
        credentials: "include"
      })
        .then(res => {
          if (!res.ok) return [];
          return res.json();
        })
        .catch(() => []) : Promise.resolve([]),
    enabled: !!doctorProfile?.id,
    refetchInterval: 5000, // Check every 5 seconds for new emergencies
  });

  // Filter telemedicine appointments (includes emergency consultations)
  const telemedicineAppointments = appointments.filter(
    (app: any) => app.type === "telemedicine"
  );

  console.log('📊 Doctor Telemedicine - Total appointments:', appointments.length);
  console.log('📊 Doctor Telemedicine - Telemedicine appointments:', telemedicineAppointments.length);
  console.log('📊 Doctor Telemedicine - Emergency appointments:', telemedicineAppointments.filter((app: any) => app.isEmergency).length);
  console.log('📊 Doctor Telemedicine - Waiting appointments:', telemedicineAppointments.filter((app: any) => app.status === 'waiting').length);

  // Combine regular appointments with emergency consultations
  const allAppointments = [...telemedicineAppointments];
  
  // Upcoming and past appointments
  const upcomingAppointments = allAppointments.filter(
    (app: any) => {
      const appointmentDate = new Date(app.date);
      const isUpcoming = !isPast(appointmentDate) || isToday(appointmentDate);
      const isWaitingEmergency = app.isEmergency && app.status === 'waiting';
      const isInProgressEmergency = app.isEmergency && app.status === 'in_progress';
      
      // Include: future appointments, today's appointments, and active emergency consultations
      return isUpcoming || isWaitingEmergency || isInProgressEmergency;
    }
  );
  
  const pastAppointments = allAppointments.filter(
    (app: any) => {
      const appointmentDate = new Date(app.date);
      const isPastDate = isPast(appointmentDate) && !isToday(appointmentDate);
      const isCompletedEmergency = app.isEmergency && (app.status === 'completed' || app.status === 'cancelled');
      
      // Include: past appointments and completed emergency consultations
      return isPastDate || isCompletedEmergency;
    }
  );

  return (
    <DashboardLayout title="Telemedicina">
      {/* Indicador de pacientes aguardando em emergência */}
      {/* Componente de paciente em espera removido conforme solicitado */}
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Teleconsultas</h1>
          <p className="text-muted-foreground">
            Gerencie suas consultas de telemedicina e configure sua disponibilidade
          </p>
        </div>
        
        <EmergencyBanner />
        
        {/* Emergency Notifications Component */}
        {doctorProfile && (
          <EmergencyNotification doctorId={doctorProfile.id} />
        )}
        
        <div className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold">Próximas Consultas</h2>
          
          {loadingAppointments && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {!loadingAppointments && upcomingAppointments.length === 0 && (
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center h-32">
                <Video className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Você não tem consultas agendadas</p>
              </CardContent>
            </Card>
          )}
          
          {!loadingAppointments && upcomingAppointments.map((appointment: any) => (
            <AppointmentItem 
              key={appointment.id} 
              appointment={appointment} 
              onDeleteEmergencyAppointment={handleDeleteEmergencyAppointment}
            />
          ))}
        </div>
        
        {!loadingAppointments && pastAppointments.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold">Consultas Realizadas</h2>
              <span className="text-sm text-muted-foreground ml-2">({pastAppointments.length})</span>
            </div>
            
            {pastAppointments.slice(0, 5).map((appointment: any) => (
              <AppointmentItem 
                key={appointment.id} 
                appointment={appointment} 
                onDeleteEmergencyAppointment={handleDeleteEmergencyAppointment}
              />
            ))}
            
            {pastAppointments.length > 5 && (
              <div className="text-center">
                <Button variant="outline">
                  Ver todas as consultas ({pastAppointments.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}