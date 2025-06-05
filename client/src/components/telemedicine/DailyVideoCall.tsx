import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, VideoIcon, VideoOffIcon, Mic, MicOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface DailyCallFrame {
  join: (options: { url: string; token?: string; startVideoOff?: boolean }) => Promise<void>;
  leave: () => void;
  destroy: () => void;
  setLocalAudio: (enabled: boolean) => void;
  setLocalVideo: (enabled: boolean) => void;
  on: (event: string, callback: (event: any) => void) => void;
  getNetworkStats?: () => Promise<any>;
  participants: () => any;
}

interface ConnectionIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  details?: any;
}

interface DailyVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  isEmergency?: boolean;
  onConnectionIssue?: (issue: ConnectionIssue) => void;
}

interface NetworkStats {
  latency?: number;
  packetLoss?: number;
  lastUpdated?: number;
}

export default function DailyVideoCall({ 
  roomUrl, 
  token, 
  onJoinCall, 
  onLeaveCall,
  isEmergency = false,
  onConnectionIssue
}: DailyVideoCallProps) {
  const { toast } = useToast();
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCallFrame | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [loadingDots, setLoadingDots] = useState(0);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({});
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Efeito para animação de carregamento
  useEffect(() => {
    if (isConnecting) {
      const interval = setInterval(() => {
        setLoadingDots((prev) => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isConnecting]);

  // Função para encerrar a chamada
  const leaveCall = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
      callFrameRef.current.destroy();
      callFrameRef.current = null;
      setIsCallActive(false);
      if (onLeaveCall) onLeaveCall();
    }
  }, [onLeaveCall]);

  // Função para alternar o áudio
  const toggleAudio = useCallback(() => {
    if (callFrameRef.current) {
      if (isAudioEnabled) {
        callFrameRef.current.setLocalAudio(false);
      } else {
        callFrameRef.current.setLocalAudio(true);
      }
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [isAudioEnabled]);

  // Função para alternar o vídeo
  const toggleVideo = useCallback(() => {
    if (callFrameRef.current) {
      if (isVideoEnabled) {
        callFrameRef.current.setLocalVideo(false);
      } else {
        callFrameRef.current.setLocalVideo(true);
      }
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled]);

  // Função auxiliar para criar sala no servidor
  const createRoomOnServer = async (roomName: string): Promise<boolean> => {
    try {
      console.log(`Criando sala ${roomName} no servidor...`);
      const prepareResponse = await fetch('/api/telemedicine/daily/room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomName })
      });
      
      if (prepareResponse.ok) {
        console.log('Sala preparada com sucesso no servidor');
        return true;
      } else {
        console.warn(`Falha ao preparar sala no servidor (status ${prepareResponse.status})`);
        return false;
      }
    } catch (prepError) {
      console.error('Erro ao preparar sala:', prepError);
      return false;
    }
  };
  
  // Função para extrair nome da sala a partir da URL
  const getRoomNameFromUrl = (url: string): string => {
    if (url.startsWith('https://')) {
      return url.split('/').pop() || '';
    } else if (url.startsWith('/')) {
      return url.slice(1);
    }
    return url;
  };

  // Função para iniciar a chamada
  const joinCall = useCallback(async () => {
    if (!roomUrl) {
      toast({
        title: 'Erro',
        description: 'URL da sala não fornecido',
        variant: 'destructive'
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      // Normalizar o nome da sala
      const roomName = getRoomNameFromUrl(roomUrl);  
      console.log(`Preparando sala antecipadamente: ${roomName}`);
      
      // ⚠️ PONTO CRÍTICO: Garantir que a sala está criada no Daily.co ANTES de tentar entrar
      console.log('PASSO 1: Criar a sala explicitamente no servidor primeiro');
      await createRoomOnServer(roomName);
      
      // Etapa 2: Verificar permissões de mídia
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (mediaError) {
        toast({
          title: 'Permissões necessárias',
          description: 'É necessário permitir acesso à câmera e microfone para continuar',
          variant: 'destructive'
        });
        setIsConnecting(false);
        return;
      }

      // Etapa 3: Limpar callframe anterior se existir
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }

      if (!videoContainerRef.current) {
        throw new Error('Container de vídeo não encontrado');
      }

      // Etapa 4: Aguardar propagação da sala
      // ⚠️ PONTO CRÍTICO: Aumentar o tempo de espera conforme documentação do Daily.co
      // Daily.co recomenda 5s para garantir que a sala se propague pelos servidores deles
      console.log('PASSO 2: Aguardando 5 segundos para propagação completa da sala no Daily.co...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Propagação concluída, sala deve estar disponível agora');
      
      // Etapa 5: Configuração do Daily.co
      const dailyOptions = {
        showLeaveButton: false,
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '10px'
        },
        startVideoOff: false
      };
      
      // Etapa 6: Criar o frame
      console.log('Criando frame do Daily.co...');
      if (!videoContainerRef.current) {
        throw new Error('Container de vídeo desapareceu');
      }
      
      const callFrame = DailyIframe.createFrame(
        videoContainerRef.current,
        dailyOptions
      ) as DailyCallFrame;
      
      // Salvar referência do frame
      callFrameRef.current = callFrame;

      // Etapa 7: Configurar eventos
      callFrame
        .on('joined-meeting', () => {
          console.log('Entrou na sala de videochamada');
          setIsConnecting(false);
          setIsCallActive(true);
          if (onJoinCall) onJoinCall();

          toast({
            title: 'Conectado',
            description: isEmergency 
              ? 'Você está em uma consulta de emergência' 
              : 'Você está conectado à sala de consulta'
          });
        })
        .on('error', (error: { error?: { type: string } }) => {
          console.error('Erro na chamada:', error);
          
          // Verificar o tipo específico de erro
          let errorTitle = 'Erro na chamada';
          let errorMessage = 'Ocorreu um problema ao conectar à sala.';
          let errorSeverity: 'high' | 'medium' = 'high';
          
          // Tratamento especial para o erro "sala não existe"
          if (error.error && error.error.type === 'no-room') {
            errorTitle = 'Preparando sala...';
            errorMessage = 'Aguarde, estamos configurando a sala de consulta para você.';
            
            console.log('⚠️ ERRO CRÍTICO: Sala não existe, apesar do período de propagação');
            console.log('Iniciando procedimento de recuperação para sala:', roomName);
            
            // Função para nova tentativa com parâmetros avançados de recuperação
            const retryConnection = async () => {
              try {
                setRetryAttempts(prev => prev + 1);
                
                // Criar sala novamente com parâmetros de força
                console.log(`RECUPERAÇÃO PASSO 1: Tentativa ${retryAttempts + 1} - Forçando criação da sala com tempo extendido`);
                const response = await fetch('/api/telemedicine/daily/room', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Recovery-Attempt': `${retryAttempts + 1}`
                  },
                  body: JSON.stringify({ 
                    roomName,
                    forceCreate: true,
                    waitExtraTime: true,
                    recoveryAttempt: retryAttempts + 1
                  })
                });
                
                if (!response.ok) {
                  throw new Error(`Falha ao criar sala: ${response.status}`);
                }
                
                // Aguardar propagação EXTENDIDA
                console.log('RECUPERAÇÃO PASSO 2: Aguardando 8 segundos para garantir propagação total...');
                await new Promise(resolve => setTimeout(resolve, 8000));
                console.log('Período de propagação de emergência concluído');
                
                // Tentar entrar novamente com URL simplificada
                console.log('RECUPERAÇÃO PASSO 3: Tentando entrar na sala novamente...');
                const roomPath = roomName.replace(/^\/+/, '');
                const finalUrl = `https://cnvidas.daily.co/${roomPath}`;
                
                console.log('URL final para recuperação:', finalUrl);
                callFrame.join({ 
                  url: finalUrl,
                  startVideoOff: false,
                  startAudioOff: false
                });
              } catch (retryError) {
                console.error('Erro na tentativa de recuperação:', retryError);
                toast({
                  title: 'Erro de conexão',
                  description: 'Não foi possível conectar após várias tentativas.',
                  variant: 'destructive'
                });
                setIsConnecting(false);
              }
            };
            
            // Iniciar nova tentativa
            retryConnection();
            
            // Não mostrar toast de erro para este caso
            return;
          }
          
          toast({
            title: errorTitle,
            description: errorMessage,
            variant: 'destructive'
          });
          
          setIsConnecting(false);
          
          if (onConnectionIssue) {
            onConnectionIssue({
              type: 'CALL_ERROR',
              severity: errorSeverity,
              details: error
            });
          }
        })
        .on('left-meeting', () => {
          console.log('Saiu da sala de videochamada');
          setIsCallActive(false);
          if (onLeaveCall) onLeaveCall();
        })
        .on('network-quality-change', (event: any) => {
          const { quality } = event;
          console.log('Mudança na qualidade da rede:', quality);
          
          // quality vai de 0 (pior) a 5 (melhor)
          if (quality < 2 && onConnectionIssue) {
            onConnectionIssue({
              type: 'POOR_NETWORK_QUALITY',
              severity: quality === 0 ? 'high' : 'medium',
              details: { quality }
            });
          }
        })
        .on('network-connection', (event: any) => {
          const { type, event: connectionEvent } = event;
          console.log('Evento de conexão:', type, connectionEvent);
          
          if (type === 'disconnected' && onConnectionIssue) {
            onConnectionIssue({
              type: 'NETWORK_DISCONNECTED',
              severity: 'high',
              details: event
            });
          }
        })
        .on('participant-joined', (event: any) => {
          try {
            const participant = event.participant;
            if (participant && callFrameRef.current && 
                participant.session_id !== callFrameRef.current.participants().local.session_id) {
              console.log('Participante entrou:', participant);
              toast({
                title: 'Participante conectado',
                description: 'Um novo participante entrou na sala'
              });
            }
          } catch (err) {
            console.error('Erro ao processar entrada de participante:', err);
          }
        })
        .on('participant-left', (event: any) => {
          console.log('Participante saiu:', event.participant);
          toast({
            title: 'Participante desconectado',
            description: 'Um participante saiu da sala'
          });
        });

      // Etapa 8: Entrar na sala
      try {
        // SOLUÇÃO DEFINITIVA PARA O PROBLEMA "MEETING DOES NOT EXIST"
      
        // 1. Sempre usar URL fixa do Daily.co para evitar problemas de formatação
        // Daily.co exige exatamente: "https://DOMÍNIO.daily.co/NOME-DA-SALA"
        const fixedDomain = "cnvidas.daily.co";
        
        // 2. Garantir que o nome da sala não contenha caracteres problemáticos
        const sanitizedRoomName = roomName
          .replace(/^\/+/, '')  // remover barras no início
          .replace(/\s+/g, '-') // substituir espaços por hífens
          .toLowerCase();       // deixar tudo em minúsculas
        
        // 3. Montar a URL completa no formato exato que o Daily.co espera
        const finalUrl = `https://${fixedDomain}/${sanitizedRoomName}`;
        
        console.log('PASSO 3: Entrando na sala com URL definitiva:', finalUrl);
        
        // Configurar opções de entrada - formato simplificado e mais confiável
        const joinOptions: any = { 
          url: finalUrl,
          startVideoOff: false,
          startAudioOff: false
        };
        
        // Adicionar token apenas se for um token real do Daily.co
        // Tokens de emergência e desenvolvimento não são enviados para o Daily.co
        if (token && !token.startsWith('emergency-token-') && !token.startsWith('dev-token-')) {
          console.log('Adicionando token válido para autenticação avançada');
          joinOptions.token = token;
        }
        
        // Entrar na sala com configurações simplificadas
        console.log('PASSO 4: Configurações finais para entrar na sala:', joinOptions);
        callFrame.join(joinOptions);
      } catch (joinError) {
        console.error('Erro ao entrar na sala:', joinError);
        throw joinError;
      }
    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar à sala de consulta',
        variant: 'destructive'
      });
      setIsConnecting(false);
    }
  }, [roomUrl, token, toast, onJoinCall, onLeaveCall, isEmergency, onConnectionIssue]);

  // Monitorar a qualidade da conexão
  useEffect(() => {
    if (!isCallActive || !callFrameRef.current) return;
    
    // Função para verificar as estatísticas de rede
    const checkNetworkQuality = async () => {
      try {
        if (!callFrameRef.current) return;
        
        // Obter estatísticas de rede do Daily.co
        let stats = null;
        if (typeof callFrameRef.current.getNetworkStats === 'function') {
          stats = await callFrameRef.current.getNetworkStats();
        } else {
          console.warn('getNetworkStats não está disponível nesta versão do Daily.co');
        }
        
        if (stats && stats.stats) {
          // Dados de latência e perda de pacotes
          const latency = stats.stats.latest.videoRecvLatency || 
                         stats.stats.latest.audioRecvLatency || 0;
          
          const videoPacketLoss = stats.stats.latest.videoRecvPacketLoss || 0;
          const audioPacketLoss = stats.stats.latest.audioRecvPacketLoss || 0;
          const packetLoss = Math.max(videoPacketLoss, audioPacketLoss);
          
          setNetworkStats({
            latency,
            packetLoss,
            lastUpdated: Date.now()
          });
          
          // Reportar problemas de conexão se for detectado
          if (onConnectionIssue) {
            if (packetLoss > 0.1) { // Mais de 10% de perda de pacotes
              onConnectionIssue({
                type: 'HIGH_PACKET_LOSS',
                severity: packetLoss > 0.25 ? 'high' : 'medium',
                details: { packetLoss }
              });
            } else if (latency > 300) { // Latência maior que 300ms
              onConnectionIssue({
                type: 'HIGH_LATENCY',
                severity: latency > 1000 ? 'high' : 'medium',
                details: { latency }
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar estatísticas de rede:', error);
      }
    };
    
    // Verificar a cada 5 segundos
    const interval = setInterval(checkNetworkQuality, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [isCallActive, onConnectionIssue]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Área de vídeo */}
      <div 
        ref={videoContainerRef}
        className="w-full h-full relative rounded-xl overflow-hidden bg-zinc-900"
      >
        {!isCallActive && !isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-blue-950 to-slate-900 text-white">
            <VideoIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl font-medium mb-2">
              {isEmergency ? 'Consulta de Emergência' : 'Consulta por Vídeo'}
            </p>
            <p className="text-sm text-gray-300 mb-6 max-w-md text-center">
              {isEmergency 
                ? 'Você está prestes a iniciar uma consulta de emergência com um médico disponível.' 
                : 'Clique no botão abaixo para entrar na sua consulta agendada.'}
            </p>
            <Button 
              onClick={joinCall}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-full"
            >
              Iniciar Videochamada
            </Button>
          </div>
        )}

        {isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-blue-950 to-slate-900 text-white">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="text-lg font-medium">
              Conectando{''.padEnd(loadingDots, '.')}
            </p>
            <p className="text-sm text-gray-300 mt-2 max-w-md text-center">
              Verificando conexão e preparando a sala de consulta...
            </p>
          </div>
        )}
      </div>

      {/* Controles de chamada */}
      {isCallActive && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center space-x-4 z-10">
          <Button
            variant="ghost"
            className={`rounded-full h-14 w-14 p-0 flex items-center justify-center ${!isAudioEnabled ? 'bg-red-500 text-white' : 'bg-zinc-800 text-white'}`}
            onClick={toggleAudio}
          >
            {isAudioEnabled ? (
              <Mic className="h-6 w-6" />
            ) : (
              <MicOff className="h-6 w-6" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            className={`rounded-full h-14 w-14 p-0 flex items-center justify-center ${!isVideoEnabled ? 'bg-red-500 text-white' : 'bg-zinc-800 text-white'}`}
            onClick={toggleVideo}
          >
            {isVideoEnabled ? (
              <VideoIcon className="h-6 w-6" />
            ) : (
              <VideoOffIcon className="h-6 w-6" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            className="bg-red-500 hover:bg-red-600 text-white rounded-full h-14 w-14 p-0 flex items-center justify-center"
            onClick={leaveCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}