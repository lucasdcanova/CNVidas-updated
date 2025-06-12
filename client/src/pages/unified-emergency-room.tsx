import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import MinimalistVideoCall from '@/components/telemedicine/MinimalistVideoCall';

/**
 * Sala de Emergência Unificada
 * Página única que garante que médico e paciente acessem a mesma sala
 */
export default function UnifiedEmergencyRoom() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<{
    roomUrl: string;
    token: string;
    appointmentId: number;
    roomName: string;
  } | null>(null);
  
  const isDoctor = user?.role === 'doctor';
  
  // Extrair ID da consulta da URL
  const getAppointmentIdFromUrl = (): number | null => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const appointmentId = urlParams.get('id');
      return appointmentId ? parseInt(appointmentId) : null;
    } catch (e) {
      console.error('Erro ao extrair ID da URL:', e);
      return null;
    }
  };
  
  // Entrar na sala de emergência
  const joinEmergencyRoom = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        toast({
          title: 'Não autorizado',
          description: 'Você precisa estar logado para acessar esta página',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      
      // 1. Verificar se há ID na URL
      const appointmentId = getAppointmentIdFromUrl();
      
      if (!appointmentId) {
        throw new Error('ID da consulta não fornecido');
      }
      
      // 2. Buscar dados da consulta de emergência
      const response = await apiRequest('GET', `/api/emergency/v2/consultation/${appointmentId}`);
      
      if (!response.ok) {
        throw new Error('Consulta não encontrada');
      }

      const data = await response.json();
      console.log('Dados da consulta:', data);

      // Garantir que temos a URL da sala
      let roomUrl = data.roomUrl || data.dailyRoomUrl;
      
      if (!roomUrl && data.telemedRoomName) {
        roomUrl = `https://cnvidas.daily.co/${data.telemedRoomName}`;
      }
      
      if (!roomUrl) {
        // Criar sala se não existir
        console.log('Criando sala de emergência...');
        const roomName = `emergency-${appointmentId}`;
        
        const createResponse = await apiRequest('POST', '/api/telemedicine/daily/room', {
          roomName,
          isEmergency: true
        });
        
        if (createResponse.ok) {
          const roomData = await createResponse.json();
          roomUrl = roomData.url || `https://cnvidas.daily.co/${roomName}`;
        } else {
          throw new Error('Erro ao criar sala de emergência');
        }
      }
      
      // Obter token para a sala
      const tokenResponse = await apiRequest('POST', '/api/telemedicine/daily/token', {
        appointmentId,
        roomName: roomUrl.split('/').pop()
      });
      
      let token = data.token;
      
      if (tokenResponse.ok) {
        try {
          const tokenData = await tokenResponse.json();
          token = tokenData.token || token;
        } catch (e) {
          console.log('Usando token existente');
        }
      }
      
      // Configurar dados da sala
      const roomInfo = {
        roomUrl,
        token: token || null,
        appointmentId: appointmentId,
        roomName: roomUrl.split('/').pop() || `emergency-${appointmentId}`
      };
      
      // Atualizar estado
      setRoomData(roomInfo);
      
      toast({
        title: 'Sala de emergência',
        description: isDoctor ? 'Conectando ao paciente...' : 'Médico está sendo notificado...',
      });
      
    } catch (err) {
      console.error('Erro ao acessar sala:', err);
      setError(err instanceof Error ? err.message : 'Erro ao acessar sala de emergência');
      
      toast({
        title: 'Erro',
        description: 'Não foi possível acessar a sala de emergência',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Sair da chamada
  const handleLeaveCall = () => {
    navigate('/');
    
    toast({
      title: 'Atendimento encerrado',
      description: 'Você saiu da sala de emergência',
    });
  };
  
  // Iniciar ao carregar a página
  useEffect(() => {
    joinEmergencyRoom();
  }, [user]);
  
  return (
    <>
      <Helmet>
        <title>Atendimento de Emergência | CN Vidas</title>
      </Helmet>
      
      <div className="container max-w-6xl py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-center">
            {isDoctor ? 'Atendimento de Emergência' : 'Consulta de Emergência'}
          </h1>
          <p className="text-center text-muted-foreground mt-2">
            {isDoctor 
              ? 'Você está atendendo um paciente em emergência'
              : 'Um médico foi notificado e entrará na sala em instantes'}
          </p>
        </header>
        
        {/* Conteúdo da página - estados condicionais */}
        <div className="space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center p-12">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">
                {isDoctor ? 'Conectando ao paciente...' : 'Conectando ao médico...'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Por favor, aguarde enquanto preparamos sua consulta
              </p>
            </div>
          )}
          
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-8 flex flex-col items-center">
              <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro na conexão</h2>
              <p className="text-center mb-6">{error}</p>
              <Button 
                onClick={joinEmergencyRoom}
                variant="default"
              >
                Tentar novamente
              </Button>
            </div>
          )}
          
          {!loading && !error && roomData && (
            <div className="bg-card rounded-xl shadow-lg overflow-hidden">
              <div className="aspect-video md:aspect-[16/9] lg:aspect-[16/9] w-full" style={{ minHeight: '500px' }}>
                <MinimalistVideoCall
                  roomUrl={roomData.roomUrl}
                  token={roomData.token}
                  userName={user?.fullName || (isDoctor ? 'Médico' : 'Paciente')}
                  isDoctor={isDoctor}
                  onLeaveCall={handleLeaveCall}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}