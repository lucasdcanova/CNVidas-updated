import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const leaveCall = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
      callFrameRef.current.destroy();
      callFrameRef.current = null;
      setIsCallActive(false);
      setCallDuration(0);
      callStartTimeRef.current = 0;
      if (onLeaveCall) onLeaveCall();
    }
  }, [onLeaveCall]);

  const joinCall = useCallback(async () => {
    if (!roomUrl) return;

    setIsConnecting(true);

    try {
      // Solicitar permissões de mídia
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

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

      // Configuração minimalista do Daily.co
      const dailyOptions = {
        showLeaveButton: false,
        showFullscreenButton: false,
        showLocalVideo: true,
        showParticipantsBar: false,
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#000'
        }
      };

      const callFrame = DailyIframe.createFrame(
        videoContainerRef.current,
        dailyOptions
      );

      callFrameRef.current = callFrame;

      // Eventos
      callFrame.on('joined-meeting', () => {
        setIsConnecting(false);
        setIsCallActive(true);
        callStartTimeRef.current = Date.now();
        if (onJoinCall) onJoinCall();
      });

      callFrame.on('participant-joined', (event: any) => {
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

      callFrame.on('error', (error: any) => {
        console.error('Erro na chamada:', error);
        setIsConnecting(false);
        // Não propagar erros 429 (rate limit) pois são do Sentry
        if (error?.errorMsg?.includes('429')) {
          return;
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

      // Entrar na sala
      await callFrame.join({
        url: roomUrl,
        token: token,
        userName: userName
      });

    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      setIsConnecting(false);
    }
  }, [roomUrl, token, userName, onJoinCall, onParticipantJoined, onParticipantLeft]);

  // Auto-iniciar se tiver URL
  useEffect(() => {
    if (roomUrl && !isCallActive && !isConnecting && isMounted) {
      // Aguardar o componente estar montado antes de iniciar a chamada
      const timer = setTimeout(() => {
        joinCall();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [roomUrl, isCallActive, isConnecting, isMounted, joinCall]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
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
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-3 sm:border-4 border-white/20 border-t-white rounded-full animate-spin mb-3 sm:mb-4 mx-auto" />
            <p className="text-white text-base sm:text-lg md:text-xl">Conectando...</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Preparando sua consulta</p>
          </div>
        </div>
      )}
    </div>
  );
}