import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, Phone, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TelemedicineDiagnostics } from '@/utils/telemedicine-diagnostics';
import RecordingControls from './RecordingControls';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Gerenciamento global de instâncias do Daily
declare global {
  interface Window {
    __dailyInstances?: Set<any>;
    __dailyCurrentInstance?: any;
    recordingControlsRef?: any;
  }
}

// Função para forçar limpeza de todas as instâncias
const forceCleanupAllDailyInstances = async () => {
  console.log('🧹 Forçando limpeza completa de todas as instâncias Daily...');
  
  // Limpar instâncias registradas
  if (window.__dailyInstances) {
    const instances = Array.from(window.__dailyInstances);
    for (const instance of instances) {
      try {
        if (instance && typeof instance.destroy === 'function') {
          await instance.destroy();
        }
      } catch (error) {
        console.warn('Erro ao limpar instância registrada:', error);
      }
    }
    window.__dailyInstances.clear();
  }
  
  // Tentar limpar instância global do Daily
  try {
    if (typeof DailyIframe !== 'undefined' && DailyIframe.getCallInstance) {
      const globalInstance = DailyIframe.getCallInstance();
      if (globalInstance) {
        console.log('🧹 Limpando instância global do Daily...');
        try {
          await globalInstance.leave();
        } catch (e) {
          // Ignorar erro se já saiu
        }
        await globalInstance.destroy();
      }
    }
  } catch (error) {
    console.warn('Erro ao limpar instância global:', error);
  }
  
  // Limpar referência atual
  if (window.__dailyCurrentInstance) {
    try {
      await window.__dailyCurrentInstance.destroy();
    } catch (error) {
      console.warn('Erro ao limpar instância atual:', error);
    }
    window.__dailyCurrentInstance = null;
  }
  
  // Aguardar um pouco para garantir limpeza completa
  await new Promise(resolve => setTimeout(resolve, 1000));
};

// Função para limpar todas as instâncias globais
const cleanupAllDailyInstances = async () => {
  if (!window.__dailyInstances) {
    window.__dailyInstances = new Set();
    return;
  }
  
  const instances = Array.from(window.__dailyInstances);
  for (const instance of instances) {
    try {
      if (instance && typeof instance.destroy === 'function') {
        await instance.destroy();
      }
    } catch (error) {
      console.warn('Erro ao limpar instância:', error);
    }
  }
  window.__dailyInstances.clear();
};

// Função para registrar uma nova instância
const registerDailyInstance = (instance: any) => {
  if (!window.__dailyInstances) {
    window.__dailyInstances = new Set();
  }
  window.__dailyInstances.add(instance);
  window.__dailyCurrentInstance = instance;
};

// Função para desregistrar uma instância
const unregisterDailyInstance = (instance: any) => {
  if (window.__dailyInstances) {
    window.__dailyInstances.delete(instance);
  }
  if (window.__dailyCurrentInstance === instance) {
    window.__dailyCurrentInstance = null;
  }
};

interface MinimalistVideoCallProps {
  roomUrl?: string;
  token?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  userName?: string;
  isDoctor?: boolean;
  appointmentId?: number;
  enableRecording?: boolean;
}

export default function MinimalistVideoCall({
  roomUrl,
  token,
  onJoinCall,
  onLeaveCall,
  onParticipantJoined,
  onParticipantLeft,
  userName = 'Você',
  isDoctor = false,
  appointmentId,
  enableRecording = true
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
  const [doctorSettings, setDoctorSettings] = useState<any>(null);

  // Buscar configurações do paciente quando for médico
  const { data: patientSettings } = useQuery({
    queryKey: ['patient-settings', appointmentId],
    queryFn: async () => {
      if (!isDoctor || !appointmentId) return null;
      
      try {
        // Buscar informações da consulta para obter o ID do paciente
        const appointmentResponse = await axios.get(`/api/appointments/${appointmentId}`);
        const patientId = appointmentResponse.data.user_id;
        
        // Buscar configurações do paciente
        const settingsResponse = await axios.get(`/api/users/${patientId}/settings`);
        return settingsResponse.data;
      } catch (error) {
        console.error('Erro ao buscar configurações do paciente:', error);
        return null;
      }
    },
    enabled: isDoctor && !!appointmentId
  });

  // Buscar configurações do médico
  const { data: doctorSettingsData } = useQuery({
    queryKey: ['/api/users/settings'],
    queryFn: async () => {
      if (!isDoctor) return null;
      
      try {
        const response = await axios.get('/api/users/settings');
        return response.data;
      } catch (error) {
        console.error('Erro ao buscar configurações do médico:', error);
        return null;
      }
    },
    enabled: isDoctor
  });

  // Marcar como montado e limpar instâncias conflitantes
  useEffect(() => {
    setIsMounted(true);
    
    // Limpar todas as instâncias existentes do Daily ao montar
    const initializeComponent = async () => {
      try {
        console.log('🧹 Inicializando componente de videochamada...');
        await forceCleanupAllDailyInstances();
      } catch (error) {
        console.log('ℹ️ Erro ao limpar instâncias existentes:', error);
      }
    };
    
    initializeComponent();
    
    // Adicionar estilos globais para esconder controles do Daily
    const style = document.createElement('style');
    style.textContent = `
      /* Esconder todos os controles do Daily.co */
      .daily-video-toplevel-div .daily-video-chrome,
      .daily-video-toplevel-div .daily-prejoin-chrome,
      .daily-video-toplevel-div [class*="controls"],
      .daily-video-toplevel-div [class*="topbar"],
      .daily-video-toplevel-div [class*="participant-label"],
      .daily-video-toplevel-div [class*="network-info"],
      .daily-video-toplevel-div [class*="screenshare-controls"] {
        display: none !important;
      }
      
      /* Forçar vídeo em tela cheia */
      .daily-video-toplevel-div video {
        object-fit: cover !important;
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      setIsMounted(false);
      document.head.removeChild(style);
    };
  }, []);

  // Atualizar configurações do médico
  useEffect(() => {
    if (doctorSettingsData) {
      setDoctorSettings(doctorSettingsData);
    }
  }, [doctorSettingsData]);

  // Determinar se deve gravar automaticamente
  const shouldAutoRecord = () => {
    if (!isDoctor || !patientSettings || !doctorSettings) return false;
    
    const patientAllowsRecording = patientSettings.privacy?.allowConsultationRecording !== false;
    const doctorAllowsRecording = doctorSettings.privacy?.allowConsultationRecording !== false;
    
    return patientAllowsRecording && doctorAllowsRecording;
  };

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
    if (!roomUrl || !videoContainerRef.current || isJoiningRef.current || isCallActive) {
      console.log('❌ Condições não atendidas para entrar na chamada:', {
        roomUrl: !!roomUrl,
        container: !!videoContainerRef.current,
        isJoining: isJoiningRef.current,
        isCallActive: isCallActive
      });
      return;
    }

    // Forçar limpeza completa antes de criar nova instância
    console.log('🧹 Forçando limpeza completa antes de criar nova instância...');
    try {
      await forceCleanupAllDailyInstances();
      if (callFrameRef.current) {
        unregisterDailyInstance(callFrameRef.current);
        callFrameRef.current = null;
      }
    } catch (error) {
      console.error('Erro ao limpar instâncias:', error);
    }

    isJoiningRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log('🎬 Iniciando videochamada minimalista...');
      
      // Verificação final antes de criar nova instância
      try {
        const existingInstance = DailyIframe.getCallInstance();
        if (existingInstance) {
          console.log('⚠️ Ainda existe uma instância ativa, forçando destruição...');
          await existingInstance.destroy();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.log('✅ Nenhuma instância ativa encontrada');
      }
      
      // Criar call frame com configuração mínima
      const callFrame = DailyIframe.createFrame(videoContainerRef.current, {
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0'
        },
        showLeaveButton: false,
        showFullscreenButton: false
      });

      callFrameRef.current = callFrame;
      
      // Registrar a nova instância no sistema global
      registerDailyInstance(callFrame);

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
          
          // Configurar interface após conectar
          setTimeout(() => {
            if (callFrame) {
              try {
                // Ocultar controles do Daily
                const iframe = videoContainerRef.current?.querySelector('iframe');
                if (iframe) {
                  // Aplicar CSS para esconder elementos desnecessários
                  const style = document.createElement('style');
                  style.textContent = `
                    .daily-video-call-controls { display: none !important; }
                    .daily-video-call-topbar { display: none !important; }
                    .daily-video-participant-label { display: none !important; }
                    .daily-video-local-cam-tile { 
                      position: fixed !important;
                      bottom: 20px !important;
                      right: 20px !important;
                      width: 100px !important;
                      height: 150px !important;
                      border-radius: 12px !important;
                      z-index: 10 !important;
                    }
                  `;
                  iframe.contentDocument?.head?.appendChild(style);
                }
                console.log('✅ Interface customizada aplicada');
              } catch (error) {
                console.log('Não foi possível customizar a interface:', error);
              }
            }
          }, 2000);
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
  const leaveCall = useCallback(async () => {
    console.log('🔴 Encerrando videochamada...');
    if (callFrameRef.current) {
      try {
        // Disparar evento para parar gravação automática
        if (window.recordingControlsRef) {
          window.recordingControlsRef.stopRecording();
        }
        
        // Sair da reunião
        await callFrameRef.current.leave();
        
        // Desregistrar e destruir a instância
        unregisterDailyInstance(callFrameRef.current);
        await callFrameRef.current.destroy();
        callFrameRef.current = null;
        isJoiningRef.current = false;
      } catch (error) {
        console.error('Erro ao sair da chamada:', error);
        if (callFrameRef.current) {
          unregisterDailyInstance(callFrameRef.current);
        }
        callFrameRef.current = null;
        isJoiningRef.current = false;
      }
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
      
      // Aguardar um tempo maior para garantir que não há conflitos
      const timer = setTimeout(() => {
        if (!isCallActive && !isConnecting && !isJoiningRef.current) {
          console.log('🎬 Auto-iniciando videochamada após delay de segurança');
          joinCall();
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [roomUrl, isCallActive, isConnecting, isMounted, connectionError, joinCall]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try {
          console.log('🧹 Limpando DailyIframe ao desmontar componente...');
          // Desregistrar a instância
          unregisterDailyInstance(callFrameRef.current);
          // Primeiro sair da reunião
          if (callFrameRef.current.meetingState() !== 'left-meeting') {
            callFrameRef.current.leave();
          }
          // Depois destruir a instância
          callFrameRef.current.destroy();
          callFrameRef.current = null;
        } catch (error) {
          console.error('Erro ao limpar DailyIframe:', error);
          callFrameRef.current = null;
        }
      }
      // Resetar flags
      isJoiningRef.current = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-black overflow-hidden">
      {/* Container de vídeo - Tela cheia */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 bg-black daily-video-container"
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
          {/* Header minimalista estilo FaceTime */}
          <div className="absolute top-0 left-0 right-0 p-6 z-20">
            <div className="flex justify-between items-center">
              {/* Nome do participante e tempo */}
              <div className="bg-black/40 backdrop-blur-xl rounded-full px-4 py-2">
                <p className="text-white text-sm font-medium">
                  {formatDuration(callDuration)}
                </p>
              </div>
              
              {/* Indicador de gravação para médicos */}
              {isDoctor && enableRecording && appointmentId && (
                <div className="bg-black/40 backdrop-blur-xl rounded-full">
                  <RecordingControls
                    appointmentId={appointmentId}
                    className="px-4 py-2"
                    autoStart={shouldAutoRecord()}
                    patientConsent={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Controles estilo FaceTime - flutuantes na parte inferior */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent z-30">
            <div className="flex items-center justify-center gap-4">
              {/* Botão de Mudo */}
              <button
                onClick={toggleAudio}
                className={cn(
                  "relative rounded-full transition-all duration-200",
                  "w-14 h-14 flex items-center justify-center",
                  "backdrop-blur-xl shadow-lg",
                  isAudioEnabled 
                    ? "bg-white/30 hover:bg-white/40 text-white" 
                    : "bg-white text-black"
                )}
                aria-label={isAudioEnabled ? "Silenciar" : "Ativar som"}
              >
                {isAudioEnabled ? (
                  <Mic className="w-6 h-6" />
                ) : (
                  <MicOff className="w-6 h-6" />
                )}
              </button>

              {/* Botão de Encerrar - Central e maior */}
              <button
                onClick={leaveCall}
                className={cn(
                  "relative rounded-full transition-all duration-200",
                  "w-16 h-16 flex items-center justify-center mx-4",
                  "bg-red-500 hover:bg-red-600 shadow-xl",
                  "transform hover:scale-105 active:scale-95"
                )}
                aria-label="Encerrar"
              >
                <Phone className="w-7 h-7 text-white rotate-[135deg]" />
              </button>

              {/* Botão de Câmera */}
              <button
                onClick={toggleVideo}
                className={cn(
                  "relative rounded-full transition-all duration-200",
                  "w-14 h-14 flex items-center justify-center",
                  "backdrop-blur-xl shadow-lg",
                  isVideoEnabled 
                    ? "bg-white/30 hover:bg-white/40 text-white" 
                    : "bg-white text-black"
                )}
                aria-label={isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}
              >
                {isVideoEnabled ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <VideoOff className="w-6 h-6" />
                )}
              </button>
            </div>
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