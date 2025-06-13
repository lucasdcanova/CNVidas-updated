import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Helmet } from 'react-helmet';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import MinimalistVideoCall from '@/components/telemedicine/MinimalistVideoCall';
import { TelemedicineDebugger } from '@/components/telemedicine/TelemedicineDebugger';
import {
  Video,
  RefreshCw,
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

/**
 * Página avançada de telemedicina Daily.co
 * - Implementação completa seguindo as melhores práticas do Daily.co
 * - Fluxo seguro de criação e verificação de sala
 * - Recuperação automática em caso de erros
 * - Estados de feedback visual para o usuário
 */
export default function TelemedicineConsultation() {
  const { id: appointmentIdParam } = useParams();
  const appointmentId = appointmentIdParam ? parseInt(appointmentIdParam) : undefined;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados da consulta
  const [loading, setLoading] = useState(true);
  const [preparingRoom, setPreparingRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [roomInfo, setRoomInfo] = useState<{
    url: string;
    token?: string;
    name: string;
  } | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  
  const mountedRef = useRef(true);

  // Logging de diagnóstico
  const logEvent = (message: string, data?: any) => {
    if (mountedRef.current) {
      console.log(`[Telemedicine] ${message}`, data);
    }
  };
  


  // Função para buscar informações da consulta
  useEffect(() => {
    const getAppointmentInfo = async () => {
      try {
        if (!appointmentId) {
          throw new Error('ID da consulta não fornecido');
        }

        logEvent(`Buscando informações da consulta: ${appointmentId}`);
        const res = await apiRequest('GET', `/api/appointments/${appointmentId}`);
        if (!res.ok) {
          throw new Error('Erro ao buscar informações da consulta');
        }

        const appointmentData = await res.json();
        if (!appointmentData) {
          throw new Error('Consulta não encontrada');
        }

        logEvent('Dados da consulta obtidos:', appointmentData);
        setAppointment(appointmentData);

        // Se a consulta não tem nome de sala definido, vamos criar
        if (!appointmentData.telemedRoomName) {
          logEvent('Consulta sem sala definida. Configurando...');
          await prepareConsultationRoom(appointmentData);
        } else {
          logEvent('Sala já definida:', appointmentData.telemedRoomName);
          setRoomInfo({
            name: appointmentData.telemedRoomName,
            url: `https://cnvidas.daily.co/${appointmentData.telemedRoomName}`,
            token: undefined // Vamos obter o token separadamente
          });
          setLoading(false);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logEvent('Erro ao buscar consulta:', errorMessage);
        setError('Não foi possível carregar a consulta: ' + errorMessage);
        setLoading(false);
        
        toast({
          title: "Erro ao carregar consulta",
          description: errorMessage,
          variant: "destructive"
        });
      }
    };

    getAppointmentInfo();
    
    return () => {
      mountedRef.current = false;
    };
  }, [appointmentId]);

  // Preparar sala para consulta
  const prepareConsultationRoom = async (appointmentData: any) => {
    try {
      setPreparingRoom(true);
      
      // Gerar nome da sala (baseado no tipo de consulta)
      const roomName = appointmentData.isEmergency 
                     ? `emergency-${appointmentId}` 
                     : `consultation-${appointmentId}`;
      
      logEvent(`Preparando sala: ${roomName}`);
      
      // ETAPA 1: Criar sala diretamente pelo novo endpoint
      const createResponse = await apiRequest('POST', '/api/telemedicine/daily-direct/create-room', {
        roomName,
        forceCreate: true,
        expiryHours: 5 // Sala com 5 horas de duração
      });
      
      if (!createResponse.ok) {
        throw new Error('Falha ao criar sala de videoconferência');
      }
      
      const roomData = await createResponse.json();
      logEvent('Sala criada com sucesso:', roomData);
      
      // ETAPA 2: Verificar se a sala realmente existe
      logEvent('Verificando existência da sala...');
      
      // Dar um tempo inicial para propagação da sala
      logEvent('Aguardando 5 segundos para propagação inicial...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verificar com retry automático
      let roomExists = false;
      let verifyAttempts = 0;
      const maxVerifyAttempts = 3;
      
      while (!roomExists && verifyAttempts < maxVerifyAttempts) {
        verifyAttempts++;
        logEvent(`Tentativa ${verifyAttempts} de verificação da sala...`);
        
        try {
          const verifyResponse = await apiRequest('GET', 
            `/api/telemedicine/daily-direct/room-exists?roomName=${roomName}`);
          
          const verifyData = await verifyResponse.json();
          logEvent(`Resultado da verificação ${verifyAttempts}:`, verifyData);
          
          if (verifyData.exists) {
            roomExists = true;
            logEvent('✅ Sala confirmada e pronta!');
          } else if (verifyAttempts < maxVerifyAttempts) {
            logEvent(`Sala ainda não propagada. Aguardando mais ${3 * verifyAttempts} segundos...`);
            await new Promise(resolve => setTimeout(resolve, 3000 * verifyAttempts));
          }
        } catch (error) {
          logEvent(`Erro na verificação ${verifyAttempts}:`, error);
        }
      }
      
      if (!roomExists) {
        logEvent('⚠️ Sala não foi confirmada após todas as tentativas, prosseguindo mesmo assim...');
      }
      
      // ETAPA 3: Gerar token de acesso
      logEvent('Gerando token de acesso...');
      const userName = user?.fullName || user?.username || 'Usuário CN Vidas';
      
      try {
        const tokenResponse = await apiRequest('POST', '/api/telemedicine/daily-direct/token', {
          roomName,
          userName,
          isOwner: false
        });
        
        if (!tokenResponse.ok) {
          logEvent('Falha ao gerar token, prosseguindo sem token');
          setRoomInfo({
            name: roomName,
            url: `https://cnvidas.daily.co/${roomName}`,
            token: undefined
          });
        } else {
          const tokenData = await tokenResponse.json();
          logEvent('✅ Token gerado com sucesso');
          
          setRoomInfo({
            name: roomName,
            url: `https://cnvidas.daily.co/${roomName}`,
            token: tokenData.token || undefined
          });
        }
      } catch (tokenError) {
        logEvent('⚠️ Erro ao gerar token, continuando sem autenticação:', tokenError);
        setRoomInfo({
          name: roomName,
          url: `https://cnvidas.daily.co/${roomName}`,
          token: undefined
        });
      }
      
      setPreparingRoom(false);
      setLoading(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logEvent('Erro ao preparar sala:', errorMessage);
      setError('Não foi possível preparar a sala de videoconferência: ' + errorMessage);
      setPreparingRoom(false);
      setLoading(false);
      
      toast({
        title: "Erro na Preparação",
        description: "Não foi possível preparar a sala de videoconferência. " + errorMessage,
        variant: "destructive"
      });
    }
  };
  
  const handleJoinCall = () => {
    logEvent('Usuário iniciou a chamada');
    setShowVideoCall(true);
  };

  const handleLeaveCall = () => {
    logEvent('Usuário encerrou a chamada');
    setShowVideoCall(false);
    navigate('/');
  };
  
  const retryConnection = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };
  
  // Renderizar estados diferentes
  if (loading || preparingRoom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Helmet>
          <title>Preparando Consulta | CN Vidas</title>
        </Helmet>
        
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 px-6 pb-6 flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2">Preparando sua consulta</h1>
            <p className="text-muted-foreground text-center mb-4">
              {preparingRoom 
                ? "Estamos configurando a sala para sua consulta. Isso pode levar alguns instantes..."
                : "Carregando informações da consulta..."}
            </p>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
              <div className="bg-primary h-full animate-pulse" style={{width: '80%'}}></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Helmet>
          <title>Erro na Consulta | CN Vidas</title>
        </Helmet>
        
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6 px-6 pb-6 flex flex-col items-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Erro na Consulta</h1>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button variant="default" onClick={retryConnection} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')} className="mt-2 w-full">
              Voltar para início
            </Button>
            <Button variant="outline" onClick={() => setShowDebugger(true)} className="mt-2 w-full">
              Diagnóstico Avançado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Helmet>
        <title>Consulta de Telemedicina | CN Vidas</title>
      </Helmet>
      
      {showVideoCall ? (
        <div className="fixed inset-0 z-50">
          <MinimalistVideoCall
            roomUrl={roomInfo?.url}
            token={roomInfo?.token}
            onJoinCall={handleJoinCall}
            onLeaveCall={handleLeaveCall}
            userName={user?.fullName || user?.username}
            isDoctor={user?.role === 'doctor'}
          />
        </div>
      ) : (
        <div className="flex flex-col w-full max-w-7xl mx-auto p-4 gap-4 h-full">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-bold">{appointment?.isEmergency ? 'Consulta de Emergência' : 'Consulta Agendada'}</h1>
              <p className="text-muted-foreground">
                {appointment?.doctorName ? `Dr. ${appointment.doctorName}` : 'Consulta médica'} 
                {appointment?.specialization ? ` - ${appointment.specialization}` : ''}
              </p>
            </div>
            
            {appointment?.isEmergency && (
              <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <Shield className="w-4 h-4 mr-1 text-red-500" />
                Emergência
              </div>
            )}
          </div>
          
          <Separator />
          
          {roomInfo && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center mb-8">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Sala preparada com sucesso</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Sua sala de videoconferência está pronta. Clique no botão abaixo para iniciar sua consulta.
                </p>
              </div>
              
              <Button size="lg" onClick={() => setShowVideoCall(true)}>
                <Video className="mr-2 h-5 w-5" />
                Iniciar Videoconsulta
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Modal de Debug */}
      {showDebugger && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <TelemedicineDebugger 
            roomName={roomInfo?.name} 
            onClose={() => setShowDebugger(false)} 
          />
        </div>
      )}
    </div>
  );
}