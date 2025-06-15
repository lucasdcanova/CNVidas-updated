import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import DailyIframe, { 
  DailyCall, 
  DailyParticipant, 
  DailyEventObjectParticipant,
  DailyEventObjectTrack,
  DailyTrackState,
  DailyParticipantUpdateOptions
} from '@daily-co/daily-js';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface HeadlessDailyVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  isEmergency?: boolean;
  appointmentId?: number;
}

interface VideoParticipant {
  id: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isLocal: boolean;
  userName?: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

// Custom hook to manage video element refs
function useVideoRefs() {
  const refs = useRef<Map<string, HTMLVideoElement>>(new Map());
  
  const setRef = useCallback((id: string, element: HTMLVideoElement | null) => {
    if (element) {
      refs.current.set(id, element);
    } else {
      refs.current.delete(id);
    }
  }, []);
  
  const getRef = useCallback((id: string) => {
    return refs.current.get(id);
  }, []);
  
  return { setRef, getRef };
}

export default function HeadlessDailyVideoCall({
  roomUrl,
  token,
  onJoinCall,
  onLeaveCall,
  isEmergency = false,
  appointmentId
}: HeadlessDailyVideoCallProps) {
  const { toast } = useToast();
  const callObjectRef = useRef<DailyCall | null>(null);
  const { setRef: setVideoRef, getRef: getVideoRef } = useVideoRefs();
  
  // State
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<Map<string, VideoParticipant>>(new Map());
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);

  // Get sorted participants (local first, then remote)
  const sortedParticipants = useMemo(() => {
    return Array.from(participants.values()).sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return 0;
    });
  }, [participants]);

  // Get remote participants only
  const remoteParticipants = useMemo(() => {
    return sortedParticipants.filter(p => !p.isLocal);
  }, [sortedParticipants]);

  // Get local participant
  const localParticipant = useMemo(() => {
    return sortedParticipants.find(p => p.isLocal);
  }, [sortedParticipants]);

  // Update video element with track
  const updateVideoElement = useCallback((participantId: string, track: MediaStreamTrack | null) => {
    const videoElement = getVideoRef(participantId);
    if (!videoElement) return;
    
    if (track) {
      const stream = new MediaStream([track]);
      videoElement.srcObject = stream;
      videoElement.play().catch(e => console.warn('Video play failed:', e));
    } else {
      videoElement.srcObject = null;
    }
  }, [getVideoRef]);

  // Update participant state
  const updateParticipant = useCallback((participant: DailyParticipant) => {
    const { session_id, local, tracks, user_name } = participant;
    
    const videoTrack = tracks?.video?.persistentTrack || null;
    const audioTrack = tracks?.audio?.persistentTrack || null;
    const videoState = tracks?.video?.state;
    const audioState = tracks?.audio?.state;
    
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(session_id, {
        id: session_id,
        videoTrack,
        audioTrack,
        isLocal: local || false,
        userName: user_name,
        videoEnabled: videoState === 'playable' || videoState === 'loading',
        audioEnabled: audioState === 'playable' || audioState === 'loading'
      });
      return newMap;
    });
    
    // Update video element
    updateVideoElement(session_id, videoTrack);
    
    // Store local participant ID
    if (local) {
      setLocalParticipantId(session_id);
    }
  }, [updateVideoElement]);

  // Remove participant
  const removeParticipant = useCallback((participantId: string) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });
    
    // Clear video element
    const videoElement = getVideoRef(participantId);
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }, [getVideoRef]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!callObjectRef.current) return;
    
    try {
      await callObjectRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    } catch (error) {
      console.error('Error toggling audio:', error);
      toast({
        title: 'Erro ao alternar áudio',
        description: 'Não foi possível alterar o estado do microfone',
        variant: 'destructive'
      });
    }
  }, [isAudioEnabled, toast]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!callObjectRef.current) return;
    
    try {
      await callObjectRef.current.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    } catch (error) {
      console.error('Error toggling video:', error);
      toast({
        title: 'Erro ao alternar vídeo',
        description: 'Não foi possível alterar o estado da câmera',
        variant: 'destructive'
      });
    }
  }, [isVideoEnabled, toast]);

  // Leave call
  const leaveCall = useCallback(async () => {
    if (!callObjectRef.current) return;
    
    try {
      // Calculate duration
      let duration = 0;
      if (callStartTime) {
        const endTime = new Date();
        duration = Math.floor((endTime.getTime() - callStartTime.getTime()) / 1000 / 60);
      }
      
      // Notify server if needed
      if (appointmentId && duration > 0) {
        try {
          await fetch(`/api/appointments/${appointmentId}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ duration })
          });
        } catch (error) {
          console.error('Error marking appointment end:', error);
        }
      }
      
      // Leave and destroy
      await callObjectRef.current.leave();
      await callObjectRef.current.destroy();
      callObjectRef.current = null;
      
      // Clear state
      setIsCallActive(false);
      setCallStartTime(null);
      setParticipants(new Map());
      setLocalParticipantId(null);
      
      if (onLeaveCall) onLeaveCall();
    } catch (error) {
      console.error('Error leaving call:', error);
      toast({
        title: 'Erro ao sair',
        description: 'Ocorreu um erro ao encerrar a chamada',
        variant: 'destructive'
      });
    }
  }, [callStartTime, appointmentId, onLeaveCall, toast]);

  // Join call
  const joinCall = useCallback(async () => {
    if (!roomUrl) {
      toast({
        title: 'Erro',
        description: 'URL da sala não fornecido',
        variant: 'destructive'
      });
      return;
    }

    setIsConnecting(true);

    try {
      // Request permissions
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      // Create call object with custom settings
      const callObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
        showLeaveButton: false,
        showFullscreenButton: false,
        showLocalVideo: false,
        showParticipantsBar: false,
        showScreenShareButton: false,
        showChatButton: false,
        audioSource: true,
        videoSource: true
      });

      callObjectRef.current = callObject;

      // Set up comprehensive event handlers
      callObject.on('joined-meeting', async (event) => {
        console.log('Joined meeting', event);
        setIsConnecting(false);
        setIsCallActive(true);
        setCallStartTime(new Date());
        
        // Mark appointment as started
        if (appointmentId) {
          try {
            await fetch(`/api/appointments/${appointmentId}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include'
            });
          } catch (error) {
            console.error('Error marking appointment start:', error);
          }
        }
        
        if (onJoinCall) onJoinCall();
        
        toast({
          title: 'Conectado',
          description: isEmergency 
            ? 'Você está em uma consulta de emergência' 
            : 'Você está conectado à sala de consulta'
        });
        
        // Get all current participants
        const allParticipants = callObject.participants();
        Object.values(allParticipants).forEach(updateParticipant);
      });

      callObject.on('participant-joined', (event: DailyEventObjectParticipant) => {
        console.log('Participant joined:', event);
        if (event?.participant) {
          updateParticipant(event.participant);
        }
      });

      callObject.on('participant-updated', (event: DailyEventObjectParticipant) => {
        console.log('Participant updated:', event);
        if (event?.participant) {
          updateParticipant(event.participant);
        }
      });

      callObject.on('participant-left', (event: DailyEventObjectParticipant) => {
        console.log('Participant left:', event);
        if (event?.participant) {
          removeParticipant(event.participant.session_id);
          
          if (!event.participant.local) {
            toast({
              title: 'Participante desconectado',
              description: 'Um participante saiu da sala'
            });
          }
        }
      });

      callObject.on('track-started', (event: DailyEventObjectTrack) => {
        console.log('Track started:', event);
        if (event?.participant) {
          updateParticipant(event.participant);
        }
      });

      callObject.on('track-stopped', (event: DailyEventObjectTrack) => {
        console.log('Track stopped:', event);
        if (event?.participant) {
          updateParticipant(event.participant);
        }
      });

      callObject.on('error', (error) => {
        console.error('Call error:', error);
        toast({
          title: 'Erro na chamada',
          description: 'Ocorreu um erro durante a chamada',
          variant: 'destructive'
        });
        setIsConnecting(false);
      });

      callObject.on('left-meeting', () => {
        console.log('Left meeting');
        setIsCallActive(false);
        if (onLeaveCall) onLeaveCall();
      });

      // Join with options
      const joinOptions: any = {
        url: roomUrl,
        showLeaveButton: false,
        showFullscreenButton: false
      };
      
      if (token) {
        joinOptions.token = token;
      }

      await callObject.join(joinOptions);

    } catch (error) {
      console.error('Error joining call:', error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar à sala de consulta',
        variant: 'destructive'
      });
      setIsConnecting(false);
      
      // Cleanup
      if (callObjectRef.current) {
        try {
          await callObjectRef.current.destroy();
          callObjectRef.current = null;
        } catch (cleanupError) {
          console.error('Error cleaning up:', cleanupError);
        }
      }
    }
  }, [roomUrl, token, isEmergency, appointmentId, onJoinCall, onLeaveCall, updateParticipant, removeParticipant, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        callObjectRef.current.leave().catch(console.error);
        callObjectRef.current.destroy().catch(console.error);
      }
    };
  }, []);

  // Video element component
  const VideoElement = ({ participant }: { participant: VideoParticipant }) => {
    return (
      <div className="relative w-full h-full">
        <video
          ref={(el) => setVideoRef(participant.id, el)}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="w-full h-full object-cover"
        />
        {!participant.videoEnabled && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <div className="text-center">
              <Video className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Câmera desligada</p>
            </div>
          </div>
        )}
        {participant.userName && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
            {participant.userName}
          </div>
        )}
        {!participant.audioEnabled && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1 rounded">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden">
      {/* Main video area */}
      {isCallActive && remoteParticipants.length > 0 && (
        <div className="absolute inset-0">
          <VideoElement participant={remoteParticipants[0]} />
        </div>
      )}

      {/* Local video PIP */}
      {isCallActive && localParticipant && (
        <div className="absolute top-4 right-4 w-32 h-44 bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
          <VideoElement participant={localParticipant} />
        </div>
      )}

      {/* Loading state */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-lg">Conectando...</p>
            <p className="text-sm text-zinc-400 mt-2">Preparando sua consulta...</p>
          </div>
        </div>
      )}

      {/* Initial state */}
      {!isCallActive && !isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
          <div className="text-center text-white">
            <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">
              {isEmergency ? 'Consulta de Emergência' : 'Consulta por Vídeo'}
            </h3>
            <p className="text-sm text-zinc-400 mb-6 max-w-md">
              {isEmergency 
                ? 'Conecte-se imediatamente com um médico disponível'
                : 'Entre na sala para iniciar sua consulta agendada'}
            </p>
            <Button
              onClick={joinCall}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              Iniciar Videochamada
            </Button>
          </div>
        </div>
      )}

      {/* Waiting for remote participant */}
      {isCallActive && remoteParticipants.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
          <div className="text-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">Aguardando participante...</p>
            <p className="text-sm text-zinc-400 mt-2">
              {isEmergency ? 'Um médico entrará em breve' : 'O médico entrará em instantes'}
            </p>
          </div>
        </div>
      )}

      {/* Controls - FaceTime style */}
      {isCallActive && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full p-2">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full h-12 w-12 transition-all ${
                !isAudioEnabled 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              onClick={toggleAudio}
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full h-12 w-12 transition-all ${
                !isVideoEnabled 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              onClick={toggleVideo}
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 bg-red-600 hover:bg-red-700 text-white ml-6"
              onClick={leaveCall}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}