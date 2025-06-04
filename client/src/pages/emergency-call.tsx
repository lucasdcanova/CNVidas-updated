import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import DailyIframe from '@daily-co/daily-js';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, 
  Users, Clock, Heart, ArrowLeft, Loader2
} from 'lucide-react';

export default function EmergencyCallPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Refs para Daily.co
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Estados
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Obter parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomName = urlParams.get('room');
  const roomUrl = urlParams.get('roomUrl');
  const userId = urlParams.get('userId');
  
  // Timer para duração da chamada
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);
  
  // Formatar duração da chamada
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Registrar notificação de emergência
  const registerEmergencyNotification = async () => {
    try {
      const response = await fetch('/api/emergency-notifications/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          roomUrl: roomUrl,
          patientName: user?.fullName || user?.username || 'Paciente'
        })
      });

      if (response.ok) {
        console.log('Notificação de emergência registrada com sucesso');
      } else {
        console.warn('Falha ao registrar notificação de emergência');
      }
    } catch (error) {
      console.error('Erro ao registrar notificação de emergência:', error);
    }
  };

  // Carregar Daily.co SDK e conectar
  useEffect(() => {
    const loadDailyAndConnect = async () => {
      if (!roomUrl || !user) {
        setError('Parâmetros de sala inválidos');
        setIsConnecting(false);
        return;
      }

      // Registrar notificação para médicos
      await registerEmergencyNotification();
      
      try {
        // Aguardar um pouco para garantir que o DOM está pronto
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!containerRef.current) {
          throw new Error('Container não encontrado');
        }
        
        // Criar frame do Daily.co usando a biblioteca importada
        const callFrame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: false,
          showLocalVideo: true,
          showParticipantsBar: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px'
          }
        });
        
        callFrameRef.current = callFrame;
        
        // Configurar eventos
        callFrame
          .on('joined-meeting', (event: any) => {
            console.log('Conectado à sala de emergência:', event);
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
            
            toast({
              title: "Conectado!",
              description: "Você está na sala de emergência. Aguarde um médico se conectar.",
            });
          })
          .on('participant-joined', (event: any) => {
            console.log('Participante entrou:', event);
            setParticipants(prev => [...prev, event.participant]);
            
            // Se for um médico que entrou, notificar
            if (event.participant.user_name?.includes('Dr.') || event.participant.user_name?.includes('Médico')) {
              toast({
                title: "Médico conectado!",
                description: `${event.participant.user_name} entrou na consulta.`,
              });
            }
          })
          .on('participant-left', (event: any) => {
            console.log('Participante saiu:', event);
            setParticipants(prev => prev.filter(p => p.session_id !== event.participant.session_id));
          })
          .on('error', (event: any) => {
            console.error('Erro no Daily.co:', event);
            setError('Erro na videochamada');
            setIsConnecting(false);
          })
          .on('left-meeting', () => {
            console.log('Saiu da sala');
            setIsConnected(false);
            navigate('/telemedicine');
          });
        
        // Conectar diretamente à sala personalizada do paciente
        console.log('Conectando à sala de emergência personalizada...');
        
        try {
          // Criar nome da sala baseado no username do paciente
          const cleanName = (user.username || user.fullName || `patient-${user.id}`)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          
          const roomName = `${cleanName}-emergency`;
          const roomUrl = `https://cnvidas.daily.co/${roomName}`;
          
          console.log('🏠 Sala personalizada do paciente:', roomName);
          console.log('👤 Paciente:', user.fullName || user.username);
          console.log('🔗 URL da sala:', roomUrl);
          
          // Conectar diretamente à sala já criada
          try {
            console.log('🔗 Tentando conectar à sala personalizada...');
            console.log('📋 Dados de conexão:', {
              url: roomUrl,
              userName: user.fullName || user.username || 'Paciente'
            });
            
            // Adicionar timeout para a conexão
            const joinPromise = callFrame.join({
              url: roomUrl,
              userName: user.fullName || user.username || 'Paciente'
            });
            
            // Timeout de 30 segundos
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout de conexão (30s)')), 30000);
            });
            
            await Promise.race([joinPromise, timeoutPromise]);
            
            console.log('✅ Conectado à sala de emergência personalizada!');
            setIsConnected(true);
            setIsConnecting(false);
            
          } catch (firstAttemptError) {
            console.error('❌ Primeira tentativa falhou:', firstAttemptError);
            console.log('🔄 Aguardando 5 segundos para nova tentativa...');
            
            // Aguardar 5 segundos e tentar novamente
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            try {
              console.log('🔗 Segunda tentativa de conexão à sala...');
              
              const secondJoinPromise = callFrame.join({
                url: roomUrl,
                userName: user.fullName || user.username || 'Paciente'
              });
              
              const secondTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout da segunda tentativa (30s)')), 30000);
              });
              
              await Promise.race([secondJoinPromise, secondTimeoutPromise]);
              
              console.log('✅ Conectado na segunda tentativa!');
              setIsConnected(true);
              setIsConnecting(false);
              
            } catch (secondAttemptError: unknown) {
              console.error('❌ Segunda tentativa também falhou:', secondAttemptError);
              
              // Tentar abrir diretamente no navegador como fallback
              console.log('🌐 Tentando abrir sala diretamente no navegador...');
              window.open(roomUrl, '_blank');
              
              const errorMessage = secondAttemptError instanceof Error 
                ? secondAttemptError.message 
                : 'Erro desconhecido na segunda tentativa';
              
              throw new Error(`Não foi possível conectar após duas tentativas. Erro: ${errorMessage}`);
            }
          }
          
        } catch (error) {
          console.error('Erro ao criar/conectar sala:', error);
          setError('Não foi possível conectar à videochamada de emergência');
        }
        
      } catch (error) {
        console.error('Erro ao carregar Daily.co:', error);
        setError('Não foi possível conectar à videochamada');
        setIsConnecting(false);
        
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar à sala de emergência. Tente novamente.",
          variant: "destructive",
        });
      }
    };
    
    loadDailyAndConnect();
    
    // Cleanup
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, [roomUrl, user, navigate, toast]);
  
  // Controles de áudio e vídeo
  const toggleAudio = async () => {
    if (callFrameRef.current) {
      await callFrameRef.current.setLocalAudio(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };
  
  const toggleVideo = async () => {
    if (callFrameRef.current) {
      await callFrameRef.current.setLocalVideo(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  };
  
  const leaveCall = async () => {
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
    }
    navigate('/telemedicine');
  };
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Você precisa estar logado para acessar a sala de emergência.</p>
            <Button className="mt-4" onClick={() => navigate('/auth')}>
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <Heart className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro na Conexão</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-x-3">
              <Button variant="outline" onClick={() => navigate('/telemedicine')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={() => window.location.reload()}>
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/telemedicine')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-red-500" />
                <h1 className="text-lg font-semibold text-gray-900">Consulta de Emergência</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isConnected && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(callDuration)}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{participants.length + 1} participante(s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Área principal da videochamada */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Área de vídeo principal */}
          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full relative">
                {isConnecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center space-y-6">
                      <div>
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Conectando...</h3>
                        <p className="text-gray-600">Entrando na sala de emergência</p>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-sm text-blue-700 mb-3">
                          Está demorando para conectar? Clique aqui para abrir sua sala diretamente:
                        </p>
                        <Button
                          onClick={() => {
                            const roomUrl = `https://cnvidas.daily.co/lucascanova-emergency`;
                            console.log('🌐 Abrindo sala diretamente:', roomUrl);
                            window.open(roomUrl, '_blank');
                          }}
                          className="bg-blue-600 text-white hover:bg-blue-700 w-full"
                        >
                          Abrir Sala de Emergência
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div 
                  ref={containerRef} 
                  className="w-full h-full rounded-lg"
                  style={{ minHeight: '600px' }}
                />
              </CardContent>
            </Card>
            
            {/* Controles de chamada */}
            {isConnected && (
              <div className="flex justify-center mt-4 space-x-4">
                <Button
                  variant={isAudioMuted ? "destructive" : "outline"}
                  size="lg"
                  onClick={toggleAudio}
                  className="rounded-full w-14 h-14"
                >
                  {isAudioMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                
                <Button
                  variant={isVideoMuted ? "destructive" : "outline"}
                  size="lg"
                  onClick={toggleVideo}
                  className="rounded-full w-14 h-14"
                >
                  {isVideoMuted ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </Button>
                
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={leaveCall}
                  className="rounded-full w-14 h-14"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Painel lateral */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações da Consulta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm text-gray-600">
                      {isConnecting ? 'Conectando...' : isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Paciente</h4>
                  <p className="text-sm text-gray-600">{user.fullName || user.username}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Sala</h4>
                  <p className="text-sm text-gray-600 break-all">{roomName}</p>
                </div>
                
                {participants.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Participantes</h4>
                    <div className="space-y-2">
                      {participants.map((participant, index) => (
                        <div key={participant.session_id || index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm text-gray-600">
                            {participant.user_name || 'Participante'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500 text-center">
                    Aguarde um médico se conectar à sala. A consulta será iniciada automaticamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}