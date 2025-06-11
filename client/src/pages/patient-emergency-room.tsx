import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, Phone, PhoneOff, Mic, MicOff, VideoIcon, VideoOffIcon, AlertCircle, Clock, User, ShieldAlert, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';

declare global {
  interface Window {
    DailyIframe: any;
  }
}

interface CallState {
  roomUrl: string | null;
  token: string | null;
  appointmentId: number | null;
  isCallActive: boolean;
  isConnecting: boolean;
  doctorJoined: boolean;
  callDuration: number;
  waitingDuration: number;
  error: string | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}

interface Doctor {
  id: number;
  fullName: string;
  specialization: string;
  profileImage?: string;
  availableForEmergency: boolean;
}

export default function PatientEmergencyRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waitingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckRef = useRef<NodeJS.Timeout | null>(null);
  
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showDoctorSelection, setShowDoctorSelection] = useState(true);
  
  const [callState, setCallState] = useState<CallState>({
    roomUrl: null,
    token: null,
    appointmentId: null,
    isCallActive: false,
    isConnecting: false,
    doctorJoined: false,
    callDuration: 0,
    waitingDuration: 0,
    error: null,
    isAudioMuted: false,
    isVideoMuted: false,
  });

  // Buscar médicos disponíveis
  const { data: availableDoctors, isLoading: loadingDoctors } = useQuery({
    queryKey: ['available-doctors'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/doctors/available');
      if (!response.ok) throw new Error('Falha ao buscar médicos');
      return response.json() as Promise<Doctor[]>;
    },
  });

  // Carregar script do Daily.co
  useEffect(() => {
    const loadDailyScript = () => {
      if (window.DailyIframe) {
        console.log('Daily.co já carregado');
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@daily-co/daily-js';
      script.async = true;
      script.onload = () => {
        console.log('✅ Daily.co script carregado');
      };
      script.onerror = () => {
        console.error('❌ Erro ao carregar Daily.co');
        setCallState(prev => ({ ...prev, error: 'Erro ao carregar sistema de vídeo' }));
      };
      document.head.appendChild(script);
    };

    loadDailyScript();

    return () => {
      // Limpar recursos ao desmontar
      if (callFrameRef.current) {
        try {
          callFrameRef.current.destroy();
        } catch (error) {
          console.error('Erro ao destruir call frame:', error);
        }
      }
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    };
  }, []);

  // Timer de espera
  useEffect(() => {
    if (callState.isCallActive && !callState.doctorJoined) {
      waitingTimerRef.current = setInterval(() => {
        setCallState(prev => ({ ...prev, waitingDuration: prev.waitingDuration + 1 }));
      }, 1000);
    } else if (waitingTimerRef.current) {
      clearInterval(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }

    return () => {
      if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
    };
  }, [callState.isCallActive, callState.doctorJoined]);

  // Timer da chamada (quando médico entrar)
  useEffect(() => {
    if (callState.doctorJoined) {
      callTimerRef.current = setInterval(() => {
        setCallState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }));
      }, 1000);
    } else if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState.doctorJoined]);

  // Verificar status da consulta periodicamente
  useEffect(() => {
    if (callState.appointmentId && callState.isCallActive && !callState.doctorJoined) {
      const checkStatus = async () => {
        try {
          const response = await apiRequest('GET', `/api/emergency/v2/status/${callState.appointmentId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.doctorId) {
              setCallState(prev => ({ ...prev, doctorJoined: true }));
              toast({
                title: 'Médico conectado!',
                description: `Dr. ${data.doctorName} entrou na consulta`,
              });
            }
          }
        } catch (error) {
          console.error('Erro ao verificar status:', error);
        }
      };

      // Verificar a cada 3 segundos
      statusCheckRef.current = setInterval(checkStatus, 3000);
      // Verificar imediatamente
      checkStatus();
    }

    return () => {
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    };
  }, [callState.appointmentId, callState.isCallActive, callState.doctorJoined, toast]);

  // Iniciar consulta de emergência
  const startEmergencyCall = async () => {
    if (!selectedDoctor) {
      toast({
        title: 'Selecione um médico',
        description: 'Por favor, escolha um médico antes de iniciar a consulta',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCallState(prev => ({ ...prev, isConnecting: true, error: null }));
      setShowDoctorSelection(false);

      // Criar consulta de emergência com médico específico
      const response = await apiRequest('POST', '/api/emergency/v2/start', {
        doctorId: selectedDoctor.id
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao iniciar consulta');
      }

      const data = await response.json();
      console.log('Consulta criada:', data);

      // Aguardar Daily.co carregar
      if (!window.DailyIframe) {
        throw new Error('Sistema de vídeo não está pronto');
      }

      // Criar call frame
      const callFrame = window.DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
        showLocalVideo: true,
        showParticipantsBar: false,
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
          }));
          toast({
            title: 'Conectado!',
            description: 'Aguardando um médico entrar na sala...',
          });
        })
        .on('participant-joined', (event: any) => {
          console.log('Participante entrou:', event.participant);
          if (event.participant.user_id !== user?.id.toString()) {
            setCallState(prev => ({ ...prev, doctorJoined: true }));
          }
        })
        .on('participant-left', (event: any) => {
          console.log('Participante saiu:', event.participant);
          if (event.participant.user_id !== user?.id.toString() && callState.doctorJoined) {
            toast({
              title: 'Médico desconectou',
              description: 'O médico saiu da consulta',
              variant: 'destructive',
            });
            endCall();
          }
        })
        .on('error', (event: any) => {
          console.error('Erro na chamada:', event);
          setCallState(prev => ({
            ...prev,
            error: event.errorMsg || 'Erro na conexão',
            isConnecting: false,
          }));
        });

      // Entrar na sala
      await callFrame.join({
        url: data.roomUrl,
        token: data.token,
      });

      // Salvar informações da consulta
      setCallState(prev => ({
        ...prev,
        roomUrl: data.roomUrl,
        token: data.token,
        appointmentId: data.appointmentId,
      }));

    } catch (error: any) {
      console.error('Erro ao iniciar consulta:', error);
      setCallState(prev => ({
        ...prev,
        error: error.message || 'Erro ao iniciar consulta',
        isConnecting: false,
      }));
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível iniciar a consulta',
        variant: 'destructive',
      });
    }
  };

  // Finalizar consulta
  const endCall = async () => {
    try {
      // Enviar finalização para o backend
      if (callState.appointmentId) {
        await apiRequest('POST', `/api/emergency/v2/end/${callState.appointmentId}`, {
          duration: callState.callDuration,
        });
      }

      // Destruir call frame
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }

      // Limpar timers
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);

      // Resetar estado
      setCallState({
        roomUrl: null,
        token: null,
        appointmentId: null,
        isCallActive: false,
        isConnecting: false,
        doctorJoined: false,
        callDuration: 0,
        waitingDuration: 0,
        error: null,
        isAudioMuted: false,
        isVideoMuted: false,
      });

      toast({
        title: 'Consulta finalizada',
        description: 'Sua consulta de emergência foi encerrada',
      });

      // Redirecionar para dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao finalizar consulta:', error);
    }
  };

  // Controles de áudio/vídeo
  const toggleAudio = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!callState.isAudioMuted);
      setCallState(prev => ({ ...prev, isAudioMuted: !prev.isAudioMuted }));
    }
  };

  const toggleVideo = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!callState.isVideoMuted);
      setCallState(prev => ({ ...prev, isVideoMuted: !prev.isVideoMuted }));
    }
  };

  // Formatar duração
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Renderização quando há erro
  if (callState.error && !callState.isCallActive) {
    return (
      <div className="container max-w-4xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro na Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{callState.error}</AlertDescription>
            </Alert>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => window.location.reload()}>
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={() => navigate('/telemedicine')}>
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Renderização principal
  return (
    <div className="container max-w-6xl mx-auto p-4">
      {/* Seleção de médico */}
      {showDoctorSelection && !callState.isCallActive && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Selecione um Médico para Atendimento de Emergência
            </CardTitle>
            <CardDescription>
              Escolha o médico disponível para sua consulta de emergência
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDoctors ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : availableDoctors && availableDoctors.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {availableDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedDoctor?.id === doctor.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {doctor.profileImage ? (
                          <img
                            src={doctor.profileImage}
                            alt={doctor.fullName}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{doctor.fullName}</h3>
                        <p className="text-sm text-muted-foreground">{doctor.specialization}</p>
                      </div>
                      {selectedDoctor?.id === doctor.id && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhum médico disponível</AlertTitle>
                <AlertDescription>
                  Não há médicos disponíveis para emergência no momento. Por favor, tente novamente em alguns minutos.
                </AlertDescription>
              </Alert>
            )}

            {selectedDoctor && (
              <div className="mt-6 flex justify-end">
                <Button
                  size="lg"
                  onClick={startEmergencyCall}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!selectedDoctor || callState.isConnecting}
                >
                  {callState.isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Iniciar Consulta com {selectedDoctor.fullName}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card da chamada */}
      {(!showDoctorSelection || callState.isCallActive) && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  Atendimento de Emergência
                </CardTitle>
                <CardDescription>
                  {selectedDoctor && `Dr. ${selectedDoctor.fullName} - ${selectedDoctor.specialization}`}
                </CardDescription>
              </div>
            {callState.isCallActive && (
              <div className="flex items-center gap-4">
                {callState.doctorJoined ? (
                  <Badge variant="default" className="bg-green-500">
                    <Video className="h-3 w-3 mr-1" />
                    Médico Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="animate-pulse">
                    <Clock className="h-3 w-3 mr-1" />
                    Aguardando Médico
                  </Badge>
                )}
                <div className="text-sm text-muted-foreground">
                  {callState.doctorJoined ? (
                    <span>Duração: {formatDuration(callState.callDuration)}</span>
                  ) : (
                    <span>Esperando: {formatDuration(callState.waitingDuration)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>

          {callState.isConnecting && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Conectando...</p>
              <p className="text-sm text-muted-foreground">Preparando sua sala de consulta</p>
            </div>
          )}

          {callState.isCallActive && (
            <div className="space-y-4">
              {!callState.doctorJoined && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Aguardando médico</AlertTitle>
                  <AlertDescription>
                    Um médico será notificado e entrará em breve. Por favor, aguarde.
                  </AlertDescription>
                </Alert>
              )}

              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden" ref={containerRef}>
                {/* O Daily.co iframe será inserido aqui */}
              </div>

              <div className="flex justify-center gap-2">
                <Button
                  variant={callState.isAudioMuted ? "destructive" : "secondary"}
                  size="icon"
                  onClick={toggleAudio}
                >
                  {callState.isAudioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant={callState.isVideoMuted ? "destructive" : "secondary"}
                  size="icon"
                  onClick={toggleVideo}
                >
                  {callState.isVideoMuted ? <VideoOffIcon className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={endCall}
                >
                  <PhoneOff className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Informações adicionais */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Paciente:</span>
              <span>{user?.fullName || user?.username}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Horário:</span>
              <span>{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Tipo:</span>
              <span>Emergência Médica</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}