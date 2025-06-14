import React, { useState, useEffect } from 'react';
import { Circle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

interface RecordingControlsProps {
  appointmentId: number;
  onRecordingStart?: () => void;
  onRecordingStop?: (recordingId: number) => void;
  className?: string;
  autoStart?: boolean;
  patientConsent?: boolean;
}

export default function RecordingControls({
  appointmentId,
  onRecordingStart,
  onRecordingStop,
  className,
  autoStart = false,
  patientConsent = false
}: RecordingControlsProps) {
  const { toast } = useToast();
  const { state, startRecording, stopRecording, pauseRecording, resumeRecording } = useAudioRecording();
  const [isUploading, setIsUploading] = useState(false);
  const [hasConsent, setHasConsent] = useState(patientConsent);
  const [hasStarted, setHasStarted] = useState(false);

  // Expor métodos para controle externo
  useEffect(() => {
    if (autoStart) {
      (window as any).recordingControlsRef = {
        stopRecording: handleStopRecording
      };
    }
    
    return () => {
      if ((window as any).recordingControlsRef) {
        delete (window as any).recordingControlsRef;
      }
    };
  }, [autoStart]);

  // Formatador de duração
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Iniciar gravação automaticamente se configurado
  useEffect(() => {
    if (autoStart && hasConsent && !hasStarted && !state.isRecording) {
      setHasStarted(true);
      // Aguardar 5 segundos para garantir que a chamada está estável
      setTimeout(() => {
        handleStartRecording();
      }, 5000);
    }
  }, [autoStart, hasConsent, hasStarted, state.isRecording]);

  // Iniciar gravação automaticamente
  const handleStartRecording = async () => {
    await startRecording();
    onRecordingStart?.();
  };

  // Parar gravação e fazer upload
  const handleStopRecording = async () => {
    const audioBlob = await stopRecording();
    
    if (!audioBlob) {
      toast({
        title: 'Erro na gravação',
        description: 'Não foi possível obter o áudio gravado.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Criar FormData para upload
      const formData = new FormData();
      formData.append('audio', audioBlob, `consultation_${appointmentId}.webm`);
      formData.append('appointmentId', appointmentId.toString());

      // Fazer upload
      const response = await axios.post(
        `/api/consultation-recordings/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            console.log(`Upload: ${percentCompleted}%`);
          }
        }
      );

      if (response.data.success) {
        toast({
          title: 'Gravação salva',
          description: 'A gravação foi processada e o prontuário será gerado automaticamente.',
        });
        onRecordingStop?.(response.data.recordingId);
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.response?.data?.error || 'Falha ao enviar gravação.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Indicador de gravação */}
      {state.isRecording && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <Circle className="h-3 w-3 text-red-500 fill-red-500 animate-pulse" />
          <span>{formatDuration(state.duration)}</span>
        </div>
      )}

      {/* Erro */}
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Indicador de upload */}
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando gravação...
        </div>
      )}
    </div>
  );
}