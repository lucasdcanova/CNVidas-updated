import React, { useState, useEffect, useRef } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RobustDailyVideoCallProps {
  roomName: string;
  roomUrl: string;
  token?: string;
  userName: string;
  onJoinSuccess?: () => void;
  onLeaveCall?: () => void;
  appointmentId?: number;
}

/**
 * Componente de videochamada robusto com Daily.co
 * - Gerencia ciclo de vida do iframe do Daily.co
 * - Previne instâncias duplicadas
 * - Manipula erros e reconexão
 * - Interface de controle completa
 */
const RobustDailyVideoCall: React.FC<RobustDailyVideoCallProps> = ({
  roomName,
  roomUrl,
  token,
  userName,
  onJoinSuccess,
  onLeaveCall,
  appointmentId
}) => {
  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState(0);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  
  // Refs
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  
  const { toast } = useToast();
  
  // Log com prefixo de debug
  const logEvent = (message: string, data?: any) => {
    if (mountedRef.current) {
      console.log(`[RobustDailyCall] ${message}`, data);
    }
  };
  
  // Limpar o frame de chamada existente
  const cleanupCallFrame = () => {
    if (callFrameRef.current) {
      logEvent('Destroying existing call frame');
      try {
        callFrameRef.current.destroy();
      } catch (err) {
        logEvent('Error destroying call frame:', err);
      }
      callFrameRef.current = null;
    }
    
    // Remover quaisquer iframes residuais do container
    if (containerRef.current) {
      const iframes = containerRef.current.querySelectorAll('iframe');
      if (iframes.length > 0) {
        logEvent(`Removing ${iframes.length} residual iframes`);
        iframes.forEach(iframe => iframe.remove());
      }
    }
  };
  
  // Verificar se a sala existe
  const verifyRoomExists = async (roomName: string): Promise<boolean> => {
    try {
      const response = await apiRequest('POST', '/api/telemedicine/daily-direct/verify', { roomName });
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.exists === true;
    } catch (error) {
      logEvent('Error verifying room:', error);
      return false;
    }
  };
  
  // Criar sala se não existir
  const createRoomIfNeeded = async (roomName: string): Promise<boolean> => {
    try {
      // Verificar se a sala existe
      const roomExists = await verifyRoomExists(roomName);
      if (roomExists) {
        logEvent('Room already exists:', roomName);
        return true;
      }
      
      // Se não existir, criar
      logEvent('Creating room:', roomName);
      const createResponse = await apiRequest('POST', '/api/telemedicine/daily-direct/create-room', {
        roomName,
        expiryHours: 2
      });
      
      if (!createResponse.ok) {
        logEvent('Error creating room:', await createResponse.text());
        return false;
      }
      
      // Aguardar propagação da sala
      logEvent('Waiting for room propagation');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar novamente se a sala foi criada
      return await verifyRoomExists(roomName);
    } catch (error) {
      logEvent('Error in createRoomIfNeeded:', error);
      return false;
    }
  };
  
  // Iniciar chamada
  const startCall = async () => {
    if (!containerRef.current) {
      setError('Container de vídeo não disponível');
      return;
    }
    
    try {
      setIsJoining(true);
      setError(null);
      
      // Garantir que a sala existe
      const roomReady = await createRoomIfNeeded(roomName);
      if (!roomReady) {
        throw new Error('Não foi possível criar ou verificar a sala');
      }
      
      // Limpar qualquer frame existente
      cleanupCallFrame();
      
      // Aguardar um momento para garantir que o DOM está atualizado
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Garantir novamente que o container existe
      if (!containerRef.current) {
        throw new Error('Container de vídeo não disponível após limpeza');
      }
      
      // Verificar DOM antes de criar nova instância
      logEvent('Verificando DOM antes da criação do callFrame');
      const existingFrames = document.querySelectorAll('iframe[title*="daily"]');
      if (existingFrames.length > 0) {
        logEvent(`Atenção: encontrados ${existingFrames.length} iframes Daily existentes no DOM`);
        // Tentar remover todos os iframes Daily existentes
        existingFrames.forEach(iframe => {
          try {
            iframe.parentNode?.removeChild(iframe);
            logEvent('Removido iframe Daily existente do DOM');
          } catch (e) {
            logEvent('Erro ao remover iframe existente:', e);
          }
        });
        
        // Esperar um pouco mais após remover iframes
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Configuração da chamada
      const callOptions: any = {
        url: roomUrl,
        showLeaveButton: false,
        showFullscreenButton: true,
        userName: userName,
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
        }
      };
      
      // Adicionar token se disponível
      if (token && typeof token === 'string') {
        callOptions.token = token;
      }
      
      logEvent('Creating call frame with options:', callOptions);
      
      // Criar o frame da chamada com um bloco try-catch adicional
      let callFrame;
      try {
        callFrame = DailyIframe.createFrame(
          containerRef.current,
          callOptions
        );
      } catch (frameError) {
        logEvent('Erro fatal ao criar DailyIframe, tentando recuperar:', frameError);
        
        // Esperar um pouco mais e tentar novamente uma única vez
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!containerRef.current) {
          throw new Error('Container de vídeo perdido durante recuperação');
        }
        
        callFrame = DailyIframe.createFrame(
          containerRef.current, 
          callOptions
        );
      }
      
      // Adicionar event listeners
      callFrame
        .on('loaded', () => {
          logEvent('Call frame loaded');
        })
        .on('joining-meeting', () => {
          logEvent('Joining meeting');
        })
        .on('joined-meeting', () => {
          logEvent('Joined meeting');
          if (mountedRef.current) {
            setIsJoining(false);
            setIsLoading(false);
            setParticipants(callFrame.participantCounts().present);
            
            // Callback de sucesso
            if (onJoinSuccess) onJoinSuccess();
            
            // Notificar sobre o sucesso
            toast({
              title: 'Conectado à videochamada',
              description: 'Você está conectado à consulta',
            });
            
            // Registro de diagnóstico
            apiRequest('POST', '/api/telemedicine/diagnostics/log', {
              event: 'join-success',
              roomName,
              appointmentId
            }).catch(e => console.error('Error logging diagnostic:', e));
          }
        })
        .on('left-meeting', () => {
          logEvent('Left meeting');
          if (mountedRef.current) {
            cleanupCallFrame();
            if (onLeaveCall) onLeaveCall();
          }
        })
        .on('participant-joined', (event) => {
          logEvent('Participant joined', event);
          if (mountedRef.current) {
            setParticipants(callFrame.participantCounts().present);
          }
        })
        .on('participant-left', (event) => {
          logEvent('Participant left', event);
          if (mountedRef.current) {
            setParticipants(callFrame.participantCounts().present);
          }
        })
        .on('error', (error) => {
          logEvent('Error in call:', error);
          if (mountedRef.current) {
            setError(`Erro na videochamada: ${error.errorMsg || 'Erro desconhecido'}`);
            
            // Notificar sobre o erro
            toast({
              title: 'Erro na videochamada',
              description: error.errorMsg || 'Ocorreu um erro durante a videochamada',
              variant: 'destructive'
            });
          }
        });
        
      // Iniciar chamada
      callFrame.join();
      
      // Salvar referência
      callFrameRef.current = callFrame;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logEvent('Error starting call:', errorMessage);
      setError(`Não foi possível iniciar a videochamada: ${errorMessage}`);
      setIsJoining(false);
      
      toast({
        title: 'Erro na videochamada',
        description: `Não foi possível iniciar a videochamada: ${errorMessage}`,
        variant: 'destructive'
      });
    }
  };
  
  // Controles da chamada
  const toggleMic = () => {
    if (callFrameRef.current) {
      const newState = !isMicEnabled;
      callFrameRef.current.setLocalAudio(newState);
      setIsMicEnabled(newState);
    }
  };
  
  const toggleCamera = () => {
    if (callFrameRef.current) {
      const newState = !isCameraEnabled;
      callFrameRef.current.setLocalVideo(newState);
      setIsCameraEnabled(newState);
    }
  };
  
  const leaveCall = () => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
    
    cleanupCallFrame();
    
    if (onLeaveCall) onLeaveCall();
  };
  
  const retryConnection = () => {
    setError(null);
    startCall();
  };
  
  // Iniciar chamada automaticamente
  useEffect(() => {
    startCall();
    
    // Limpeza ao desmontar
    return () => {
      mountedRef.current = false;
      cleanupCallFrame();
    };
  }, []);
  
  // Renderização condicional com base no estado
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-muted/30 rounded-lg p-4">
        <div className="text-center mb-6">
          <div className="bg-destructive/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-destructive"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Erro na Videochamada</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
        </div>
        <Button onClick={retryConnection} variant="default">
          Tentar Novamente
        </Button>
      </div>
    );
  }
  
  if (isJoining || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-muted/30 rounded-lg p-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h3 className="text-xl font-semibold mb-2">
          {isJoining ? 'Entrando na Videochamada' : 'Conectando'}
        </h3>
        <p className="text-muted-foreground">
          {isJoining 
            ? 'Aguarde enquanto configuramos sua conexão segura...' 
            : 'Preparando interface de videochamada...'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full min-h-[400px] bg-black rounded-lg overflow-hidden"
      />
      
      <div className="flex justify-center space-x-4 mt-4">
        <Button 
          onClick={toggleMic} 
          variant={isMicEnabled ? "outline" : "destructive"}
          size="icon"
          className="rounded-full h-12 w-12"
        >
          {isMicEnabled ? (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6"
            >
              <line x1="1" x2="23" y1="1" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </Button>
        
        <Button 
          onClick={toggleCamera} 
          variant={isCameraEnabled ? "outline" : "destructive"}
          size="icon"
          className="rounded-full h-12 w-12"
        >
          {isCameraEnabled ? (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6"
            >
              <path d="m22 8-6 4 6 4V8Z" />
              <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
            </svg>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6"
            >
              <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
              <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
              <line x1="1" x2="23" y1="1" y2="23" />
            </svg>
          )}
        </Button>
        
        <Button 
          onClick={leaveCall} 
          variant="destructive"
          size="icon"
          className="rounded-full h-12 w-12"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="h-6 w-6"
          >
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="22" x2="2" y1="2" y2="22" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

export default RobustDailyVideoCall;