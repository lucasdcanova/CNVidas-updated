import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AvailabilityManagerEnhanced } from '@/components/doctor/AvailabilityManagerEnhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DoctorAvailabilityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [isUpdatingEmergency, setIsUpdatingEmergency] = useState(false);

  // Buscar perfil do médico para obter status de emergência
  const { data: doctorProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['/api/doctors/profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/doctors/profile');
      const data = await response.json();
      setEmergencyAvailable(data.availableForEmergency || false);
      return data;
    }
  });

  // Buscar próximas consultas agendadas
  const { data: upcomingAppointments, isLoading: loadingAppointments } = useQuery({
    queryKey: ['/api/doctors/appointments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/doctors/appointments');
      const data = await response.json();
      // Filtrar apenas consultas futuras
      return data.filter((apt: any) => new Date(apt.date) > new Date());
    }
  });

  // Mutation para atualizar disponibilidade de emergência
  const toggleEmergencyMutation = useMutation({
    mutationFn: async (available: boolean) => {
      const response = await apiRequest('POST', '/api/doctors/toggle-availability', {
        availableForEmergency: available
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: emergencyAvailable ? "Disponibilidade desativada" : "Disponibilidade ativada",
        description: emergencyAvailable 
          ? "Você não receberá mais chamadas de emergência"
          : "Você agora está disponível para consultas de emergência",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar disponibilidade",
        description: "Não foi possível atualizar sua disponibilidade. Tente novamente.",
        variant: "destructive"
      });
      // Reverter o estado em caso de erro
      setEmergencyAvailable(!emergencyAvailable);
    }
  });

  const handleEmergencyToggle = (checked: boolean) => {
    setEmergencyAvailable(checked);
    setIsUpdatingEmergency(true);
    toggleEmergencyMutation.mutate(checked, {
      onSettled: () => setIsUpdatingEmergency(false)
    });
  };

  if (loadingProfile) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciar Disponibilidade</h1>
          <p className="text-muted-foreground">
            Configure seus horários disponíveis para consultas e emergências
          </p>
        </div>

        {/* Card de Disponibilidade para Emergências */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Disponibilidade para Emergências
            </CardTitle>
            <CardDescription>
              Ative esta opção para receber chamadas de consultas de emergência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="emergency-toggle" className="text-base">
                  Disponível para consultas de emergência
                </Label>
                <p className="text-sm text-muted-foreground">
                  Você receberá notificações quando pacientes precisarem de atendimento urgente
                </p>
              </div>
              <Switch
                id="emergency-toggle"
                checked={emergencyAvailable}
                onCheckedChange={handleEmergencyToggle}
                disabled={isUpdatingEmergency}
              />
            </div>
            
            {emergencyAvailable && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Você está disponível para emergências. Mantenha seu dispositivo próximo para receber notificações.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Componente de Gerenciamento de Disponibilidade */}
        <AvailabilityManagerEnhanced />

        {/* Card de Próximas Consultas */}
        {upcomingAppointments && upcomingAppointments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximas Consultas Agendadas
              </CardTitle>
              <CardDescription>
                Consultas já marcadas nos seus horários disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 5).map((appointment: any) => (
                  <div 
                    key={appointment.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">
                        {appointment.patientName || 'Paciente'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(appointment.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <Badge variant={appointment.type === 'emergency' ? 'destructive' : 'default'}>
                      {appointment.type === 'emergency' ? 'Emergência' : 'Agendada'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}