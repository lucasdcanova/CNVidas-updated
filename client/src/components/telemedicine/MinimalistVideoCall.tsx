import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MinimalistVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  userName?: string;
  isDoctor?: boolean;
}

export default function MinimalistVideoCall({
  roomUrl,
  token,
  onJoinCall,
  onLeaveCall,
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

  // Detectar orientação da tela
  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
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

      if (!videoContainerRef.current) {
        throw new Error('Container de vídeo não encontrado');
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
      });

      callFrame.on('participant-left', (event: any) => {
        updateParticipants();
      });

      callFrame.on('error', (error: any) => {
        console.error('Erro na chamada:', error);
        setIsConnecting(false);
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
  }, [roomUrl, token, userName, onJoinCall]);

  // Auto-iniciar se tiver URL
  useEffect(() => {
    if (roomUrl && !isCallActive && !isConnecting) {
      joinCall();
    }
  }, [roomUrl]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Container de vídeo */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 bg-black"
      />

      {/* Overlay com informações */}
      {isCallActive && (
        <>
          {/* Header com informações da chamada */}
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/70 to-transparent z-20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-white text-lg sm:text-xl font-medium">
                  {isDoctor ? 'Consulta Médica' : `Dr. ${participants[0]?.user_name || 'Médico'}`}
                </h3>
                <p className="text-white/70 text-sm">
                  {formatDuration(callDuration)}
                </p>
              </div>
            </div>
          </div>

          {/* Controles minimalistas */}
          <div className={cn(
            "absolute z-30 flex items-center justify-center",
            isPortrait 
              ? "bottom-8 left-1/2 -translate-x-1/2 gap-6"
              : "bottom-8 right-8 gap-4"
          )}>
            {/* Botão de Áudio */}
            <button
              onClick={toggleAudio}
              className={cn(
                "relative rounded-full transition-all duration-200 backdrop-blur-md",
                "w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center",
                isAudioEnabled 
                  ? "bg-white/20 hover:bg-white/30" 
                  : "bg-red-500/80 hover:bg-red-500"
              )}
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              ) : (
                <MicOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              )}
            </button>

            {/* Botão de Vídeo */}
            <button
              onClick={toggleVideo}
              className={cn(
                "relative rounded-full transition-all duration-200 backdrop-blur-md",
                "w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center",
                isVideoEnabled 
                  ? "bg-white/20 hover:bg-white/30" 
                  : "bg-red-500/80 hover:bg-red-500"
              )}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              ) : (
                <VideoOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              )}
            </button>

            {/* Botão de Desligar */}
            <button
              onClick={leaveCall}
              className={cn(
                "relative rounded-full transition-all duration-200",
                "w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center",
                "bg-red-500 hover:bg-red-600 shadow-lg"
              )}
            >
              <Phone className="w-7 h-7 sm:w-8 sm:h-8 text-white rotate-[135deg]" />
            </button>
          </div>

          {/* Indicador de vídeo desligado */}
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <VideoOff className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600" />
                </div>
                <p className="text-white/60 text-sm sm:text-base">Câmera desligada</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado de conexão */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-40">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white text-lg">Conectando...</p>
          </div>
        </div>
      )}
    </div>
  );
}