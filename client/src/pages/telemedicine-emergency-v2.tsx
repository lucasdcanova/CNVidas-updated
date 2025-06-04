import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldAlert } from 'lucide-react';
import RobustDailyVideoCall from '@/components/telemedicine/RobustDailyVideoCall';

/**
 * Página de consulta de emergência v2
 * - Implementação robusta com o componente RobustDailyVideoCall
 * - Fluxo seguro e tratamento de erros
 * - Design moderno e responsivo
 */
export default function TelemedicineEmergencyV2() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<{
    appointmentId: number;
    roomName: string;
    roomUrl: string;
    token?: string;
  } | null>(null);
  
  // Iniciar consulta de emergência
  const startEmergencyConsultation = async () => {
    if (!user) {
      toast({
        title: 'Não autorizado',
        description: 'Você precisa estar logado para iniciar uma consulta.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Usando nossa nova rota direta para consultas de emergência
      const response = await fetch('/api/emergency-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          doctorId: 6, // Enviando ID do médico disponível para emergência
          userId: user.id // Enviar ID do usuário explicitamente
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na consulta de emergência:', errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Consulta de emergência iniciada com sucesso:', data);
      
      if (!data.roomName || !data.appointmentId) {
        throw new Error('Dados da sala incompletos na resposta');
      }
      
      // Configurar informações da sala
      setRoomInfo({
        appointmentId: data.appointmentId,
        roomName: data.roomName,
        roomUrl: data.url || `https://cnvidas.daily.co/${data.roomName}`,
        token: data.token
      });
      
      toast({
        title: 'Consulta iniciada',
        description: 'Você está entrando na sala de videochamada de emergência',
      });
    } catch (err) {
      console.error('Erro ao iniciar consulta:', err);
      setError(err instanceof Error ? err.message : 'Erro ao iniciar consulta de emergência');
      
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a consulta de emergência. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Iniciar consulta quando a página carregar
  // Usamos uma flag para garantir que a consulta seja iniciada apenas uma vez
  const consultationStartedRef = useRef(false);
  
  useEffect(() => {
    if (!consultationStartedRef.current) {
      consultationStartedRef.current = true;
      startEmergencyConsultation();
    }
  }, []);
  
  // Voltar para a página de telemedicina após sair da consulta
  const handleLeaveCall = () => {
    navigate('/telemedicine');
  };
  
  // Renderização para carregamento
  if (loading && !roomInfo) {
    return (
      <div className="container py-8 max-w-5xl mx-auto">
        <Helmet>
          <title>Consulta de Emergência | CN Vidas</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative w-20 h-20 mb-6">
            <Loader2 className="absolute inset-0 h-20 w-20 text-primary animate-spin" />
            <ShieldAlert className="absolute inset-0 h-10 w-10 text-primary m-auto" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Preparando consulta de emergência</h2>
          <p className="text-muted-foreground">Aguarde enquanto conectamos você a um médico...</p>
        </div>
      </div>
    );
  }
  
  // Renderização para erro
  if (error && !roomInfo) {
    return (
      <div className="container py-8 max-w-5xl mx-auto">
        <Helmet>
          <title>Erro na Consulta | CN Vidas</title>
        </Helmet>
        <Card className="border-destructive">
          <CardContent className="pt-6 px-6 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-destructive/10 p-3 rounded-full mb-4">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Erro na consulta de emergência</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => navigate('/telemedicine')}>
                  Voltar
                </Button>
                <Button onClick={startEmergencyConsultation}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Renderização da videochamada
  if (roomInfo) {
    return (
      <div className="container py-8 max-w-5xl mx-auto">
        <Helmet>
          <title>Consulta de Emergência | CN Vidas</title>
        </Helmet>
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Consulta de Emergência</h1>
          <p className="text-muted-foreground">
            Você está em uma consulta de emergência. Um médico irá atendê-lo em breve.
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-sm overflow-hidden border min-h-[600px]">
          <RobustDailyVideoCall
            roomName={roomInfo.roomName}
            roomUrl={roomInfo.roomUrl}
            token={roomInfo.token}
            userName={user?.fullName || user?.username || 'Paciente CN Vidas'}
            onLeaveCall={handleLeaveCall}
            appointmentId={roomInfo.appointmentId}
          />
        </div>
      </div>
    );
  }
  
  // Fallback (não deve acontecer)
  return null;
}