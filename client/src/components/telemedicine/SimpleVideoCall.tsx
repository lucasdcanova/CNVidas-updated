import React, { useState, useEffect, useRef } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Button } from '@/components/ui/button';
import { Loader2, X, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SimpleVideoCallProps {
  url: string;
  token?: string;
  userName: string;
  onLeave?: () => void;
}

// Declare as variáveis globais para persistência
declare global {
  interface Window {
    DAILY_FRAME_INSTANCE: any;
    DAILY_FRAME_ROOM_NAME: string;
    MANUAL_LEAVE_REQUESTED: boolean;
  }
}

/**
 * Componente de videochamada com design inspirado no FaceTime
 * Layout clean, orientação em retrato e sem controles de câmera/microfone
 */
export function SimpleVideoCall({ url, token, userName, onLeave }: SimpleVideoCallProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callFrame, setCallFrame] = useState<any>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Status de conexão para debug
  useEffect(() => {
    console.log('Status da chamada:', { isLoading, error, callFrame: !!callFrame });
  }, [isLoading, error, callFrame]);

  // Garantir que o estado de loading seja atualizado corretamente
  useEffect(() => {
    if (callFrame && isLoading) {
      console.log('Forçando atualização do estado de loading');
      setIsLoading(false);
    }
  }, [callFrame, isLoading]);
  
  // Rastrear estado de conexão do Daily com detecção de timeout
  const [meetingState, setMeetingState] = useState<string>('idle');
  const [isVideoVisible, setIsVideoVisible] = useState<boolean>(false);
  const [forceShowVideo, setForceShowVideo] = useState<boolean>(false);
  
  // Timer de segurança para garantir que o overlay desapareça
  useEffect(() => {
    if (meetingState === 'joining') {
      const timer = setTimeout(() => {
        console.log('Timer de segurança acionado - Forçando exibição do vídeo');
        setForceShowVideo(true);
        setIsVideoVisible(true);
        setIsLoading(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [meetingState]);
  
  // Inicializar variáveis globais se necessário
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
  
  // Inicializar videochamada quando o componente montar
  useEffect(() => {
    let frame: any = window.DAILY_FRAME_INSTANCE;
    let mountedRef = true;
    
    // Identificador único para esta sala
    const roomId = url.replace(/[^a-zA-Z0-9]/g, '');
    
    // Se já existir um frame e estiver conectado à mesma sala, reutilizar
    if (frame && window.DAILY_FRAME_ROOM_NAME === roomId) {
      console.log('Reaproveitando frame já existente para a sala:', roomId);
      setCallFrame(frame);
      setIsLoading(false);
      setMeetingState('joined');
      setIsVideoVisible(true);
      setForceShowVideo(true);
      return;
    }
    
    const startCall = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Limpando recursos existentes para nova conexão...');
        
        // Se existe um frame anterior, destruí-lo corretamente
        if (window.DAILY_FRAME_INSTANCE) {
          try {
            console.log('Destruindo frame anterior...');
            window.DAILY_FRAME_INSTANCE.destroy();
            window.DAILY_FRAME_INSTANCE = null;
            window.DAILY_FRAME_ROOM_NAME = '';
          } catch (error) {
            console.warn('Erro ao destruir frame anterior:', error);
          }
        }
        
        // Limpar iframes residuais
        document.querySelectorAll('iframe[title*="daily"]').forEach((el) => {
          console.log('Removendo iframe residual:', el);
          el.remove();
        });
        
        // Aguardar para garantir que o DOM esteja pronto
        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (!mountedRef) return;
        
        // Se o contêiner não estiver disponível, não prosseguir
        if (!containerRef.current) {
          console.error('Erro: Container não disponível');
          setError('Contêiner de vídeo não está disponível');
          setIsLoading(false);
          return;
        }
        
        console.log('Container pronto:', containerRef.current);
        
        // Preparar URL correta para Daily.co
        let dailyUrl = url;
        if (dailyUrl.startsWith('https://cnvidas.daily.co/')) {
          // Já é uma URL completa para o Daily.co
          console.log('Usando URL do Daily.co fornecida:', dailyUrl);
        } else {
          // Se for um nome de sala ou caminho parcial, construir URL completa
          if (!dailyUrl.startsWith('https://')) {
            dailyUrl = `https://cnvidas.daily.co/${dailyUrl.replace(/^\//, '')}`;
            console.log('URL do Daily.co construída:', dailyUrl);
          }
        }
        
        // Adicionar token à URL se fornecido
        const fullUrl = dailyUrl;
        console.log('URL final para Daily.co:', fullUrl, 'Com token:', token ? (token.substring(0, 15) + '...') : 'não fornecido');
        
        // Configurações com layout PIP fixo
        const options = {
          url: fullUrl,
          userName: userName || 'Usuário',
          token: token,
          showLeaveButton: false,
          showFullscreenButton: false,
          showLocalVideo: true,
          showParticipantsBar: false,
          activeSpeakerMode: true,
          layout: 'custom-v1',
          customLayout: {
            preset: 'pip',
            max_cam_streams: 2,
            pip: {
              cam_aside: true,
              cam_position: 'bottom-right'
            }
          },
          iframeStyle: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '8px'
          }
        };
        
        // Criar o frame com tratamento de erros aprimorado
        console.log('Criando frame da videochamada com URL:', fullUrl);
        
        try {
          // Usar try/catch dentro do try para capturar erros específicos do createFrame
          try {
            frame = DailyIframe.createFrame(
              containerRef.current, 
              {
                ...options,
                // Garantir que não tenha configurações avançadas que possam causar problemas
                layoutConfig: undefined
              }
            );
            
            // Salvar referência global somente se a criação for bem-sucedida
            if (frame) {
              window.DAILY_FRAME_INSTANCE = frame;
              window.DAILY_FRAME_ROOM_NAME = roomId;
              console.log('Frame criado com sucesso e salvo globalmente:', !!frame);
            } else {
              throw new Error('O createFrame retornou valor nulo');
            }
          } catch (innerErr: unknown) {
            console.error('Erro específico ao criar frame:', innerErr);
            throw new Error(`Criação do frame falhou: ${innerErr instanceof Error ? innerErr.message : 'Erro desconhecido'}`);
          }
          
          // Configurar listeners de eventos com monitoramento de estado
          frame
            .on('joining-meeting', () => {
              console.log('Entrando na reunião...');
              if (mountedRef) {
                setMeetingState('joining');
              }
            })
            .on('joined-meeting', () => {
              console.log('Entrou na reunião - CONECTADO COM SUCESSO');
              // Atualizar estado imediatamente
              if (mountedRef) {
                setMeetingState('joined');
                setIsLoading(false);
                setCallFrame(frame);
                
                // Forçar o vídeo a ser visível imediatamente sem esperar
                setIsVideoVisible(true);
                
                // Certificar-se de que o overlay desaparecerá
                setTimeout(() => {
                  if (mountedRef) {
                    console.log('Forçando remoção do overlay após conexão bem-sucedida');
                    setForceShowVideo(true);
                  }
                }, 1500);
                
                toast({
                  title: 'Conectado',
                  description: 'Você entrou na videochamada com sucesso'
                });
              }
            })
            // Adicionar listener para mudanças de participante para garantir detecção de vídeo
            .on('participant-joined', () => {
              console.log('Participante entrou na chamada');
              if (mountedRef && meetingState === 'joined') {
                setIsVideoVisible(true);
              }
            })
            .on('left-meeting', () => {
              console.log('Saiu da reunião');
              // Apenas redirecionar se for uma saída manual solicitada pelo usuário
              if (window.MANUAL_LEAVE_REQUESTED && onLeave) {
                console.log('Redirecionando após saída manual');
                window.MANUAL_LEAVE_REQUESTED = false;
                onLeave();
              }
            })
            .on('error', (err: any) => {
              console.error('Erro na videochamada:', err);
              if (mountedRef) {
                setError(`Erro na chamada: ${err.errorMsg || 'Erro desconhecido'}`);
                setIsLoading(false);
                
                toast({
                  title: 'Erro na videochamada',
                  description: err.errorMsg || 'Ocorreu um erro na conexão',
                  variant: 'destructive'
                });
              }
            });
          
          // Layout PIP já configurado nas opções do createFrame
          
          // Entrar na reunião após garantir que os listeners estão configurados
          console.log('Tentando entrar na reunião com URL:', fullUrl);
          setTimeout(() => {
            if (frame && mountedRef) {
              try {
                frame.join()
                  .then(() => console.log('Join bem-sucedido'))
                  .catch((e: any) => {
                    console.error('Erro no join:', e);
                    if (mountedRef) {
                      setError(`Erro ao entrar na sala: ${e.message || 'Desconhecido'}`);
                      setIsLoading(false);
                    }
                  });
              } catch (joinErr) {
                console.error('Exceção ao tentar join:', joinErr);
                if (mountedRef) {
                  setError('Não foi possível entrar na reunião');
                  setIsLoading(false);
                }
              }
            }
          }, 500);
        } catch (frameErr) {
          console.error('Erro ao criar frame do Daily.co:', frameErr);
          if (mountedRef) {
            setError('Falha ao criar sala de vídeo');
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Erro ao iniciar videochamada:', err);
        if (mountedRef) {
          setError('Não foi possível iniciar a videochamada');
          setIsLoading(false);
          
          toast({
            title: 'Erro na videochamada',
            description: err instanceof Error ? err.message : 'Erro desconhecido',
            variant: 'destructive'
          });
        }
      }
    };
    
    // Iniciar chamada após um atraso para garantir que o DOM está totalmente carregado
    const timer = setTimeout(startCall, 800);
    
    // Limpeza ao desmontar - NÃO DESTRUIR O FRAME AUTOMATICAMENTE
    return () => {
      console.log('Desmontando componente de videochamada - PRESERVANDO frame para remontagem');
      clearTimeout(timer);
      mountedRef = false;
    };
  }, [url, token, userName, onLeave]);
  
  const leaveCall = () => {
    if (callFrame) {
      console.log('Usuário clicou no botão de sair');
      // Marcar que é uma saída manual solicitada pelo usuário
      window.MANUAL_LEAVE_REQUESTED = true;
      callFrame.leave();
      
      // Destruir o frame apenas em caso de saída explícita
      setTimeout(() => {
        if (window.DAILY_FRAME_INSTANCE) {
          try {
            window.DAILY_FRAME_INSTANCE.destroy();
            window.DAILY_FRAME_INSTANCE = null;
            window.DAILY_FRAME_ROOM_NAME = '';
          } catch (e) {
            console.error('Erro ao destruir frame após saída manual:', e);
          }
        }
        
        // Aqui é o local correto para chamar onLeave - quando o usuário
        // explicitamente clicou no botão de sair
        if (onLeave) {
          console.log('Chamando função onLeave após clique no botão de sair');
          onLeave();
        }
      }, 500);
    }
  };
  
  const retry = () => {
    window.location.reload();
  };
  
  // Renderização condicional
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
      {/* Container de vídeo com estilo FaceTime/retrato */}
      <div 
        ref={containerRef} 
        className="relative flex-grow w-full min-h-[500px] bg-black rounded-lg overflow-hidden shadow-lg"
        style={{ aspectRatio: '9/16', maxWidth: '100%', margin: '0 auto' }}
        id={`video-container-${new Date().getTime()}`}
      >
        {/* Overlay de carregamento com design aprimorado */}
        {!forceShowVideo && (isLoading || meetingState === 'joining' || (meetingState === 'joined' && !isVideoVisible)) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <p className="text-xl font-medium text-white">
              {meetingState === 'joined' ? 'Conectando sua câmera...' : 
                meetingState === 'joining' ? 'Estabelecendo conexão...' : 
                'Conectando à videochamada...'}
            </p>
          </div>
        )}
      </div>
      
      {/* Botão único para sair da chamada - estilo clean */}
      <div className="flex items-center justify-center mt-6">
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full px-6 py-5 shadow-lg hover:bg-red-600 transition-all duration-300"
          onClick={leaveCall}
        >
          <Phone className="h-6 w-6 rotate-135 mr-2" />
          <span className="font-medium">Finalizar Chamada</span>
        </Button>
      </div>
    </div>
  );
}