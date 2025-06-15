import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall, DailyParticipant, DailyTrack, DailyTrackState } from '@daily-co/daily-js';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CustomDailyVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  isEmergency?: boolean;
  appointmentId?: number;
}

interface ParticipantTrackState {
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  isLocal: boolean;
}

export default function CustomDailyVideoCall({
  roomUrl,
  token,
  onJoinCall,
  onLeaveCall,
  isEmergency = false,
  appointmentId
}: CustomDailyVideoCallProps) {
  const { toast } = useToast();
  
  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callObjectRef = useRef<DailyCall | null>(null);
  
  // State
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<Map<string, ParticipantTrackState>>(new Map());
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  // Helper to update video element with track
  const updateVideoElement = (videoElement: HTMLVideoElement | null, track: MediaStreamTrack | null) => {
    if (!videoElement) return;
    
    if (track) {
      const stream = new MediaStream([track]);
      videoElement.srcObject = stream;
    } else {
      videoElement.srcObject = null;
    }
  };

  // Handle participant tracks update
  const handleParticipantUpdate = useCallback((participant: DailyParticipant) => {
    const { session_id, local, tracks } = participant;
    
    if (!tracks) return;
    
    const videoTrack = tracks.video?.persistentTrack || null;
    const audioTrack = tracks.audio?.persistentTrack || null;
    
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(session_id, {
        videoTrack,
        audioTrack,
        isLocal: local
      });
      return newMap;
    });
    
    // Update video elements
    if (local) {
      updateVideoElement(localVideoRef.current, videoTrack);
    } else {
      // For simplicity, we'll show the first remote participant
      updateVideoElement(remoteVideoRef.current, videoTrack);
    }
  }, []);

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
      // Calculate duration if we have a start time
      let duration = 0;
      if (callStartTime) {
        const endTime = new Date();
        duration = Math.floor((endTime.getTime() - callStartTime.getTime()) / 1000 / 60);
      }
      
      // Notify server about call end if we have an appointmentId
      if (appointmentId && duration > 0) {
        try {
          const response = await fetch(`/api/appointments/${appointmentId}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ duration })
          });
          
          const data = await response.json();
          if (data.paymentCaptured) {
            toast({
              title: 'Consulta finalizada',
              description: 'O pagamento foi processado com sucesso.',
            });
          }
        } catch (error) {
          console.error('Error marking appointment end:', error);
        }
      }
      
      // Leave and destroy call
      await callObjectRef.current.leave();
      await callObjectRef.current.destroy();
      callObjectRef.current = null;
      
      // Clear video elements
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      
      // Reset state
      setIsCallActive(false);
      setCallStartTime(null);
      setParticipants(new Map());
      
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
      // Request media permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      // Create call object
      const callObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
        showLeaveButton: false,
        showFullscreenButton: false
      });

      callObjectRef.current = callObject;

      // Set up event handlers
      callObject.on('joined-meeting', async () => {
        console.log('Joined meeting');
        setIsConnecting(false);
        setIsCallActive(true);
        setCallStartTime(new Date());
        
        // Notify server about call start
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
      });

      callObject.on('participant-joined', (event) => {
        if (event?.participant) {
          handleParticipantUpdate(event.participant);
        }
      });

      callObject.on('participant-updated', (event) => {
        if (event?.participant) {
          handleParticipantUpdate(event.participant);
        }
      });

      callObject.on('participant-left', (event) => {
        if (event?.participant) {
          const { session_id } = event.participant;
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.delete(session_id);
            return newMap;
          });
          
          // Clear remote video if it was this participant
          if (!event.participant.local && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        }
      });

      callObject.on('track-started', (event) => {
        if (event?.participant) {
          handleParticipantUpdate(event.participant);
        }
      });

      callObject.on('track-stopped', (event) => {
        if (event?.participant) {
          handleParticipantUpdate(event.participant);
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

      // Join the call
      const joinOptions: any = {
        url: roomUrl,
        showLeaveButton: false
      };
      
      if (token) {
        joinOptions.token = token;
      }

      await callObject.join(joinOptions);

      // Get initial participants
      const currentParticipants = callObject.participants();
      Object.values(currentParticipants).forEach(participant => {
        handleParticipantUpdate(participant);
      });

    } catch (error) {
      console.error('Error joining call:', error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar à sala de consulta',
        variant: 'destructive'
      });
      setIsConnecting(false);
      
      // Cleanup on error
      if (callObjectRef.current) {
        try {
          await callObjectRef.current.destroy();
          callObjectRef.current = null;
        } catch (cleanupError) {
          console.error('Error cleaning up:', cleanupError);
        }
      }
    }
  }, [roomUrl, token, isEmergency, appointmentId, onJoinCall, onLeaveCall, handleParticipantUpdate, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        callObjectRef.current.leave().catch(console.error);
        callObjectRef.current.destroy().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden">
      {/* Remote video (full screen) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Local video (PIP) */}
      <div className="absolute top-4 right-4 w-32 h-44 bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      {/* Loading state */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-lg">Conectando...</p>
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
              className="bg-green-600 hover:bg-green-700"
            >
              Iniciar Videochamada
            </Button>
          </div>
        </div>
      )}

      {/* Controls */}
      {isCallActive && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full h-14 w-14 ${
              !isAudioEnabled 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-zinc-800/90 hover:bg-zinc-700 text-white backdrop-blur-sm'
            }`}
            onClick={toggleAudio}
          >
            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full h-14 w-14 ${
              !isVideoEnabled 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-zinc-800/90 hover:bg-zinc-700 text-white backdrop-blur-sm'
            }`}
            onClick={toggleVideo}
          >
            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-14 w-14 bg-red-600 hover:bg-red-700 text-white"
            onClick={leaveCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}