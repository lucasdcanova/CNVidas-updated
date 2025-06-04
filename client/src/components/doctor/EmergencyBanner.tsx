import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { 
  AlertCircle, 
  Bell, 
  CheckCircle2, 
  Video, 
  XCircle 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const EmergencyBanner = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasPendingEmergency, setHasPendingEmergency] = useState(false);

  // Buscar perfil do médico
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

  // Inicializar estado com base no perfil do médico
  useEffect(() => {
    if (doctorProfile) {
      setIsAvailable(doctorProfile.availableForEmergency || false);
    }
  }, [doctorProfile]);

  // Verificar consultas de emergência pendentes
  const { data: emergencyConsultation } = useQuery({
    queryKey: ["/api/appointments/latest-emergency"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/appointments/latest-emergency", { 
        signal,
        credentials: "include" 
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error("Falha ao verificar consultas de emergência");
      }
      
      return await res.json();
    },
    enabled: isAvailable,
    refetchInterval: isAvailable ? 15000 : false,
  });

  // Atualizar estado quando emergencyConsultation mudar
  useEffect(() => {
    setHasPendingEmergency(!!emergencyConsultation);
  }, [emergencyConsultation]);

  // Mutation para alternar disponibilidade
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (available: boolean) => {
      const res = await apiRequest("POST", "/api/doctors/toggle-availability", { 
        available
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setIsAvailable(data.availableForEmergency);
      
      toast({
        title: data.availableForEmergency ? "Você está disponível" : "Você está indisponível",
        description: data.availableForEmergency 
          ? "Você começará a receber consultas de emergência."
          : "Você não receberá mais consultas de emergência.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao alterar disponibilidade",
        description: error.message,
      });
    },
  });

  // Entrar na sala de emergência
  const handleJoinEmergencyRoom = () => {
    if (emergencyConsultation) {
      navigate(`/doctor-emergency?appointmentId=${emergencyConsultation.id}`);
    }
  };

  return (
    <div className="mb-6">
      {/* Switch de disponibilidade */}
      <div className="flex items-center justify-between mb-4 p-4 bg-card rounded-lg border">
        <div className="flex items-center space-x-2">
          <Label htmlFor="emergency-toggle" className="font-medium">
            Disponível para emergências
          </Label>
          <Badge variant={isAvailable ? "success" : "secondary"}>
            {isAvailable ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <Switch
          id="emergency-toggle"
          checked={isAvailable}
          onCheckedChange={(checked) => {
            toggleAvailabilityMutation.mutate(checked);
          }}
          disabled={toggleAvailabilityMutation.isPending}
        />
      </div>

      {/* Alerta de consulta pendente */}
      {isAvailable && hasPendingEmergency && emergencyConsultation && (
        <Alert variant="destructive" className="mb-4 animate-pulse">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Consulta de emergência pendente!</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col space-y-2 mt-2">
              <p>
                <strong>Paciente:</strong> {emergencyConsultation.patientName || 'Não informado'} 
              </p>
              <p>
                <strong>Sintomas:</strong> {emergencyConsultation.symptoms || 'Não informado'}
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-2"
                onClick={handleJoinEmergencyRoom}
              >
                <Video className="mr-2 h-4 w-4" />
                Atender Emergência Agora
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Mensagem de disponibilidade */}
      {isAvailable && !hasPendingEmergency && (
        <Alert variant="default" className="border-green-200 bg-green-50 mb-4">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700">Disponível para emergências</AlertTitle>
          <AlertDescription className="text-green-600">
            Você será notificado quando uma consulta de emergência estiver disponível.
          </AlertDescription>
        </Alert>
      )}

      {/* Mensagem de indisponibilidade */}
      {!isAvailable && (
        <Alert variant="default" className="border-muted bg-muted/20 mb-4">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          <AlertTitle>Indisponível para emergências</AlertTitle>
          <AlertDescription>
            Ative a disponibilidade para receber consultas de emergência.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default EmergencyBanner;