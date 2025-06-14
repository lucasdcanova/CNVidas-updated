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
  const callStartTimeRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const isJoiningRef = useRef(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Marcar como montado
  useEffect(() => {
    setIsMounted(true);
    return () => {
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para entrar na chamada
  const joinCall = useCallback(async () => {
    if (!roomUrl || !videoContainerRef.current || isJoiningRef.current) {
      console.log('❌ Condições não atendidas para entrar na chamada:', {
        roomUrl: !!roomUrl,
        container: !!videoContainerRef.current,
        isJoining: isJoiningRef.current
      });
      return;
    }

    isJoiningRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log('🎬 Iniciando videochamada minimalista...');
      
      // Criar call frame com configuração PIP fixa
      const callFrame = DailyIframe.createFrame(videoContainerRef.current, {
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0',
          zIndex: '1'
        },
        showLeaveButton: false,
        showFullscreenButton: false,
        showLocalVideo: true,
        showParticipantsBar: false,
        showUserNameChangeUI: false,
        showPrejoinUI: false,
        activeSpeakerMode: true,
        // Configuração PIP fixa - vídeo local sempre no canto
        layout: 'custom-v1',
        customLayout: {
          preset: 'pip',
          max_cam_streams: 2,
          pip: {
            cam_aside: true,
            cam_position: 'bottom-right'
          }
        },
        theme: {
          colors: {
            accent: '#3B82F6',
            accentText: '#FFFFFF',
            background: '#000000',
            backgroundAccent: '#1F2937',
            baseText: '#FFFFFF',
            border: '#374151',
            mainAreaBg: '#000000',
            mainAreaBgAccent: '#111827',
            mainAreaText: '#FFFFFF',
            supportiveText: '#9CA3AF'
          }
        }
      });

      callFrameRef.current = callFrame;

      // Configurar eventos
      callFrame
        .on('joined-meeting', (event: any) => {
          console.log('✅ Conectado à sala de videochamada');
          setIsCallActive(true);
          setIsConnecting(false);
          callStartTimeRef.current = Date.now();
          onJoinCall?.();
          
          // Configurar layout PIP após entrar
          callFrame.setLocalVideo(isVideoEnabled);
          callFrame.setLocalAudio(isAudioEnabled);
        })
        .on('left-meeting', () => {
          console.log('👋 Desconectado da sala');
          setIsCallActive(false);
          setIsConnecting(false);
          callStartTimeRef.current = 0;
          setCallDuration(0);
          setParticipants([]);
          onLeaveCall?.();
        })
        .on('participant-joined', (event: any) => {
          console.log('👥 Participante entrou:', event.participant);
          updateParticipants();
          onParticipantJoined?.(event.participant);
        })
        .on('participant-left', (event: any) => {
          console.log('👋 Participante saiu:', event.participant);
          updateParticipants();
          onParticipantLeft?.(event.participant);
        })
        .on('error', (event: any) => {
          console.error('❌ Erro na videochamada:', event);
          const errorMessage = event.errorMsg || event.error?.msg || 'Erro de conexão';
          setConnectionError(errorMessage);
          setIsConnecting(false);
          
          // Tentar reconectar automaticamente
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`🔄 Tentando reconectar (${retryCountRef.current}/${maxRetries})...`);
            setTimeout(() => {
              if (callFrameRef.current) {
                callFrameRef.current.leave();
                callFrameRef.current.destroy();
                callFrameRef.current = null;
              }
              isJoiningRef.current = false;
              joinCall();
            }, 3000);
          }
        })
        .on('camera-error', (event: any) => {
          console.warn('📹 Erro na câmera:', event);
          setIsVideoEnabled(false);
        })
        .on('mic-error', (event: any) => {
          console.warn('🎤 Erro no microfone:', event);
          setIsAudioEnabled(false);
        });

      const updateParticipants = () => {
        if (callFrameRef.current) {
          const participants = callFrameRef.current.participants();
          const participantList = Object.values(participants || {});
          setParticipants(participantList);
        }
      };

      // Entrar na sala
      const joinOptions: any = {
        url: roomUrl,
        userName: userName || 'Usuário',
        startVideoOff: !isVideoEnabled,
        startAudioOff: !isAudioEnabled
      };

      if (token) {
        joinOptions.token = token;
      }

      await callFrame.join(joinOptions);

    } catch (error: any) {
      console.error('❌ Erro ao entrar na videochamada:', error);
      setConnectionError(error.message || 'Falha ao conectar');
      setIsConnecting(false);
      isJoiningRef.current = false;
    }
  }, [roomUrl, token, userName, isVideoEnabled, isAudioEnabled, onJoinCall, onLeaveCall, onParticipantJoined, onParticipantLeft]);

  // Função para sair da chamada
  const leaveCall = useCallback(() => {
    console.log('📞 Encerrando videochamada...');
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
  }, []);

  // Alternar áudio
  const toggleAudio = useCallback(() => {
    if (callFrameRef.current) {
      const newState = !isAudioEnabled;
      callFrameRef.current.setLocalAudio(newState);
      setIsAudioEnabled(newState);
    }
  }, [isAudioEnabled]);

  // Alternar vídeo
  const toggleVideo = useCallback(() => {
    if (callFrameRef.current) {
      const newState = !isVideoEnabled;
      callFrameRef.current.setLocalVideo(newState);
      setIsVideoEnabled(newState);
    }
  }, [isVideoEnabled]);

  // Auto-iniciar quando tiver URL
  useEffect(() => {
    if (roomUrl && !isCallActive && !isConnecting && isMounted && !connectionError && !isJoiningRef.current) {
      console.log('🚀 Condições atendidas para auto-iniciar videochamada');
      
      // Aguardar um tempo para garantir que a sala esteja propagada
      const timer = setTimeout(() => {
        console.log('🎬 Auto-iniciando videochamada após delay de segurança');
        joinCall();
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [roomUrl, isCallActive, isConnecting, isMounted, connectionError]);

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
    <div className="fixed inset-0 w-full h-full bg-black overflow-hidden">
      {/* Container de vídeo - PIP fixo */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 bg-black"
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      />

      {/* Overlay com informações - sempre visível quando em chamada */}
      {isCallActive && (
        <>
          {/* Header com informações da chamada */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-white text-lg font-medium">
                  {isDoctor ? 'Consulta de Emergência' : `Dr. ${participants[0]?.user_name || 'Médico'}`}
                </h3>
                <p className="text-white/70 text-sm">
                  {formatDuration(callDuration)}
                </p>
              </div>
              {participants.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-white/70 text-sm">
                    {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Controles fixos na parte inferior */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-6">
            {/* Botão de Áudio */}
            <button
              onClick={toggleAudio}
              className={cn(
                "relative rounded-full transition-all duration-200 backdrop-blur-md",
                "w-16 h-16 flex items-center justify-center",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                isAudioEnabled 
                  ? "bg-white/20 hover:bg-white/30 border border-white/20" 
                  : "bg-red-500/90 hover:bg-red-600 border border-red-500"
              )}
              aria-label={isAudioEnabled ? "Desativar microfone" : "Ativar microfone"}
            >
              {isAudioEnabled ? (
                <Mic className="w-7 h-7 text-white" />
              ) : (
                <MicOff className="w-7 h-7 text-white" />
              )}
            </button>

            {/* Botão de Vídeo */}
            <button
              onClick={toggleVideo}
              className={cn(
                "relative rounded-full transition-all duration-200 backdrop-blur-md",
                "w-16 h-16 flex items-center justify-center",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                isVideoEnabled 
                  ? "bg-white/20 hover:bg-white/30 border border-white/20" 
                  : "bg-red-500/90 hover:bg-red-600 border border-red-500"
              )}
              aria-label={isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}
            >
              {isVideoEnabled ? (
                <Video className="w-7 h-7 text-white" />
              ) : (
                <VideoOff className="w-7 h-7 text-white" />
              )}
            </button>

            {/* Botão de Desligar - Maior e mais destacado */}
            <button
              onClick={leaveCall}
              className={cn(
                "relative rounded-full transition-all duration-200",
                "w-20 h-20 flex items-center justify-center",
                "bg-red-600 hover:bg-red-700 shadow-xl hover:shadow-2xl",
                "transform hover:scale-105 active:scale-95"
              )}
              aria-label="Encerrar chamada"
            >
              <Phone className="w-8 h-8 text-white rotate-[135deg]" />
            </button>
          </div>
        </>
      )}

      {/* Estado de conexão */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-40">
          <div className="text-center p-4">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white text-xl">Conectando...</p>
            <p className="text-white/60 text-sm mt-2">
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