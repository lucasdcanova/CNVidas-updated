import { useState, useRef, useCallback } from 'react';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
}

export interface UseAudioRecordingReturn {
  state: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  getAudioBlob: () => Blob | null;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    durationIntervalRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        duration: Math.floor((Date.now() - startTimeRef.current) / 1000)
      }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Resetar estado
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      setState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: null
      });

      // Solicitar permissão para o microfone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Criar MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;

      // Configurar eventos
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Criar blob final
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioBlobRef.current = audioBlob;

        // Limpar stream
        stream.getTracks().forEach(track => track.stop());
        
        stopDurationTimer();
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('Erro no MediaRecorder:', event.error);
        setState(prev => ({
          ...prev,
          error: 'Erro ao gravar áudio',
          isRecording: false
        }));
        stopDurationTimer();
      };

      // Iniciar gravação
      mediaRecorder.start(1000); // Coletar dados a cada 1 segundo
      startTimeRef.current = Date.now();
      startDurationTimer();

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        error: null
      });

    } catch (error: any) {
      console.error('Erro ao iniciar gravação:', error);
      setState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: error.message || 'Erro ao acessar microfone'
      });
    }
  }, [startDurationTimer, stopDurationTimer]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      // Configurar callback para quando a gravação parar
      const originalOnStop = mediaRecorderRef.current.onstop;
      mediaRecorderRef.current.onstop = (event) => {
        if (originalOnStop) {
          originalOnStop.call(mediaRecorderRef.current, event);
        }
        resolve(audioBlobRef.current);
      };

      // Parar gravação
      mediaRecorderRef.current.stop();
      
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false
      }));
    });
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({
        ...prev,
        isPaused: true
      }));
      stopDurationTimer();
    }
  }, [stopDurationTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState(prev => ({
        ...prev,
        isPaused: false
      }));
      startDurationTimer();
    }
  }, [startDurationTimer]);

  const getAudioBlob = useCallback(() => {
    return audioBlobRef.current;
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getAudioBlob
  };
}