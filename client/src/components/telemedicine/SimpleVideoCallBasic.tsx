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

/**
 * Componente de videochamada simplificado para melhor compatibilidade
 */
export function SimpleVideoCallBasic({ url, token, userName, onLeave }: SimpleVideoCallProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callFrame, setCallFrame] = useState<any>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Inicializar videochamada quando o componente montar
  useEffect(() => {
    let frame: any = null;
    let mounted = true;
    
    // Iniciar chamada após um pequeno atraso
    const timer = setTimeout(() => {
      const initCall = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Verificar se o contêiner está disponível
          if (!containerRef.current) {
            console.error('Container de vídeo não disponível');
            setError('Container de vídeo não disponível');
            setIsLoading(false);
            return;
          }
          
          // Preparar URL
          let fullUrl = url;
          if (!fullUrl.startsWith('https://')) {
            fullUrl = `https://cnvidas.daily.co/${fullUrl.replace(/^\//, '')}`;
          }
          
          console.log('Conectando ao Daily.co:', fullUrl);
          console.log('Token disponível:', !!token);
          
          try {
            // Usar a configuração mais simples possível
            const properties = {
              // Somente os parâmetros essenciais
              url: fullUrl,
              userName: userName || 'Usuário',
              token: token
            };
            
            console.log('Criando frame Daily.co com parâmetros:', JSON.stringify({
              url: properties.url,
              temToken: !!properties.token,
              userName: properties.userName
            }));
            
            // Criar frame com configurações simplificadas
            frame = DailyIframe.createFrame(containerRef.current, properties);
            
            if (!frame) {
              throw new Error('Falha ao criar frame do Daily.co');
            }
            
            console.log('Frame criado, configurando listeners...');
            
            // Configurar handlers de eventos
            frame
              .on('loading', () => {
                console.log('Daily.co: Carregando...');
              })
              .on('loaded', () => {
                console.log('Daily.co: Interface carregada');
              })
              .on('joining-meeting', () => {
                console.log('Daily.co: Entrando na reunião...');
              })
              .on('joined-meeting', () => {
                console.log('Daily.co: Entrou na reunião com sucesso');
                if (mounted) {
                  setIsLoading(false);
                  // Notificar o usuário
                  toast({
                    title: 'Videochamada conectada',
                    description: 'Você entrou na consulta com sucesso',
                    variant: 'default'
                  });
                }
              })
              .on('participant-joined', (event: any) => {
                console.log('Daily.co: Participante entrou', event?.participant?.user_name);
              })
              .on('error', (err: any) => {
                console.error('Erro na videochamada:', err);
                if (mounted) {
                  setError(`Erro na chamada de vídeo: ${err?.errorMsg || 'Conexão falhou'}`);
                  setIsLoading(false);
                }
              });
            
            setCallFrame(frame);
            
            console.log('Entrando na sala...');
            
            // Tentar entrar na sala
            await frame.join();
            console.log('Comando join() executado com sucesso');
          } catch (err: any) {
            console.error('Erro ao criar frame do Daily.co:', err);
            setError(`Falha ao criar sala de vídeo: ${err?.message || 'Erro desconhecido'}`);
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Erro ao iniciar videochamada:', err);
          setError('Erro ao iniciar a chamada de vídeo');
          setIsLoading(false);
        }
      };
      
      initCall();
    }, 1000);
    
    // Limpeza ao desmontar
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (frame) {
        try {
          frame.destroy();
        } catch (e) {
          console.error('Erro ao destruir frame:', e);
        }
      }
    };
  }, [url, token, userName]);
  
  // Função para sair da chamada
  const leaveCall = () => {
    if (callFrame) {
      callFrame.leave();
      setTimeout(() => {
        try {
          callFrame.destroy();
          if (onLeave) {
            onLeave();
          }
        } catch (e) {
          console.error('Erro ao destruir frame:', e);
        }
      }, 500);
    } else if (onLeave) {
      onLeave();
    }
  };
  
  // Tentar novamente em caso de erro
  const retry = () => {
    window.location.reload();
  };
  
  // Renderização condicional para erro
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
        className="relative flex-grow w-full min-h-[500px] bg-black rounded-lg overflow-hidden shadow-lg"
        style={{ maxWidth: '100%', margin: '0 auto' }}
        id="video-container"
      >
        {/* Overlay de carregamento */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <p className="text-xl font-medium text-white mb-2">
              Conectando à videochamada...
            </p>
            <p className="text-sm text-gray-300 max-w-md text-center">
              Este processo pode levar alguns segundos. Se não conectar em 30 segundos, 
              clique em "Tentar novamente".
            </p>
            <Button 
              variant="outline" 
              onClick={retry} 
              className="mt-4 bg-primary/10 hover:bg-primary/20 text-white"
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
      
      {/* Botão para sair da chamada */}
      <div className="flex items-center justify-center mt-6">
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full px-6 py-5 shadow-lg hover:bg-red-600 transition-all duration-300"
          onClick={leaveCall}
        >
          <Phone className="w-6 h-6 mr-2 -rotate-135" />
          Encerrar consulta
        </Button>
      </div>
    </div>
  );
}