import { useState, useEffect, useRef } from 'react';
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
  Star
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// Declaração global para Daily.co
declare global {
  interface Window {
    DailyIframe: any;
  }
}

// Tipos
type Doctor = {
  id: number;
  userId: number;
  specialization: string;
  licenseNumber: string;
  biography?: string;
  education?: string;
  experienceYears?: number;
  availableForEmergency: boolean;
  consultationFee?: number;
  profileImage?: string;
  avatarUrl?: string;
  status?: string;
  name?: string;
  username?: string;
  email?: string;
};

type DailyCallState = {
  roomUrl: string | null;
  callFrame: any | null;
  isCallActive: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  participants: any[];
  callDuration: number;
  isConnecting: boolean;
  error: string | null;
};

export default function TelemedicinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  // Referências
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Estado do Daily.co
  const [callState, setCallState] = useState<DailyCallState>({
    roomUrl: null,
    callFrame: null,
    isCallActive: false,
    isAudioMuted: false,
    isVideoMuted: false,
    participants: [],
    callDuration: 0,
    isConnecting: false,
    error: null,
  });
  
  // Estados de carregamento
  const [isCreatingEmergency, setIsCreatingEmergency] = useState(false);
  
  // Buscar médicos disponíveis para emergência
  const { data: emergencyDoctors, isLoading: isLoadingEmergencyDoctors } = useQuery({
    queryKey: ['/api/doctors/available'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/doctors/available');
      if (!response.ok) {
        throw new Error('Failed to load emergency doctors');
      }
      return response.json();
    },
  });
  
  // Carregar o SDK do Daily.co
  useEffect(() => {
    const loadDailyScript = async () => {
      if (window.DailyIframe) return;
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@daily-co/daily-js';
      script.async = true;
      document.head.appendChild(script);
      
      script.onload = () => {
        console.log('Daily.co SDK carregado com sucesso');
      };
      
      script.onerror = () => {
        console.error('Erro ao carregar Daily.co SDK');
        setCallState(prev => ({ ...prev, error: 'Erro ao carregar SDK de videochamada' }));
      };
      
      document.head.appendChild(script);
    };
    
    loadDailyScript();
  }, []);

  // Timer da chamada
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.isCallActive) {
      interval = setInterval(() => {
        setCallState(prev => ({
          ...prev,
          callDuration: prev.callDuration + 1
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.isCallActive]);

  // Função para criar uma sala Daily.co
  const createDailyRoom = async (): Promise<{ url: string; token?: string }> => {
    try {
      const response = await apiRequest('POST', '/api/daily/create-room', {
        privacy: 'private',
        properties: {
          max_participants: 2,
          enable_chat: true,
          enable_knocking: false,
          enable_screenshare: true,
          enable_recording: false,
          start_cloud_recording: false,
          enable_dialin: false,
          owner_only_broadcast: false,
          enable_prejoin_ui: false,
          enable_network_ui: true,
          enable_video_processing_ui: true,
          lang: 'pt',
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao criar sala de videochamada');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao criar sala Daily:', error);
      throw new Error('Não foi possível criar a sala de videochamada');
    }
  };

  // Função para inicializar o call frame do Daily.co
  const initializeCallFrame = async (roomUrl: string, token?: string) => {
    if (!window.DailyIframe) {
      throw new Error('Daily.co SDK não está carregado');
    }

    try {
      // Destruir call frame existente
      if (callFrameRef.current) {
        await callFrameRef.current.destroy();
      }

      // Criar novo call frame
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

      // Event listeners
      callFrame
        .on('joined-meeting', (event: any) => {
          console.log('Entrou na reunião:', event);
          setCallState(prev => ({
            ...prev,
            isCallActive: true,
            isConnecting: false,
            error: null,
          }));
        })
        .on('left-meeting', (event: any) => {
          console.log('Saiu da reunião:', event);
          setCallState(prev => ({
            ...prev,
            isCallActive: false,
            callDuration: 0,
            participants: [],
          }));
        })
        .on('participant-joined', (event: any) => {
          console.log('Participante entrou:', event);
          updateParticipants(callFrame);
        })
        .on('participant-left', (event: any) => {
          console.log('Participante saiu:', event);
          updateParticipants(callFrame);
        })
        .on('error', (event: any) => {
          console.error('Erro no Daily.co:', event);
          setCallState(prev => ({
            ...prev,
            error: 'Erro na videochamada: ' + event.errorMsg,
            isConnecting: false,
          }));
        })
        .on('camera-error', (event: any) => {
          console.error('Erro na câmera:', event);
          toast({
            title: 'Erro na câmera',
            description: 'Não foi possível acessar sua câmera. Verifique as permissões.',
            variant: 'destructive',
          });
        })
        .on('mic-error', (event: any) => {
          console.error('Erro no microfone:', event);
          toast({
            title: 'Erro no microfone',
            description: 'Não foi possível acessar seu microfone. Verifique as permissões.',
            variant: 'destructive',
          });
        });

      // Entrar na sala
      const joinOptions: any = { url: roomUrl };
      if (token) {
        joinOptions.token = token;
      }

      await callFrame.join(joinOptions);

      setCallState(prev => ({
        ...prev,
        roomUrl,
        callFrame,
      }));

    } catch (error) {
      console.error('Erro ao inicializar call frame:', error);
      setCallState(prev => ({
        ...prev,
        error: 'Erro ao inicializar videochamada',
        isConnecting: false,
      }));
    }
  };

  // Atualizar lista de participantes
  const updateParticipants = (callFrame: any) => {
    if (callFrame) {
      const participants = callFrame.participants();
      setCallState(prev => ({
        ...prev,
        participants: Object.values(participants || {}),
      }));
    }
  };

  // Função para iniciar consulta de emergência
  const startEmergencyConsultation = async (doctorId?: number) => {
    try {
      setIsCreatingEmergency(true);
      setCallState(prev => ({ ...prev, isConnecting: true, error: null }));

      // 1. Criar consulta de emergência no backend
      const emergencyResponse = await apiRequest('POST', '/api/appointments/emergency', {
        doctorId: doctorId || null,
        type: 'emergency'
      });

      if (!emergencyResponse.ok) {
        throw new Error('Falha ao criar consulta de emergência');
      }

      const emergencyData = await emergencyResponse.json();

      // 2. Criar sala Daily.co
      const roomData = await createDailyRoom();

      // 3. Inicializar videochamada
      await initializeCallFrame(roomData.url, roomData.token);

      toast({
        title: 'Consulta de emergência iniciada',
        description: 'Aguarde um médico entrar na sala...',
      });

    } catch (error: any) {
      console.error('Erro ao iniciar consulta de emergência:', error);
      setCallState(prev => ({
        ...prev,
        error: error.message,
        isConnecting: false,
      }));
      toast({
        title: 'Erro ao iniciar consulta',
        description: error.message || 'Não foi possível iniciar a consulta de emergência.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingEmergency(false);
    }
  };

  // Funções de controle da chamada
  const toggleAudio = () => {
    if (callFrameRef.current) {
      const newMutedState = !callState.isAudioMuted;
      callFrameRef.current.setLocalAudio(!newMutedState);
      setCallState(prev => ({ ...prev, isAudioMuted: newMutedState }));
    }
  };

  const toggleVideo = () => {
    if (callFrameRef.current) {
      const newMutedState = !callState.isVideoMuted;
      callFrameRef.current.setLocalVideo(!newMutedState);
      setCallState(prev => ({ ...prev, isVideoMuted: newMutedState }));
    }
  };

  const leaveCall = async () => {
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      await callFrameRef.current.destroy();
      callFrameRef.current = null;
    }
    setCallState(prev => ({
      ...prev,
      roomUrl: null,
      callFrame: null,
      isCallActive: false,
      callDuration: 0,
      participants: [],
      isConnecting: false,
      error: null,
    }));
  };

  // Formatar duração da chamada
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, []);

  // Se estiver em uma chamada ativa, mostrar a interface da videochamada
  if (callState.isCallActive || callState.isConnecting) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header da chamada */}
          <div className="flex justify-between items-center mb-4 bg-card p-4 rounded-lg border">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">
                  {callState.isConnecting ? 'Conectando...' : 'Consulta de Emergência'}
                </span>
              </div>
              {callState.isCallActive && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(callState.callDuration)}</span>
                </div>
              )}
            </div>
            
            {/* Participantes */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <User className="h-4 w-4" />
                <span className="text-sm">{callState.participants.length + 1}</span>
              </div>
            </div>
          </div>

          {/* Erro se houver */}
          {callState.error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{callState.error}</p>
            </div>
          )}

          {/* Container da videochamada */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '70vh' }}>
            <div ref={containerRef} className="w-full h-full" />
            
            {callState.isConnecting && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
                  <p>Conectando à videochamada...</p>
                </div>
              </div>
            )}
          </div>

          {/* Controles da chamada */}
          <div className="flex justify-center items-center space-x-4 mt-6">
            <Button
              variant={callState.isAudioMuted ? "destructive" : "outline"}
              size="lg"
              onClick={toggleAudio}
              className="rounded-full h-12 w-12 p-0"
            >
              {callState.isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            
            <Button
              variant={callState.isVideoMuted ? "destructive" : "outline"}
              size="lg"
              onClick={toggleVideo}
              className="rounded-full h-12 w-12 p-0"
            >
              {callState.isVideoMuted ? <VideoOffIcon className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
            </Button>
            
            <Button
              variant="destructive"
              size="lg"
              onClick={leaveCall}
              className="rounded-full h-12 w-12 p-0"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Interface principal - seleção de médicos
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Telemedicina</h1>
          
          <Button 
            size="lg" 
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => startEmergencyConsultation()}
            disabled={isCreatingEmergency}
          >
            {isCreatingEmergency ? (
              <>Iniciando consulta...</>
            ) : (
              <>
                <ShieldAlert className="mr-2 h-5 w-5" />
                Consulta de Emergência
              </>
            )}
          </Button>
        </div>
        
        {/* Lista de médicos disponíveis */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Médicos Disponíveis</h2>
          
          {isLoadingEmergencyDoctors ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-muted rounded-full" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-muted rounded" />
                      <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-9 w-full bg-muted rounded" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : emergencyDoctors && emergencyDoctors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emergencyDoctors.map((doctor: Doctor) => (
                <Card key={doctor.id}>
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarImage 
                          src={doctor.profileImage?.startsWith('data:') 
                            ? doctor.profileImage 
                            : doctor.profileImage 
                              ? `${doctor.profileImage}`
                              : ''
                          } 
                          alt={doctor.name} 
                        />
                        <AvatarFallback>
                          {doctor.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{doctor.name}</CardTitle>
                        <CardDescription>{doctor.specialization}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CRM:</span>
                        <span>{doctor.licenseNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Experiência:</span>
                        <span>{doctor.experienceYears} anos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor consulta:</span>
                        <span>R$ {doctor.consultationFee ? doctor.consultationFee.toFixed(2) : '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="secondary" className="text-green-600">Disponível</Badge>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full"
                      onClick={() => startEmergencyConsultation(doctor.id)}
                      disabled={isCreatingEmergency}
                    >
                      {isCreatingEmergency ? 'Iniciando...' : 'Iniciar Consulta de Emergência'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center p-6">
                <p className="text-muted-foreground mb-2">Nenhum médico disponível no momento</p>
                <p className="text-sm">Tente novamente mais tarde</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}