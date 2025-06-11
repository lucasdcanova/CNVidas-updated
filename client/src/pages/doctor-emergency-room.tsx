import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Video, PhoneOff, Mic, MicOff, VideoIcon, VideoOffIcon, AlertCircle, Clock, User, ShieldAlert, FileText, Save } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

declare global {
  interface Window {
    DailyIframe: any;
  }
}

interface CallState {
  roomUrl: string | null;
  token: string | null;
  appointmentId: number | null;
  patientName: string | null;
  isCallActive: boolean;
  isConnecting: boolean;
  callDuration: number;
  startTime: Date | null;
  error: string | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  notes: string;
}

export default function DoctorEmergencyRoom() {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [callState, setCallState] = useState<CallState>({
    roomUrl: null,
    token: null,
    appointmentId: null,
    patientName: null,
    isCallActive: false,
    isConnecting: false,
    callDuration: 0,
    startTime: null,
    error: null,
    isAudioMuted: false,
    isVideoMuted: false,
    notes: '',
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
    };
  }, []);

  // Timer da chamada
  useEffect(() => {
    if (callState.isCallActive) {
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
  }, [callState.isCallActive]);

  // Entrar na consulta automaticamente ao carregar
  useEffect(() => {
    if (appointmentId && !callState.isConnecting && !callState.isCallActive) {
      joinEmergencyCall();
    }
  }, [appointmentId]);

  // Entrar na consulta de emergência
  const joinEmergencyCall = async () => {
    if (!appointmentId) return;

    try {
      setCallState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Entrar na consulta
      const response = await apiRequest('POST', `/api/emergency/v2/join/${appointmentId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao entrar na consulta');
      }

      const data = await response.json();
      console.log('Entrando na consulta:', data);

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
            startTime: new Date(),
          }));
          toast({
            title: 'Conectado!',
            description: `Atendendo ${data.patientName}`,
          });
        })
        .on('participant-left', (event: any) => {
          console.log('Participante saiu:', event.participant);
          // Se o paciente sair, finalizar a consulta
          if (event.participant.user_id !== user?.id.toString()) {
            toast({
              title: 'Paciente desconectou',
              description: 'O paciente saiu da consulta',
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
        appointmentId: parseInt(appointmentId),
        patientName: data.patientName,
      }));

    } catch (error: any) {
      console.error('Erro ao entrar na consulta:', error);
      setCallState(prev => ({
        ...prev,
        error: error.message || 'Erro ao entrar na consulta',
        isConnecting: false,
      }));
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível entrar na consulta',
        variant: 'destructive',
      });
    }
  };

  // Finalizar consulta
  const endCall = async () => {
    try {
      // Calcular duração real
      const duration = callState.startTime 
        ? Math.floor((new Date().getTime() - callState.startTime.getTime()) / 1000)
        : callState.callDuration;

      // Enviar finalização para o backend
      if (callState.appointmentId) {
        await apiRequest('POST', `/api/emergency/v2/end/${callState.appointmentId}`, {
          duration,
          notes: callState.notes,
        });
      }

      // Destruir call frame
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }

      // Limpar timer
      if (callTimerRef.current) clearInterval(callTimerRef.current);

      toast({
        title: 'Consulta finalizada',
        description: `Duração: ${formatDuration(duration)}`,
      });

      // Redirecionar para dashboard do médico
      navigate('/doctor-telemedicine');
    } catch (error) {
      console.error('Erro ao finalizar consulta:', error);
      // Mesmo com erro, redirecionar
      navigate('/doctor-telemedicine');
    }
  };

  // Salvar notas
  const saveNotes = async () => {
    if (!callState.appointmentId || !callState.notes.trim()) return;

    try {
      await apiRequest('POST', `/api/emergency/v2/end/${callState.appointmentId}`, {
        notes: callState.notes,
        // Não finalizar a consulta, apenas salvar as notas
      });
      
      toast({
        title: 'Notas salvas',
        description: 'As anotações foram salvas com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as notas',
        variant: 'destructive',
      });
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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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
              <Button variant="outline" onClick={() => navigate('/doctor-telemedicine')}>
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
    <div className="container max-w-7xl mx-auto p-4">
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Área principal de vídeo */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    Atendimento de Emergência
                  </CardTitle>
                  <CardDescription>
                    {callState.patientName && `Paciente: ${callState.patientName}`}
                  </CardDescription>
                </div>
                {callState.isCallActive && (
                  <div className="flex items-center gap-4">
                    <Badge variant="default" className="bg-green-500">
                      <Video className="h-3 w-3 mr-1" />
                      Em Atendimento
                    </Badge>
                    <div className="text-sm font-medium">
                      {formatDuration(callState.callDuration)}
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
                  <p className="text-sm text-muted-foreground">Entrando na sala de emergência</p>
                </div>
              )}

              {callState.isCallActive && (
                <div className="space-y-4">
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
                      onClick={endCall}
                    >
                      <PhoneOff className="h-4 w-4 mr-2" />
                      Finalizar Consulta
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Área de anotações */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Anotações da Consulta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Observações médicas</Label>
                  <Textarea
                    id="notes"
                    placeholder="Digite suas observações sobre a consulta..."
                    value={callState.notes}
                    onChange={(e) => setCallState(prev => ({ ...prev, notes: e.target.value }))}
                    rows={10}
                    className="mt-2"
                  />
                </div>
                <Button onClick={saveNotes} className="w-full" disabled={!callState.notes.trim()}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Anotações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações da consulta */}
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Paciente:</span>
                <span>{callState.patientName || 'Carregando...'}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Início:</span>
                <span>
                  {callState.startTime 
                    ? format(callState.startTime, "HH:mm", { locale: ptBR })
                    : '-'
                  }
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Tipo:</span>
                <span className="text-red-600 font-medium">Emergência</span>
              </div>
            </CardContent>
          </Card>

          {/* Alerta de emergência */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Consulta de Emergência</AlertTitle>
            <AlertDescription>
              Este é um atendimento de emergência. Documente adequadamente todos os sintomas e orientações fornecidas.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}