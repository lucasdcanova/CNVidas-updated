import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DirectIframeVideoCallProps {
  url: string;
  token?: string;
  userName: string;
  onLeave?: () => void;
}

/**
 * Componente de videochamada usando método direto (incorporado)
 * Esta implementação simplificada resolve problemas de compatibilidade
 */
export function DirectIframeVideoCall({ url, token, userName, onLeave }: DirectIframeVideoCallProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // Referências
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Extrai o nome da sala (última parte da URL)
  const extractRoomName = (fullUrl: string): string => {
    try {
      // Remover parâmetros de consulta, se houver
      const urlWithoutParams = fullUrl.split('?')[0];
      // Obter o último segmento da URL (nome da sala)
      const segments = urlWithoutParams.split('/');
      return segments[segments.length - 1];
    } catch (e) {
      console.error('Erro ao extrair nome da sala:', e);
      return fullUrl; // Fallback para URL original
    }
  };

  // Constrói URL completa para o iframe
  const buildIframeUrl = (): string => {
    try {
      let baseUrl = url;
      const roomName = extractRoomName(url);
      
      // Garantir que temos uma URL completa
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://cnvidas.daily.co/${roomName}`;
      }
      
      // Construir parâmetros de URL
      const urlParams = new URLSearchParams();
      
      // Adicionar token como parâmetro se disponível
      if (token) {
        urlParams.append('t', token);
      }
      
      // Adicionar nome do usuário
      urlParams.append('name', userName || 'Usuário');
      
      // Adicionar timestamp para prevenir cache
      urlParams.append('cache', Date.now().toString());
      
      // Garantir modo de barra lateral (interface simplificada)
      urlParams.append('showLeaveButton', 'true');
      urlParams.append('showFullscreenButton', 'true');
      urlParams.append('layout', 'grid');
      
      // Logging para depuração
      console.log('Room name:', roomName);
      console.log('Base URL:', baseUrl);
      console.log('Token available:', !!token);
      console.log('Username:', userName);
      
      // Construir URL final
      const separator = baseUrl.includes('?') ? '&' : '?';
      const finalUrl = `${baseUrl}${separator}${urlParams.toString()}`;
      
      console.log('URL final do iframe:', finalUrl);
      return finalUrl;
    } catch (e) {
      console.error('Erro ao construir URL do iframe:', e);
      setError('Falha ao preparar URL da chamada');
      return url; // Fallback para URL original em caso de erro
    }
  };

  // Inicializa a chamada
  useEffect(() => {
    console.log('Inicializando componente de videochamada');
    console.log('Parâmetros recebidos:', { url, userName, hasToken: !!token });
    
    // Limpar qualquer erro anterior
    setError(null);
    setIsLoading(true);
    
    // Configurar timer para timeout
    timerRef.current = setTimeout(() => {
      if (isLoading) {
        console.warn('Timeout atingido na conexão da videochamada');
        
        if (connectionAttempts >= 2) {
          setError('A conexão está demorando muito. Verifique se sua internet está funcionando corretamente.');
          setIsLoading(false);
        } else {
          // Tentar novamente automaticamente
          setConnectionAttempts(prev => prev + 1);
          
          // Recarregar iframe
          if (iframeRef.current) {
            try {
              const refreshedUrl = buildIframeUrl();
              iframeRef.current.src = refreshedUrl;
              
              toast({
                title: 'Reconectando',
                description: 'Tentando estabelecer conexão com a sala novamente...',
              });
            } catch (err) {
              console.error('Erro ao recarregar iframe:', err);
              setError('Falha ao recarregar a conexão de vídeo');
              setIsLoading(false);
            }
          }
        }
      }
    }, 20000); // 20 segundos de timeout
    
    return () => {
      // Limpar timer ao desmontar
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [url, token, userName, isLoading, connectionAttempts, toast]);

  // Detectar carregamento do iframe
  useEffect(() => {
    const handleIframeLoad = () => {
      console.log('Iframe carregado com sucesso');
      
      // Dar um tempo extra para garantir que tudo inicializou
      setTimeout(() => {
        setIsLoading(false);
        
        toast({
          title: 'Videochamada conectada',
          description: 'Você entrou na sala de consulta com sucesso',
        });
      }, 2000);
    };
    
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
    }
    
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [toast]);

  // Função para retry manual
  const handleRetry = () => {
    console.log('Tentando reconectar manualmente');
    setError(null);
    setIsLoading(true);
    setConnectionAttempts(0);
    
    if (iframeRef.current) {
      try {
        const refreshedUrl = buildIframeUrl();
        iframeRef.current.src = refreshedUrl;
      } catch (err) {
        console.error('Erro ao tentar novamente:', err);
        setError('Falha ao recarregar a conexão');
        setIsLoading(false);
      }
    }
  };

  // Sair da chamada
  const handleLeaveCall = () => {
    console.log('Saindo da chamada');
    if (onLeave) {
      onLeave();
    }
  };
  
  // Renderização de erro
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted/10 rounded-lg border border-muted h-full min-h-[400px]">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <X className="w-12 h-12 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Erro na conexão</h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">{error}</p>
        <Button 
          onClick={handleRetry}
          className="px-6"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }
  
  // Renderização principal
  return (
    <div className="flex flex-col w-full h-full" ref={containerRef}>
      {/* Container de vídeo */}
      <div 
        className="relative flex-grow w-full min-h-[500px] bg-black rounded-lg overflow-hidden shadow-lg"
        style={{ maxWidth: '100%', margin: '0 auto' }}
      >
        {/* iframe direto para a sala do Daily.co */}
        <iframe
          ref={iframeRef}
          src={buildIframeUrl()}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          style={{
            border: 'none',
            width: '100%', 
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          title="Videochamada médica"
        />
        
        {/* Overlay de carregamento */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <p className="text-xl font-medium text-white mb-2">
              Conectando à videochamada...
            </p>
            <p className="text-sm text-gray-300 max-w-md text-center">
              Este processo pode levar alguns segundos. Por favor, aguarde.
            </p>
            <Button 
              variant="outline" 
              onClick={handleRetry}
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
          onClick={handleLeaveCall}
        >
          <Phone className="w-6 h-6 mr-2 -rotate-135" />
          Encerrar consulta
        </Button>
      </div>
    </div>
  );
}