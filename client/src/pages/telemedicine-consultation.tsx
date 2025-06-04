import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import DailyIframe from '@daily-co/daily-js';
import { Helmet } from 'react-helmet';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
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
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [participants, setParticipants] = useState(0);
  const [doctorPresent, setDoctorPresent] = useState(false);
  const [roomInfo, setRoomInfo] = useState<{
    url: string;
    token?: string;
    name: string;
  } | null>(null);
  
  // Controls
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  
  // Refs
  const callFrameRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Logging de diagnóstico
  const logEvent = (message: string, data?: any) => {
    if (mountedRef.current) {
      console.log(`[Telemedicine] ${message}`, data);
    }
  };
  

  
  // Função para notificar o médico que o paciente está na sala de espera
  const notifyDoctorAboutWaitingPatient = async () => {
    try {
      if (!appointmentId || !appointment) return;
      
      logEvent('Enviando notificação ao médico sobre paciente em espera');
      
      const response = await apiRequest('POST', `/api/notifications/create`, {
        userId: appointment.doctorId, // ID do médico
        type: 'telemedicine',
        title: 'Paciente em Espera',
        message: `Paciente ${user?.fullName || user?.username} está na sala de telemedicina aguardando atendimento.`,
        data: {
          appointmentId: appointmentId,
          roomName: roomInfo?.name
        }
      });
      
      if (response.ok) {
        logEvent('Notificação enviada ao médico com sucesso');
      } else {
        logEvent('Erro ao enviar notificação ao médico:', await response.text());
      }
    } catch (error) {
      console.error('Erro ao enviar notificação para o médico:', error);
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
      cleanupCall();
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
      
      // Dar um tempo para propagação da sala
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const verifyResponse = await apiRequest('GET', 
        `/api/telemedicine/daily-direct/room-exists?roomName=${roomName}`);
      
      const verifyData = await verifyResponse.json();
      logEvent('Verificação de sala:', verifyData);
      
      if (!verifyData.exists) {
        logEvent('Sala não está pronta. Aguardando propagação...');
        // Aguardar propagação extra
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verificar novamente
        const retryVerify = await apiRequest('GET', 
          `/api/telemedicine/daily-direct/room-exists?roomName=${roomName}`);
        
        const retryData = await retryVerify.json();
        if (!retryData.exists) {
          logEvent('Sala ainda não propagada após tempo extra');
        } else {
          logEvent('Sala propagada com sucesso após tempo extra');
        }
      }
      
      // ETAPA 3: Gerar token de acesso
      logEvent('Gerando token de acesso...');
      const userName = user?.fullName || user?.username || 'Usuário CN Vidas';
      
      const tokenResponse = await apiRequest('POST', '/api/telemedicine/daily-direct/token', {
        roomName,
        userName,
        isOwner: false
      });
      
      if (!tokenResponse.ok) {
        logEvent('Falha ao gerar token, tentando sem token');
        setRoomInfo({
          name: roomName,
          url: `https://cnvidas.daily.co/${roomName}`,
          token: undefined
        });
      } else {
        const tokenData = await tokenResponse.json();
        logEvent('Token gerado com sucesso');
        
        setRoomInfo({
          name: roomName,
          url: `https://cnvidas.daily.co/${roomName}`,
          token: tokenData.token || undefined
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
  
  // Iniciar a chamada
  const startCall = async () => {
    if (!roomInfo || !videoContainerRef.current) {
      toast({
        title: "Erro",
        description: "Informações da sala não estão disponíveis",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setJoiningRoom(true);
      logEvent(`Iniciando chamada para sala: ${roomInfo.name}`);
      
      // Configuração do Daily.co seguindo as melhores práticas
      const dailyOptions = {
        url: roomInfo.url,
        token: roomInfo.token,
        showLeaveButton: false,
        showFullscreenButton: true,
        userName: user?.fullName || user?.username || 'Usuário CN Vidas',
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
        }
      };
      
      logEvent('Configuração da chamada:', dailyOptions);
      
      // Cleanup anterior se necessário
      if (callFrameRef.current) {
        logEvent('Limpando instância anterior do callFrame');
        try {
          callFrameRef.current.destroy();
        } catch (e) {
          logEvent('Erro ao destruir callFrame:', e);
        }
        callFrameRef.current = null;
        
        // Aguardar um momento para garantir limpeza completa
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Verificar se há iframes residuais
      if (videoContainerRef.current) {
        const existingIframes = videoContainerRef.current.querySelectorAll('iframe');
        if (existingIframes.length > 0) {
          logEvent(`Removendo ${existingIframes.length} iframes residuais`);
          existingIframes.forEach(iframe => iframe.remove());
          // Aguardar um momento para garantir limpeza
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Criar frame usando a API recomendada
      const callFrame = DailyIframe.createFrame(
        videoContainerRef.current,
        dailyOptions
      );
      
      // Registrar event handlers com padrão recomendado
      callFrame
        .on('loaded', () => {
          logEvent('Frame carregado');
        })
        .on('joining-meeting', () => {
          logEvent('Entrando na reunião...');
        })
        .on('joined-meeting', () => {
          logEvent('Entrou na reunião');
          if (mountedRef.current) {
            setJoiningRoom(false);
            setCallActive(true);
            setParticipants(callFrame.participantCounts().present);
            
            // Registrar uso bem-sucedido
            apiRequest('POST', '/api/telemedicine/diagnostics/log', {
              event: 'join-success',
              roomName: roomInfo.name,
              appointmentId
            }).catch(e => console.error('Erro ao registrar diagnóstico:', e));
          }
        })
        .on('participant-joined', (event) => {
          logEvent('Participante entrou', event);
          if (mountedRef.current && callFrame) {
            const counts = callFrame.participantCounts();
            setParticipants(counts.present);
            
            // Verificar se o participante é um médico
            const participants = callFrame.participants();
            const isDoctorPresent = Object.values(participants).some(
              (p: any) => p.user_name && p.user_name.includes('Dr.')
            );
            
            if (isDoctorPresent && !doctorPresent) {
              setDoctorPresent(true);
              toast({
                title: "Médico Conectado",
                description: "O médico entrou na consulta",
              });
            }
            
            // Se o usuário é um paciente e é o primeiro a entrar, notificar o médico
            if (user?.role === 'patient' && counts.present === 1 && !isDoctorPresent) {
              notifyDoctorAboutWaitingPatient();
            }
          }
        })
        .on('participant-left', (event) => {
          logEvent('Participante saiu', event);
          if (mountedRef.current && callFrame) {
            const counts = callFrame.participantCounts();
            setParticipants(counts.present);
            
            // Verificar se ainda há médicos presentes
            const participants = callFrame.participants();
            const isDoctorPresent = Object.values(participants).some(
              (p: any) => p.user_name && p.user_name.includes('Dr.')
            );
            
            if (!isDoctorPresent && doctorPresent) {
              setDoctorPresent(false);
              toast({
                title: "Médico Desconectado",
                description: "O médico saiu da consulta",
                variant: "destructive"
              });
            }
          }
        })
        .on('error', (error) => {
          logEvent('Erro na chamada:', error);
          
          if (error?.error?.type === 'no-room') {
            handleRoomNotFound();
          } else {
            if (mountedRef.current) {
              setError(`Erro na videochamada: ${error.errorMsg || 'Erro desconhecido'}`);
              toast({
                title: "Erro na Videochamada",
                description: error.errorMsg || 'Ocorreu um erro durante a videochamada',
                variant: "destructive"
              });
            }
          }
        })
        .on('left-meeting', (event) => {
          logEvent('Saiu da reunião', event);
          if (mountedRef.current) {
            setCallActive(false);
            cleanupCall();
          }
        });
      
      // Armazenar referência ao callFrame
      callFrameRef.current = callFrame;
      
      // Iniciar a reunião
      await callFrame.join();
      
      // Garantir que está configurado corretamente
      if (isMicOn) {
        callFrame.setLocalAudio(true);
      } else {
        callFrame.setLocalAudio(false);
      }
      
      if (isCameraOn) {
        callFrame.setLocalVideo(true);
      } else {
        callFrame.setLocalVideo(false);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logEvent('Erro ao iniciar chamada:', errorMessage);
      setError('Não foi possível iniciar a videochamada: ' + errorMessage);
      setJoiningRoom(false);
      
      toast({
        title: "Falha na Conexão",
        description: "Não foi possível iniciar a videochamada: " + errorMessage,
        variant: "destructive"
      });
    }
  };

  // Lidar com sala não encontrada
  const handleRoomNotFound = async () => {
    logEvent('Sala não encontrada, tentando recuperação');
    
    if (mountedRef.current) {
      setError('A sala de videoconferência não foi encontrada. Tentando recuperar...');
      cleanupCall();
      
      // Tentar criar a sala novamente com força máxima
      try {
        toast({
          title: "Recuperando Conexão",
          description: "A sala não foi encontrada. Tentando criar novamente...",
        });
        
        const roomName = roomInfo?.name;
        if (!roomName) throw new Error('Nome da sala não disponível');
        
        // Forçar criação com alta prioridade
        await apiRequest('POST', '/api/telemedicine/daily-direct/create-room', {
          roomName,
          forceCreate: true,
          expiryHours: 5,
          highPriority: true
        });
        
        // Aguardar propagação extendida
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        if (mountedRef.current) {
          toast({
            title: "Sala Recuperada",
            description: "Tentando conectar novamente...",
          });
          
          // Tentar entrar novamente
          startCall();
        }
      } catch (recoveryError) {
        if (mountedRef.current) {
          const errorMsg = recoveryError instanceof Error ? recoveryError.message : 'Erro desconhecido';
          setError('Falha na recuperação da sala: ' + errorMsg);
          
          toast({
            title: "Falha na Recuperação",
            description: "Não foi possível recuperar a sala. Tente novamente mais tarde.",
            variant: "destructive"
          });
        }
      }
    }
  };
  
  // Limpar chamada - esta é a implementação principal
  const cleanupCall = () => {
    if (callFrameRef.current) {
      logEvent('Limpando instância do callFrame');
      try {
        callFrameRef.current.destroy();
      } catch (e) {
        logEvent('Erro ao destruir callFrame:', e);
      }
      
      callFrameRef.current = null;
      
      // Verificar por iframes residuais
      if (videoContainerRef.current) {
        const iframes = videoContainerRef.current.querySelectorAll('iframe');
        if (iframes.length > 0) {
          logEvent(`Removendo ${iframes.length} iframes residuais`);
          iframes.forEach(iframe => iframe.remove());
        }
      }
    }
  };
  
  // Funções de controle da chamada
  const toggleMic = () => {
    if (callFrameRef.current) {
      const newState = !isMicOn;
      callFrameRef.current.setLocalAudio(newState);
      setIsMicOn(newState);
    }
  };
  
  const toggleCamera = () => {
    if (callFrameRef.current) {
      const newState = !isCameraOn;
      callFrameRef.current.setLocalVideo(newState);
      setIsCameraOn(newState);
    }
  };
  
  const leaveCall = () => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
    
    setCallActive(false);
    cleanupCall();
    navigate('/');
  };
  
  // Tentar novamente em caso de erro
  const retryConnection = () => {
    setError(null);
    startCall();
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
        
        {!callActive && !joiningRoom && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center mb-8">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Sala preparada com sucesso</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Sua sala de videoconferência está pronta. Clique no botão abaixo para iniciar sua consulta.
              </p>
            </div>
            
            <Button size="lg" onClick={startCall}>
              <Video className="mr-2 h-5 w-5" />
              Iniciar Videoconsulta
            </Button>
          </div>
        )}
        
        {joiningRoom && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-bold mb-2">Conectando à sala...</h2>
            <p className="text-muted-foreground">Por favor, aguarde enquanto estabelecemos a conexão.</p>
          </div>
        )}
        
        <div 
          ref={videoContainerRef} 
          className={`flex-1 rounded-lg overflow-hidden relative bg-black min-h-[500px] ${
            callActive ? 'block' : 'hidden'
          }`}
        >
          {/* O Daily.co vai montar o iframe aqui */}
        </div>
        
        {callActive && (
          <div className="flex justify-center py-4 gap-2">
            <Button
              variant={isMicOn ? "outline" : "destructive"}
              size="lg"
              className="rounded-full w-12 h-12 p-0"
              onClick={toggleMic}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            
            <Button
              variant={isCameraOn ? "outline" : "destructive"}
              size="lg"
              className="rounded-full w-12 h-12 p-0"
              onClick={toggleCamera}
            >
              {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-14 h-14 p-0"
              onClick={leaveCall}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}