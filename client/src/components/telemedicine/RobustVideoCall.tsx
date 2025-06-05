import React, { useState, useEffect, useRef } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Button } from '@/components/ui/button';
import { Loader2, X, Video, VideoOff, Mic, MicOff, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Declare a variável global para persistir o frame entre remontagens
declare global {
  interface Window {
    DAILY_FRAME_INSTANCE: any;
    DAILY_FRAME_ROOM_NAME: string;
    MANUAL_LEAVE_REQUESTED: boolean;
  }
}

interface RobustVideoCallProps {
  url: string;
  token?: string;
  userName: string;
  onLeave?: () => void;
}

/**
 * Componente robusto para videochamada usando Daily.co
 * Implementa persistência do frame entre remontagens para evitar
 * o problema "YOU'VE LEFT THE CALL" quando o componente é remontado
 */
export function RobustVideoCall({ url, token, userName, onLeave }: RobustVideoCallProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callFrame, setCallFrame] = useState<any>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Inicializar variáveis globais se não existirem
  useEffect(() => {
    if (typeof window.DAILY_FRAME_INSTANCE === 'undefined') {
      window.DAILY_FRAME_INSTANCE = null;
    }
    if (typeof window.DAILY_FRAME_ROOM_NAME === 'undefined') {
      window.DAILY_FRAME_ROOM_NAME = '';
    }
    if (typeof window.MANUAL_LEAVE_REQUESTED === 'undefined') {
      window.MANUAL_LEAVE_REQUESTED = false;
    }
  }, []);

  // Status de conexão para debug
  useEffect(() => {
    console.log('Status da chamada:', { 
      isLoading, 
      error, 
      callFrame: !!callFrame,
      isConnected,
      globalFrame: !!window.DAILY_FRAME_INSTANCE,
      roomName: window.DAILY_FRAME_ROOM_NAME
    });
  }, [isLoading, error, callFrame, isConnected]);

  // Inicializar videochamada quando o componente montar
  useEffect(() => {
    let mountedRef = true;
    
    // Verificar se já existe uma instância do frame para a mesma sala
    const roomId = url.replace(/[^a-zA-Z0-9]/g, '');
    const existingFrame = window.DAILY_FRAME_INSTANCE;
    const isSameRoom = window.DAILY_FRAME_ROOM_NAME === roomId;
    
    // Se já existir um frame para a mesma sala, reutilizá-lo
    if (existingFrame && isSameRoom) {
      console.log('Reaproveitando frame existente para a sala:', roomId);
      setCallFrame(existingFrame);
      setIsLoading(false);
      setIsConnected(true);
      return;
    }
    
    const startCall = async () => {
      try {
        console.log('Iniciando chamada de vídeo...');
        setIsLoading(true);
        setError(null);

        // Verificar conexão antes de iniciar
        try {
          const connectionTest = await fetch('/api/telemedicine/connection-test');
          if (!connectionTest.ok) {
            throw new Error('Falha no teste de conexão');
          }
        } catch (connError) {
          console.error('Erro no teste de conexão:', connError);
          throw new Error('Problema de conexão com o servidor. Verifique sua internet.');
        }

        // Criar frame com retry
        let frame = null;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            if (!containerRef.current) {
              throw new Error('Container do vídeo não está disponível. Tente recarregar a página.');
            }
            frame = DailyIframe.createFrame(containerRef.current, {
              iframeStyle: {
                width: '100%',
                height: '100%',
                border: '0',
                borderRadius: '8px',
              },
              showLocalVideo: true,
              showParticipantsBar: true,
              userName: userName || 'Usuário',
            });
            break;
          } catch (frameError) {
            retryCount++;
            if (retryCount === maxRetries) {
              throw new Error('Falha ao criar frame de vídeo após várias tentativas');
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        // Configurar listeners com tratamento de erro melhorado
        if (!frame) {
          throw new Error('Frame não inicializado corretamente');
        }

        frame
          .on('joining-meeting', () => {
            console.log('Entrando na reunião...');
            if (mountedRef) {
              setIsLoading(true);
            }
          })
          .on('joined-meeting', () => {
            console.log('Entrou na reunião com sucesso!');
            if (mountedRef) {
              setIsLoading(false);
              setIsConnected(true);
              setCallFrame(frame);
              
              toast({
                title: 'Conectado',
                description: 'Você entrou na videochamada'
              });
            }
          })
          .on('left-meeting', () => {
            console.log('Saiu da reunião');
            if (mountedRef) {
              setIsConnected(false);
              
              if (window.MANUAL_LEAVE_REQUESTED && onLeave) {
                console.log('Redirecionando após saída manual');
                window.MANUAL_LEAVE_REQUESTED = false;
                onLeave();
              }
            }
          })
          .on('error', (err: any) => {
            console.error('Erro na videochamada:', err);
            if (mountedRef) {
              let errorMessage = 'Erro desconhecido na chamada';
              
              // Tratamento específico para diferentes tipos de erro
              if (err.errorMsg?.includes('too call failed')) {
                errorMessage = 'Falha na conexão da chamada. Tentando reconectar...';
                // Tentar reconexão automática
                setTimeout(() => {
                  if (mountedRef) {
                    startCall();
                  }
                }, 3000);
              } else if (err.errorMsg?.includes('network')) {
                errorMessage = 'Problema de conexão. Verifique sua internet.';
              } else if (err.errorMsg?.includes('permission')) {
                errorMessage = 'Permissão negada para câmera ou microfone.';
              }
              
              setError(errorMessage);
              setIsLoading(false);
              
              toast({
                title: 'Erro na chamada',
                description: errorMessage,
                variant: 'destructive'
              });
            }
          });

        // Entrar na reunião com timeout
        console.log('Tentando entrar na reunião...');
        const joinPromise = frame.join();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao entrar na reunião')), 30000)
        );

        try {
          await Promise.race([joinPromise, timeoutPromise]);
          console.log('Join bem-sucedido');
        } catch (e) {
          console.error('Erro ao entrar na reunião:', e);
          throw new Error('Falha ao entrar na reunião: ' + (e instanceof Error ? e.message : 'Erro desconhecido'));
        }
      } catch (error) {
        console.error('Erro ao iniciar chamada:', error);
        if (mountedRef) {
          setError(error instanceof Error ? error.message : 'Erro desconhecido');
          setIsLoading(false);
          
          toast({
            title: 'Erro na chamada',
            description: error instanceof Error ? error.message : 'Erro desconhecido',
            variant: 'destructive'
          });
        }
      }
    };
    
    // Iniciar a chamada com um pequeno delay para garantir que o DOM está pronto
    const timer = setTimeout(startCall, 500);
    
    // Cleanup - IMPORTANTE: NÃO destruir o frame ao desmontar!
    return () => {
      console.log('Componente desmontado - NÃO destruindo frame');
      clearTimeout(timer);
      mountedRef = false;
      
      // Preservar o frame para futuras remontagens
      // O frame só deve ser destruído quando o usuário clicar em "Sair"
    };
  }, [url, token, userName, onLeave]);
  
  // Funções de controle da chamada
  const toggleAudio = () => {
    if (callFrame) {
      const newState = !audioEnabled;
      callFrame.setLocalAudio(newState);
      setAudioEnabled(newState);
    }
  };
  
  const toggleVideo = () => {
    if (callFrame) {
      const newState = !videoEnabled;
      callFrame.setLocalVideo(newState);
      setVideoEnabled(newState);
    }
  };
  
  const leaveCall = () => {
    if (callFrame) {
      console.log('Usuário clicou em sair - saída manual solicitada');
      window.MANUAL_LEAVE_REQUESTED = true;
      
      try {
        callFrame.leave();
        
        // Destruir o frame global apenas na saída manual
        if (window.DAILY_FRAME_INSTANCE) {
          setTimeout(() => {
            try {
              window.DAILY_FRAME_INSTANCE.destroy();
              window.DAILY_FRAME_INSTANCE = null;
              window.DAILY_FRAME_ROOM_NAME = '';
              
              // Limpar iframes residuais
              document.querySelectorAll('iframe[title*="daily"]').forEach(el => {
                el.remove();
              });
            } catch (e) {
              console.error('Erro ao destruir frame após saída:', e);
            }
          }, 500);
        }
        
        // Chamar onLeave apenas se solicitado pelo usuário
        if (onLeave) {
          onLeave();
        }
      } catch (e) {
        console.error('Erro ao sair da chamada:', e);
      }
    }
  };
  
  const retry = () => {
    window.location.reload();
  };
  
  // Renderização condicional para erros
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-muted/20 rounded-lg border border-muted h-full min-h-[400px]">
        <X className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Erro na conexão</h3>
        <p className="text-muted-foreground text-center mb-6">{error}</p>
        <Button onClick={retry}>Tentar novamente</Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col w-full h-full">
      {/* Container de vídeo */}
      <div 
        ref={containerRef} 
        className="relative flex-grow w-full min-h-[400px] bg-black rounded-lg overflow-hidden"
      >
        {/* Overlay de carregamento */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center z-10">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-lg font-semibold">
              {isConnected ? 'Conectando sua câmera...' : 'Estabelecendo conexão...'}
            </p>
          </div>
        )}
      </div>
      
      {/* Controles da chamada */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <Button
          variant="outline"
          size="icon"
          className={`rounded-full ${!audioEnabled ? 'bg-destructive text-destructive-foreground' : ''}`}
          onClick={toggleAudio}
        >
          {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className={`rounded-full ${!videoEnabled ? 'bg-destructive text-destructive-foreground' : ''}`}
          onClick={toggleVideo}
        >
          {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full"
          onClick={leaveCall}
        >
          <Phone className="h-5 w-5 rotate-135" />
        </Button>
      </div>
    </div>
  );
}