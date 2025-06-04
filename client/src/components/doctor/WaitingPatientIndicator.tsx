import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, UserRound, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';

/**
 * Componente que mostra quando há pacientes aguardando atendimento de emergência
 */
export const WaitingPatientIndicator = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [waitingTime, setWaitingTime] = useState(0);
  
  // Consulta às consultas de emergência pendentes
  const { data: emergencyAppointment, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/emergency/waiting'],
    staleTime: 10000, // 10 segundos
    refetchInterval: 15000, // Atualiza a cada 15 segundos
    queryFn: async ({ signal }) => {
      // Criar ID de sessão alternativo para garantir autenticação
      const userData = localStorage.getItem('userData');
      let sessionToken = '';
      
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user && user.id) {
            // Formatar token como sessionId:userId:timestamp
            sessionToken = `emergency-session:${user.id}:${Date.now()}`;
          }
        } catch (e) {
          console.error("Erro ao processar dados do usuário:", e);
        }
      }
      
      console.log("Verificando pacientes em espera com token:", sessionToken ? 'Presente' : 'Ausente');
      
      const res = await fetch('/api/emergency/waiting', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Adicionar cabeçalho de autenticação alternativo
          ...(sessionToken ? { 'X-Session-ID': sessionToken } : {}),
        },
        credentials: 'include', // Incluir cookies de sessão
        signal
      });
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Erro ao verificar pacientes em espera: ${res.status}`);
      }
      
      const data = await res.json();
      return data;
    }
  });
  
  // Atualizar o contador de tempo de espera
  useEffect(() => {
    if (!emergencyAppointment) return;
    
    const startTime = new Date(emergencyAppointment.startTime).getTime();
    const updateWaitingTime = () => {
      const now = new Date().getTime();
      const waitingTimeInSeconds = Math.floor((now - startTime) / 1000);
      setWaitingTime(waitingTimeInSeconds);
    };
    
    // Atualizar imediatamente e a cada segundo
    updateWaitingTime();
    const interval = setInterval(updateWaitingTime, 1000);
    
    return () => clearInterval(interval);
  }, [emergencyAppointment]);
  
  // Formatação do tempo de espera
  const formatWaitingTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} segundos`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  };
  
  // Função para atender a consulta de emergência
  const handleAttendEmergency = () => {
    if (!emergencyAppointment) return;
    
    // Redirecionando para a sala de emergência unificada com o ID da consulta
    navigate(`/unified-emergency-room?id=${emergencyAppointment.id}`);
    
    toast({
      title: "Iniciando atendimento",
      description: "Conectando à sala de emergência...",
    });
  };
  
  // Se não houver consulta de emergência pendente ou estiver carregando
  if (isLoading || !emergencyAppointment) {
    return null;
  }
  
  // Mostrar o indicador apenas quando houver uma consulta de emergência
  return (
    <Card className="border-red-500 mb-6 shadow-md animate-pulse">
      <CardHeader className="bg-red-50 dark:bg-red-900/20 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Paciente em Emergência
          </CardTitle>
          <Badge variant="destructive" className="animate-bounce">
            AGUARDANDO
          </Badge>
        </div>
        <CardDescription>
          Um paciente está aguardando atendimento de emergência
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <UserRound className="h-4 w-4 mr-2" />
            <span className="font-medium text-foreground">
              {emergencyAppointment.patientName || 'Paciente'}
            </span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-2" />
            <span>
              Tempo de espera: <span className="font-semibold text-red-500">{formatWaitingTime(waitingTime)}</span>
            </span>
          </div>
          
          {emergencyAppointment.patientSymptoms && (
            <div className="mt-2 p-2 bg-muted/50 rounded-md text-sm">
              <span className="font-semibold">Sintomas relatados:</span>
              <p className="mt-1 text-muted-foreground">{emergencyAppointment.patientSymptoms}</p>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end pt-0">
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={handleAttendEmergency}
          className="font-semibold"
        >
          ATENDER AGORA
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WaitingPatientIndicator;