import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall, DailyEventObject, DailyParticipant } from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, Phone, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaceTimeVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  userName?: string;
  isDoctor?: boolean;
}

export default function FaceTimeVideoCall({
  roomUrl,
  token,
  onJoinCall,
  onLeaveCall,
  onParticipantJoined,
  onParticipantLeft,
  userName = 'Você',
  isDoctor = false
}: FaceTimeVideoCallProps) {
  const callRef = useRef<DailyCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<{ [id: string]: DailyParticipant }>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isPipMode, setIsPipMode] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string>('');
  const callStartTimeRef = useRef<number>(0);
  const hasAutoStartedRef = useRef(false);

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

  // Atualizar streams de vídeo
  const updateVideoStreams = useCallback(() => {
    if (!callRef.current) return;

    const participants = callRef.current.participants();
    const localParticipant = participants.local;

    // Atualizar vídeo local
    if (localParticipant?.tracks?.video?.persistentTrack && localVideoRef.current) {
      const track = localParticipant.tracks.video.persistentTrack;
      const stream = new MediaStream([track]);
      setLocalStream(stream);
      localVideoRef.current.srcObject = stream;
    }

    // Atualizar vídeo remoto (primeiro participante que não seja local)
    const remoteParticipant = Object.values(participants).find(p => p.session_id !== 'local');
    if (remoteParticipant) {
      // Atualizar nome do participante remoto
      setRemoteParticipantName(remoteParticipant.user_name || 'Participante');
      
      if (remoteParticipant.tracks?.video?.persistentTrack && remoteVideoRef.current) {
        const track = remoteParticipant.tracks.video.persistentTrack;
        const stream = new MediaStream([track]);
        
        // Adicionar áudio se disponível
        if (remoteParticipant.tracks?.audio?.persistentTrack) {
          stream.addTrack(remoteParticipant.tracks.audio.persistentTrack);
        }
        
        setRemoteStream(stream);
        remoteVideoRef.current.srcObject = stream;
      }
    }
  }, []);

  // Conectar à chamada
  const joinCall = useCallback(async () => {
    if (!roomUrl || isCallActive || !hasAutoStartedRef.current) return;

    setIsConnecting(true);

    try {
      // Criar instância do Daily
      const callInstance = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
        dailyConfig: {
          useDevicePreferenceCookies: true,
        }
      });

      callRef.current = callInstance;

      // Configurar event listeners
      callInstance.on('joining-meeting', () => {
        console.log('Entrando na reunião...');
      });

      callInstance.on('joined-meeting', () => {
        console.log('Conectado à reunião');
        setIsConnecting(false);
        setIsCallActive(true);
        callStartTimeRef.current = Date.now();
        updateVideoStreams();
        if (onJoinCall) onJoinCall();
      });

      callInstance.on('participant-joined', (event: DailyEventObject) => {
        console.log('Participante entrou:', event.participant?.user_name);
        setParticipants(callInstance.participants());
        updateVideoStreams();
        if (onParticipantJoined) onParticipantJoined(event.participant);
      });

      callInstance.on('participant-updated', (event: DailyEventObject) => {
        setParticipants(callInstance.participants());
        updateVideoStreams();
      });

      callInstance.on('participant-left', (event: DailyEventObject) => {
        console.log('Participante saiu:', event.participant?.user_name);
        setParticipants(callInstance.participants());
        updateVideoStreams();
        if (onParticipantLeft) onParticipantLeft(event.participant);
      });

      callInstance.on('track-started', () => {
        updateVideoStreams();
      });

      callInstance.on('track-stopped', () => {
        updateVideoStreams();
      });

      callInstance.on('error', (error: DailyEventObject) => {
        console.error('Erro na chamada:', error);
        setIsConnecting(false);
      });

      // Configurar opções de entrada
      const joinOptions: any = {
        url: roomUrl,
        userName: userName || 'Participante'
      };

      if (token && typeof token === 'string' && token.trim() !== '') {
        joinOptions.token = token;
      }

      // Entrar na sala
      await callInstance.join(joinOptions);

    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      setIsConnecting(false);
    }
  }, [roomUrl, token, userName, isCallActive, onJoinCall, onParticipantJoined, onParticipantLeft, updateVideoStreams]);

  // Sair da chamada
  const leaveCall = useCallback(async () => {
    if (callRef.current) {
      try {
        await callRef.current.leave();
        await callRef.current.destroy();
        callRef.current = null;
      } catch (error) {
        console.error('Erro ao sair da chamada:', error);
      }
      
      setIsCallActive(false);
      setCallDuration(0);
      callStartTimeRef.current = 0;
      if (onLeaveCall) onLeaveCall();
    }
  }, [onLeaveCall]);

  // Alternar áudio
  const toggleAudio = useCallback(() => {
    if (callRef.current) {
      callRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [isAudioEnabled]);

  // Alternar vídeo
  const toggleVideo = useCallback(() => {
    if (callRef.current) {
      callRef.current.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled]);

  // Alternar Picture-in-Picture
  const togglePip = useCallback(() => {
    setIsPipMode(!isPipMode);
  }, [isPipMode]);

  // Auto-iniciar quando tiver URL
  useEffect(() => {
    if (roomUrl && !isCallActive && !isConnecting && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      const timer = setTimeout(() => {
        console.log('Auto-iniciando videochamada estilo FaceTime');
        joinCall();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [roomUrl, isCallActive, isConnecting, joinCall]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.leave();
        callRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-black overflow-hidden">
      {/* Layout vertical estilo FaceTime */}
      <div className="relative w-full h-full flex flex-col">
        {/* Vídeo remoto (tela principal) */}
        <div className="relative flex-1 bg-gray-900">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Overlay com informações quando não há vídeo remoto */}
          {isCallActive && !remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-16 h-16 text-gray-600" />
                </div>
                <p className="text-white/60 text-lg">Aguardando {isDoctor ? 'paciente' : 'médico'} entrar na sala...</p>
              </div>
            </div>
          )}

          {/* Header com informações */}
          {isCallActive && (
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white text-lg font-medium">
                    {isDoctor 
                      ? remoteParticipantName || 'Aguardando paciente...'
                      : remoteParticipantName ? `Dr. ${remoteParticipantName}` : 'Aguardando médico...'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {formatDuration(callDuration)}
                  </p>
                </div>
                <button
                  onClick={togglePip}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                  aria-label="Alternar modo Picture-in-Picture"
                >
                  {isPipMode ? (
                    <Maximize2 className="w-5 h-5 text-white" />
                  ) : (
                    <Minimize2 className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Vídeo local (câmera frontal) - Posição diferente baseada no modo PiP */}
        <div className={cn(
          "absolute transition-all duration-300",
          isPipMode ? [
            "bottom-4 right-4 w-32 h-48 md:w-40 md:h-60",
            "rounded-2xl overflow-hidden shadow-2xl",
            "border-2 border-white/20"
          ] : [
            "bottom-0 left-0 right-0 h-1/3",
            "border-t border-gray-800"
          ]
        )}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover bg-gray-900"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Overlay quando vídeo local está desligado */}
          {isCallActive && !isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <VideoOff className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Câmera desligada</p>
              </div>
            </div>
          )}
        </div>

        {/* Controles de chamada */}
        {isCallActive && (
          <div className={cn(
            "absolute z-30 flex items-center justify-center gap-6",
            isPipMode ? "bottom-20 left-1/2 -translate-x-1/2" : "bottom-1/3 left-1/2 -translate-x-1/2 translate-y-12"
          )}>
            {/* Botão de Áudio */}
            <button
              onClick={toggleAudio}
              className={cn(
                "relative rounded-full transition-all duration-200",
                "w-16 h-16 flex items-center justify-center",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                "backdrop-blur-md",
                isAudioEnabled 
                  ? "bg-white/90 hover:bg-white text-black" 
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
              aria-label={isAudioEnabled ? "Desativar microfone" : "Ativar microfone"}
            >
              {isAudioEnabled ? (
                <Mic className="w-7 h-7" />
              ) : (
                <MicOff className="w-7 h-7" />
              )}
            </button>

            {/* Botão de Vídeo */}
            <button
              onClick={toggleVideo}
              className={cn(
                "relative rounded-full transition-all duration-200",
                "w-16 h-16 flex items-center justify-center",
                "shadow-lg hover:shadow-xl transform hover:scale-105",
                "backdrop-blur-md",
                isVideoEnabled 
                  ? "bg-white/90 hover:bg-white text-black" 
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
              aria-label={isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}
            >
              {isVideoEnabled ? (
                <Video className="w-7 h-7" />
              ) : (
                <VideoOff className="w-7 h-7" />
              )}
            </button>

            {/* Botão de Desligar */}
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
        )}
      </div>

      {/* Estado de conexão */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-40">
          <div className="text-center p-4">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white text-xl">Conectando...</p>
            <p className="text-white/60 text-sm mt-2">Preparando sua consulta</p>
          </div>
        </div>
      )}
    </div>
  );
}