import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, Phone, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TelemedicineDiagnostics } from '@/utils/telemedicine-diagnostics';

interface MinimalistVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  userName?: string;
  isDoctor?: boolean;
}

export default function MinimalistVideoCall({
  roomUrl,
  token,
  onJoinCall,
  onLeaveCall,
  onParticipantJoined,
  onParticipantLeft,
  userName = 'Você',
  isDoctor = false
}: MinimalistVideoCallProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const callStartTimeRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const isJoiningRef = useRef(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Detectar orientação da tela e marcar como montado
  useEffect(() => {
    setIsMounted(true);
    
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      setIsMounted(false);
    };
  }, []);

  // Timer para duração da chamada
  useEffect(() => {
    if (isCallActive) {
      const interval = setInterval(() => {
        if (callStartTimeRef.current) {
          const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(duration);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isCallActive]);

  // Formatar duração
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudio = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled]);

  const leaveCall = useCallback(async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.leave();
        await callFrameRef.current.destroy();
        callFrameRef.current = null;
      } catch (error) {
        console.error('Erro ao sair da chamada:', error);
        // Forçar limpeza mesmo com erro
        callFrameRef.current = null;
      }
      
      setIsCallActive(false);
      setCallDuration(0);
      callStartTimeRef.current = 0;
      if (onLeaveCall) onLeaveCall();
    }
  }, [onLeaveCall]);

  const joinCall = useCallback(async () => {
    if (!roomUrl) return;
    
    // Evitar múltiplas tentativas simultâneas
    if (isJoiningRef.current) {
      console.log('🚫 Já está tentando entrar na sala, ignorando...');
      return;
    }
    
    // Verificar se já existe uma instância
    if (callFrameRef.current) {
      console.log('⚠️ Já existe uma instância do DailyIframe, destruindo...');
      try {
        await callFrameRef.current.destroy();
        callFrameRef.current = null;
      } catch (error) {
        console.error('Erro ao destruir instância anterior:', error);
      }
    }

    isJoiningRef.current = true;
    setIsConnecting(true);

    try {
      // Solicitar permissões de mídia com tratamento de erro específico
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        // Importante: manter a stream ativa até o Daily assumir o controle
        // Não chamar track.stop() aqui!
        console.log('✅ Permissões de mídia obtidas com sucesso');
        
        // Guardar referência da stream para limpeza posterior se necessário
        const tracks = stream.getTracks();
        
        // Adicionar listener para detectar falha na captura
        tracks.forEach(track => {
          track.onended = () => {
            console.error('❌ MediaStreamTrack ended unexpectedly:', track.kind);
            if (track.readyState === 'ended') {
              setConnectionError(`Falha na captura de ${track.kind === 'video' ? 'vídeo' : 'áudio'}. Por favor, verifique suas configurações.`);
            }
          };
        });
      } catch (mediaError: any) {
        console.error('❌ Erro ao obter permissões de mídia:', mediaError);
        
        let errorMessage = 'Erro ao acessar câmera/microfone. ';
        
        if (mediaError.name === 'NotFoundError') {
          errorMessage += 'Nenhum dispositivo de mídia encontrado.';
        } else if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          errorMessage += 'Permissão negada. Por favor, permita o acesso.';
        } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
          errorMessage += 'Dispositivo em uso por outro aplicativo.';
        } else {
          errorMessage += mediaError.message || 'Erro desconhecido.';
        }
        
        setConnectionError(errorMessage);
        throw new Error(errorMessage);
      }

      // Aguardar um pouco para garantir que o container esteja renderizado
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoContainerRef.current) {
        console.error('Container de vídeo não encontrado, tentando novamente...');
        // Tentar novamente após um pequeno delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!videoContainerRef.current) {
          throw new Error('Container de vídeo não encontrado após múltiplas tentativas');
        }
      }

      // Configuração minimalista do Daily.co com prevenção de erros de captura
      const dailyOptions = {
        showLeaveButton: false,
        showFullscreenButton: false,
        showLocalVideo: true,
        showParticipantsBar: false,
        showChat: false,
        showScreenShareButton: false,
        showSettingsButton: false,
        showLocalVideoAlways: true,
        // Configurações importantes para prevenir erros de captura
        audioSource: true, // Usar fonte de áudio padrão
        videoSource: true, // Usar fonte de vídeo padrão
        dailyConfig: {
          experimentalChromeVideoMuteLightOff: true,
          // Evitar problemas de captura em navegadores específicos
          avoidEchoCancellationConstraints: false,
          camSimulcastEncodings: [
            { maxBitrate: 100000, scaleResolutionDownBy: 4 },
            { maxBitrate: 300000, scaleResolutionDownBy: 2 },
            { maxBitrate: 1000000, scaleResolutionDownBy: 1 }
          ],
          // Configurações de mídia mais tolerantes
          userMediaVideoConstraints: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 24, max: 30 }
          },
          userMediaAudioConstraints: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        },
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#000',
          zIndex: 1
        }
      };

      const callFrame = DailyIframe.createFrame(
        videoContainerRef.current,
        dailyOptions
      );

      callFrameRef.current = callFrame;

      // Eventos
      callFrame.on('joining-meeting', () => {
        console.log('🔄 Evento: joining-meeting - Conectando...');
        setConnectionError('Conectando à sala...');
      });
      
      callFrame.on('joined-meeting', () => {
        console.log('📞 Evento: joined-meeting - Conectado com sucesso!');
        setIsConnecting(false);
        setIsCallActive(true);
        setConnectionError(null);
        retryCountRef.current = 0; // Reset retry count on success
        callStartTimeRef.current = Date.now();
        if (onJoinCall) onJoinCall();
      });
      
      callFrame.on('left-meeting', () => {
        console.log('👋 Evento: left-meeting - Saiu da reunião');
      });

      callFrame.on('participant-joined', (event: any) => {
        console.log('👤 Participante entrou:', event.participant?.user_name || 'Desconhecido');
        updateParticipants();
        if (onParticipantJoined) {
          onParticipantJoined(event.participant);
        }
      });

      callFrame.on('participant-left', (event: any) => {
        updateParticipants();
        if (onParticipantLeft) {
          onParticipantLeft(event.participant);
        }
      });

      callFrame.on('error', async (error: any) => {
        console.error('Erro na chamada:', error);
        
        // Não propagar erros 429 (rate limit) pois são do Sentry
        if (error?.errorMsg?.includes('429')) {
          return;
        }
        
        // Tratar erro de captura de mídia
        if (error?.errorMsg?.includes('MediaStreamTrack') || error?.errorMsg?.includes('capture failure')) {
          console.error('❌ Falha na captura de mídia detectada');
          setConnectionError('Falha na captura de câmera/microfone. Possíveis soluções:\n1. Recarregue a página (F5)\n2. Verifique se outro app está usando a câmera\n3. Tente desabilitar temporariamente o vídeo\n4. Use outro navegador (Chrome/Edge recomendado)');
          setIsConnecting(false);
          isJoiningRef.current = false;
          return;
        }
        
        // Tratar erro de sala não encontrada
        if (error?.error?.type === 'no-room' || error?.errorMsg?.includes('meeting does not exist')) {
          console.log('🚨 Sala não encontrada');
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setConnectionError(`Sala ainda não está pronta. Tentativa ${retryCountRef.current}/${maxRetries}`);
            
            // Destruir o frame atual antes de tentar novamente
            try {
              await callFrame.destroy();
              callFrameRef.current = null;
            } catch (destroyError) {
              console.error('Erro ao destruir frame:', destroyError);
            }
            
            // Aguardar um tempo exponencial para propagação
            const waitTime = Math.min(3000 * Math.pow(2, retryCountRef.current - 1), 15000);
            console.log(`⏳ Aguardando ${waitTime}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Resetar estados e tentar novamente
            setIsConnecting(false);
            isJoiningRef.current = false;
            
            // Tentar conectar novamente apenas se ainda estivermos montados
            if (isMounted && !isCallActive && roomUrl) {
              console.log('🔄 Tentando reconectar...');
              joinCall();
            }
          } else {
            setConnectionError('A sala de videoconferência ainda não está disponível. Por favor, aguarde alguns instantes e clique em "Tentar Novamente".');
            setIsConnecting(false);
            isJoiningRef.current = false;
          }
        } else {
          setConnectionError(error?.errorMsg || 'Erro ao conectar à videoconferência');
          setIsConnecting(false);
          isJoiningRef.current = false;
        }
      });

      const updateParticipants = () => {
        if (callFrameRef.current) {
          const allParticipants = callFrameRef.current.participants();
          const participantsList = Object.values(allParticipants).filter(
            (p: any) => p.session_id !== 'local'
          );
          setParticipants(participantsList);
        }
      };

      // Verificar dispositivos de mídia antes de entrar
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(device => device.kind === 'videoinput');
        const hasAudio = devices.some(device => device.kind === 'audioinput');
        
        console.log('📹 Dispositivos disponíveis:', {
          video: hasVideo,
          audio: hasAudio,
          devices: devices.map(d => ({ kind: d.kind, label: d.label || 'Sem nome' }))
        });
        
        if (!hasVideo && !hasAudio) {
          throw new Error('Nenhum dispositivo de mídia encontrado');
        }
      } catch (devicesError) {
        console.error('❌ Erro ao verificar dispositivos:', devicesError);
      }
      
      // Entrar na sala
      console.log('🚀 Tentando entrar na sala:', {
        url: roomUrl,
        token: token,
        tokenType: typeof token,
        hasToken: !!token,
        userName: userName
      });
      
      // Garantir que o token seja uma string ou undefined
      const joinOptions: any = {
        url: roomUrl,
        userName: userName || 'Participante'
      };
      
      // Só adicionar token se for uma string válida
      if (token && typeof token === 'string' && token.trim() !== '') {
        joinOptions.token = token;
        console.log('✅ Token adicionado às opções de join');
      } else {
        console.log('⚠️ Entrando sem token (modo público)');
      }
      
      console.log('🎯 Opções de join finais:', joinOptions);
      
      // Adicionar timeout para a tentativa de conexão
      const joinTimeout = setTimeout(() => {
        console.error('⏱️ Timeout ao tentar entrar na sala');
        setConnectionError('Tempo limite excedido ao tentar conectar. Por favor, verifique sua conexão.');
        setIsConnecting(false);
      }, 30000); // 30 segundos de timeout
      
      try {
        await callFrame.join(joinOptions);
        clearTimeout(joinTimeout);
      } catch (joinError) {
        clearTimeout(joinTimeout);
        console.error('❌ Erro ao fazer join:', joinError);
        throw joinError;
      }
      
      console.log('✅ Entrou na sala com sucesso');

    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      setIsConnecting(false);
    } finally {
      isJoiningRef.current = false;
    }
  }, [roomUrl, token, userName, onJoinCall, onParticipantJoined, onParticipantLeft]);

  // Auto-iniciar se tiver URL
  useEffect(() => {
    if (roomUrl && !isCallActive && !isConnecting && isMounted && !connectionError) {
      // Aguardar um tempo maior para garantir que a sala esteja propagada
      const timer = setTimeout(() => {
        console.log('🎬 Auto-iniciando videochamada após delay de segurança');
        joinCall();
      }, 5000); // Aumentado para 5 segundos para garantir propagação
      
      return () => clearTimeout(timer);
    }
  }, [roomUrl, isCallActive, isConnecting, isMounted, connectionError, joinCall]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try {
          callFrameRef.current.leave();
          callFrameRef.current.destroy();
          callFrameRef.current = null;
        } catch (error) {
          console.error('Erro ao limpar DailyIframe:', error);
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-screen bg-black overflow-hidden">
      {/* Container de vídeo */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 bg-black"
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />

      {/* Overlay com informações */}
      {isCallActive && (
        <>
          {/* Header com informações da chamada */}
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 md:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-white text-base sm:text-lg md:text-xl font-medium">
                  {isDoctor ? 'Consulta de Emergência' : `Dr. ${participants[0]?.user_name || 'Médico'}`}
                </h3>
                <p className="text-white/70 text-xs sm:text-sm">
                  {formatDuration(callDuration)}
                </p>
              </div>
              {participants.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-white/70 text-xs sm:text-sm">
                    {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Controles minimalistas responsivos */}
          <div className={cn(
            "absolute z-30 flex items-center justify-center",
            "bottom-4 sm:bottom-6 md:bottom-8",
            isPortrait 
              ? "left-1/2 -translate-x-1/2 gap-4 sm:gap-6"
              : "left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-8 gap-3 sm:gap-4"
          )}>
            {/* Botão de Áudio */}
            <button
              onClick={toggleAudio}
              className={cn(
                "relative rounded-full transition-all duration-200 backdrop-blur-md",
                "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                isAudioEnabled 
                  ? "bg-white/20 hover:bg-white/30 border border-white/20" 
                  : "bg-red-500/90 hover:bg-red-600 border border-red-500"
              )}
              aria-label={isAudioEnabled ? "Desativar microfone" : "Ativar microfone"}
            >
              {isAudioEnabled ? (
                <Mic className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
              ) : (
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
              )}
            </button>

            {/* Botão de Vídeo */}
            <button
              onClick={toggleVideo}
              className={cn(
                "relative rounded-full transition-all duration-200 backdrop-blur-md",
                "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                isVideoEnabled 
                  ? "bg-white/20 hover:bg-white/30 border border-white/20" 
                  : "bg-red-500/90 hover:bg-red-600 border border-red-500"
              )}
              aria-label={isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}
            >
              {isVideoEnabled ? (
                <Video className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
              ) : (
                <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
              )}
            </button>

            {/* Botão de Desligar - Maior e mais destacado */}
            <button
              onClick={leaveCall}
              className={cn(
                "relative rounded-full transition-all duration-200",
                "w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center",
                "bg-red-600 hover:bg-red-700 shadow-xl hover:shadow-2xl",
                "transform hover:scale-105 active:scale-95",
                "ml-2 sm:ml-4"
              )}
              aria-label="Encerrar chamada"
            >
              <Phone className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white rotate-[135deg]" />
            </button>
          </div>

          {/* Indicador de vídeo desligado */}
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center p-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full bg-gray-800/90 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <VideoOff className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-gray-500" />
                </div>
                <p className="text-white/60 text-xs sm:text-sm md:text-base">Câmera desligada</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado de conexão */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-40">
          <div className="text-center p-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-4 sm:border-4 border-white/20 border-t-white rounded-full animate-spin mb-3 sm:mb-4 mx-auto" />
            <p className="text-white text-base sm:text-lg md:text-xl">Conectando...</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">
              {connectionError || 'Preparando sua consulta'}
            </p>
            {retryCountRef.current > 0 && (
              <p className="text-white/40 text-xs mt-1">
                Tentativa {retryCountRef.current} de {maxRetries}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Estado de erro */}
      {!isConnecting && connectionError && !isCallActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-40">
          <div className="text-center p-4 max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-white text-lg mb-2">Erro de Conexão</p>
            <p className="text-white/60 text-sm mb-4">{connectionError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setConnectionError(null);
                  retryCountRef.current = 0;
                  joinCall();
                }}
                className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all"
              >
                Tentar Novamente
              </button>
              <button
                onClick={async () => {
                  const roomName = roomUrl?.split('/').pop();
                  const results = await TelemedicineDiagnostics.runFullDiagnostic(roomName);
                  console.log(TelemedicineDiagnostics.formatResults(results));
                  alert('Diagnóstico completo no console (F12)');
                }}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white/80 transition-all flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}