import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, 
  PhoneOff, 
  VideoIcon, 
  VideoOffIcon, 
  Mic, 
  MicOff, 
  ShieldAlert,
  Clock,
  User,
  Star,
  AlertCircle,
  Stethoscope,
  Calendar
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Declaração global para Daily.co
declare global {
  interface Window {
    DailyIframe: any;
  }
}

interface VideoCallState {
  roomUrl: string | null;
  token: string | null;
  isCallActive: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  participants: any[];
  callDuration: number;
  isConnecting: boolean;
  error: string | null;
}

export default function TelemedicinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const { appointmentId } = useParams();
  
  // Se tiver appointmentId na URL, é uma consulta específica
  if (appointmentId) {
    return <TelemedicineCallPage appointmentId={appointmentId} />;
  }
  
  // Página principal de telemedicina
  return (
    <div className="container max-w-6xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Telemedicina</h1>
        <p className="text-muted-foreground">
          Consulte médicos especialistas de forma rápida e segura por videochamada
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card de Atendimento de Emergência */}
        <Card className="border-red-200 hover:border-red-300 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Atendimento de Emergência
            </CardTitle>
            <CardDescription>
              Conecte-se imediatamente com um médico para situações urgentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                Atendimento imediato
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                Médicos de plantão 24/7
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                Para situações urgentes
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={() => navigate('/emergency-room')}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              Iniciar Consulta de Emergência
            </Button>
          </CardFooter>
        </Card>

        {/* Card de Consultas Agendadas */}
        <Card className="border-blue-200 hover:border-blue-300 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Consultas Agendadas
            </CardTitle>
            <CardDescription>
              Agende uma consulta com seu médico de preferência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                Escolha o melhor horário
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                Diversos especialistas
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                Consultas programadas
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => navigate('/appointments')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Ver Minhas Consultas
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Informações importantes */}
      <Card className="mt-8 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800">Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-yellow-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Para emergências médicas graves, ligue imediatamente para <strong>192 (SAMU)</strong> ou 
                dirija-se ao pronto-socorro mais próximo.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                As consultas de emergência são cobradas conforme seu plano de assinatura. 
                Verifique seu saldo de consultas disponíveis.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Tenha em mãos seus documentos e informações médicas relevantes para 
                agilizar o atendimento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente separado para a chamada de vídeo
function TelemedicineCallPage({ appointmentId }: { appointmentId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  // Referências
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado do Daily.co
  const [callState, setCallState] = useState<VideoCallState>({
    roomUrl: null,
    token: null,
    isCallActive: false,
    isAudioMuted: false,
    isVideoMuted: false,
    participants: [],
    callDuration: 0,
    isConnecting: false,
    error: null,
  });

  // Buscar dados da consulta
  const { data: appointment, isLoading: isLoadingAppointment } = useQuery({
    queryKey: ['/api/appointments', appointmentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/appointments/${appointmentId}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar consulta');
      }
      return response.json();
    },
    enabled: !!appointmentId,
  });

  // Carregar script do Daily.co
  useEffect(() => {
    const loadDailyScript = () => {
      if (window.DailyIframe) {
        console.log('Daily.co já carregado');
        return;
      }

      console.log('Carregando script Daily.co...');
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@daily-co/daily-js';
      script.async = true;
      script.onload = () => {
        console.log('✅ Daily.co script carregado com sucesso');
      };
      script.onerror = () => {
        console.error('❌ Erro ao carregar Daily.co script');
        setCallState(prev => ({ ...prev, error: 'Erro ao carregar biblioteca de vídeo' }));
      };
      document.head.appendChild(script);
    };

    loadDailyScript();

    return () => {
      console.log('Limpando recursos...');
      if (callFrameRef.current) {
        try {
          callFrameRef.current.destroy();
          callFrameRef.current = null;
        } catch (error) {
          console.error('Erro ao limpar call frame:', error);
        }
      }
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
    };
  }, []);

  // Timer da chamada
  useEffect(() => {
    if (callState.isCallActive) {
      durationRef.current = setInterval(() => {
        setCallState(prev => ({
          ...prev,
          callDuration: prev.callDuration + 1
        }));
      }, 1000);
    }
    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
      }
    };
  }, [callState.isCallActive]);

  // Função para inicializar a chamada
  const initializeCall = useCallback(async () => {
    if (!appointmentId) return;

    try {
      setCallState(prev => ({ ...prev, isConnecting: true, error: null }));

      // 1. Criar/obter sala
      const roomResponse = await apiRequest('POST', '/api/telemedicine/room', {
        appointmentId
      });

      if (!roomResponse.ok) {
        throw new Error('Falha ao criar sala de videoconferência');
      }

      const roomData = await roomResponse.json();

      // 2. Obter token
      const tokenResponse = await apiRequest('POST', '/api/telemedicine/token', {
        roomName: roomData.name,
        userName: user?.fullName || user?.username || 'Usuário',
        isOwner: user?.role === 'doctor'
      });

      if (!tokenResponse.ok) {
        throw new Error('Falha ao obter token de acesso');
      }

      const tokenData = await tokenResponse.json();

      // 3. Inicializar call frame
      if (!window.DailyIframe) {
        throw new Error('Biblioteca Daily.co não carregada');
      }

      const callFrame = window.DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '400px',
          border: 'none',
          borderRadius: '8px',
        },
        showLeaveButton: true,
        showFullscreenButton: true,
        showLocalVideo: true,
        showParticipantsBar: true,
      });

      callFrameRef.current = callFrame;

      // Configurar eventos
      callFrame
        .on('joined-meeting', () => {
          console.log('✅ Conectado à sala');
          setCallState(prev => ({
            ...prev,
            isCallActive: true,
            isConnecting: false,
            roomUrl: roomData.url
          }));
        })
        .on('left-meeting', () => {
          console.log('👋 Desconectado da sala');
          endCall();
        })
        .on('participant-joined', (event: any) => {
          console.log('👥 Participante entrou:', event.participant);
          updateParticipants(callFrame);
        })
        .on('participant-left', (event: any) => {
          console.log('👋 Participante saiu:', event.participant);
          updateParticipants(callFrame);
        })
        .on('error', (event: any) => {
          console.error('❌ Erro na chamada:', event);
          setCallState(prev => ({
            ...prev,
            error: event.errorMsg || 'Erro na conexão'
          }));
        });

      // Entrar na sala
      await callFrame.join({
        url: roomData.url,
        token: tokenData.token,
        userName: user?.fullName || user?.username || 'Usuário'
      });

    } catch (error: any) {
      console.error('Erro ao inicializar chamada:', error);
      setCallState(prev => ({
        ...prev,
        error: error.message || 'Erro ao conectar à videoconferência',
        isConnecting: false
      }));
      toast({
        title: 'Erro de conexão',
        description: error.message || 'Não foi possível conectar à videoconferência',
        variant: 'destructive',
      });
    }
  }, [appointmentId, user, toast]);

  // Função para atualizar lista de participantes
  const updateParticipants = (callFrame: any) => {
    if (callFrame) {
      const participants = callFrame.participants();
      setCallState(prev => ({
        ...prev,
        participants: Object.values(participants || {})
      }));
    }
  };

  // Função para encerrar chamada
  const endCall = useCallback(() => {
    if (callFrameRef.current) {
      try {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      } catch (error) {
        console.error('Erro ao encerrar chamada:', error);
      }
    }

    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    setCallState(prev => ({
      ...prev,
      isCallActive: false,
      callDuration: 0,
      participants: []
    }));

    // Redirecionar após encerrar
    navigate('/appointments');
  }, [navigate]);

  // Inicializar chamada quando a consulta for carregada
  useEffect(() => {
    if (appointment && !callState.isCallActive && !callState.isConnecting) {
      initializeCall();
    }
  }, [appointment, initializeCall]);

  // Formatar duração da chamada
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoadingAppointment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Progress value={33} className="w-[60%]" />
      </div>
    );
  }

  if (callState.error) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Erro na Conexão
          </CardTitle>
          <CardDescription>
            Não foi possível conectar à videoconferência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{callState.error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => navigate('/appointments')}>
              Voltar para Consultas
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Consulta Online</CardTitle>
          <CardDescription>
            {appointment?.isEmergency ? 'Consulta de Emergência' : 'Consulta Regular'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(callState.callDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{callState.participants.length} participantes</span>
            </div>
          </div>
          
          <div ref={containerRef} className="w-full aspect-video bg-black rounded-lg overflow-hidden">
            {callState.isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Progress value={66} className="w-[60%]" />
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4 mt-4">
            <Button
              variant={callState.isAudioMuted ? "destructive" : "default"}
              size="icon"
              onClick={() => {
                if (callFrameRef.current) {
                  callFrameRef.current.setLocalAudio(!callState.isAudioMuted);
                  setCallState(prev => ({
                    ...prev,
                    isAudioMuted: !prev.isAudioMuted
                  }));
                }
              }}
            >
              {callState.isAudioMuted ? <MicOff /> : <Mic />}
            </Button>
            
            <Button
              variant={callState.isVideoMuted ? "destructive" : "default"}
              size="icon"
              onClick={() => {
                if (callFrameRef.current) {
                  callFrameRef.current.setLocalVideo(!callState.isVideoMuted);
                  setCallState(prev => ({
                    ...prev,
                    isVideoMuted: !prev.isVideoMuted
                  }));
                }
              }}
            >
              {callState.isVideoMuted ? <VideoOffIcon /> : <VideoIcon />}
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              onClick={endCall}
            >
              <PhoneOff />
            </Button>
          </div>
        </CardContent>
      </Card>

      {appointment?.isEmergency && (
        <Alert className="mb-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Consulta de Emergência</AlertTitle>
          <AlertDescription>
            Esta é uma consulta de emergência. O médico será notificado imediatamente.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}