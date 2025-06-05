import React, { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import AgoraRTC, { 
  AgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  DeviceInfo
} from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EmergencyRoomProps {
  patientMode?: boolean;
  doctorMode?: boolean;
  appointmentId?: string;
}

interface PatientInfo {
  id: number;
  name: string;
  profileImage: string | null;
}

interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: number;
  appId: string;
  patientInfo?: PatientInfo;
  role: 'patient' | 'doctor' | 'admin' | 'partner';
}

const TelemedicineEmergencyV4: React.FC<EmergencyRoomProps> = ({ patientMode, doctorMode, appointmentId }) => {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const [client, setClient] = useState<AgoraRTCClient | null>(null);
  const [localTracks, setLocalTracks] = useState<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [consultationStartTime, setConsultationStartTime] = useState<Date | null>(null);
  const [consultationDuration, setConsultationDuration] = useState(0);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tentar usar dados da sessão anterior primeiro, depois fazer chamada API
  const { mutate: getToken, data: tokenData, isPending: isLoadingToken, error: tokenError } = useMutation({
    mutationFn: async () => {
      try {
        // Tentar recuperar dados de emergência do localStorage primeiro
        const storedData = localStorage.getItem('agora-emergency-data');
        
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            console.log('Usando dados do Agora armazenados:', parsedData);
            // Limpar dados após uso
            localStorage.removeItem('agora-emergency-data');
            return parsedData;
          } catch (e) {
            console.error('Erro ao processar dados armazenados:', e);
            // Se falhar ao processar dados armazenados, continuar para API
          }
        }
        
        // Se não tiver dados armazenados ou falhar ao processá-los, fazer chamada API
        console.log('Obtendo token da API, ID da consulta:', appointmentId);
        
        const response = await fetch('/api/agora/v4/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'X-Auth-Token': localStorage.getItem('authToken')
          },
          credentials: 'include',
          body: JSON.stringify({ appointmentId })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro ao obter token da API:', response.status, errorText);
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log('Resposta bruta da API:', responseText);
        
        try {
          return JSON.parse(responseText);
        } catch (jsonError) {
          console.error('Erro ao processar JSON da resposta:', jsonError);
          throw new Error('Resposta da API não é um JSON válido');
        }
      } catch (error) {
        console.error('Erro geral na obtenção do token:', error);
        throw error;
      }
    },
    onSuccess: (data: AgoraTokenResponse) => {
      console.log('Token obtido com sucesso:', data);
      if (data.patientInfo) {
        setPatientInfo(data.patientInfo);
      }
      initializeAgoraClient(data);
    },
    onError: (error) => {
      console.error("Erro detalhado ao obter token:", error);
      toast({
        title: "Erro ao obter token",
        description: "Não foi possível conectar à sala de emergência. Detalhes: " + (error.message || "Erro desconhecido"),
        variant: "destructive",
      });
    }
  });

  // Iniciar obtenção de token ao carregar o componente
  useEffect(() => {
    console.log('Verificando autenticação do usuário...');
    
    // Iniciar o processo de obtenção do token quando o componente for carregado
    if (patientMode || doctorMode || appointmentId) {
      getToken();
    }
  }, [patientMode, doctorMode, appointmentId, getToken]);

  // Iniciar rastreamento de duração da consulta
  useEffect(() => {
    if (remoteUser && !consultationStartTime) {
      // Definir o tempo de início da consulta
      const startTime = new Date();
      setConsultationStartTime(startTime);
      
      // Iniciar o cronômetro da consulta
      intervalRef.current = setInterval(() => {
        const now = new Date();
        // Usar o startTime capturado no fechamento em vez da variável de estado
        const durationInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setConsultationDuration(durationInSeconds);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [remoteUser, consultationStartTime]);

  // Finalizar consulta (para médicos)
  const endConsultationMutation = useMutation({
    mutationFn: () => {
      return apiRequest("POST", `/api/agora/end-consultation/${appointmentId || tokenData?.channelName}`, {
        duration: consultationDuration,
      });
    },
    onSuccess: () => {
      toast({
        title: "Consulta finalizada",
        description: "A consulta foi finalizada com sucesso.",
      });
      
      leaveChannel();
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Erro ao finalizar consulta",
        description: "Ocorreu um erro ao finalizar a consulta. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao finalizar consulta:", error);
    },
  });

  // Inicializar cliente Agora
  // Verificar disponibilidade de dispositivos de mídia
  const checkMediaDevices = async () => {
    try {
      // Verificar permissões de mídia
      console.log('Verificando dispositivos de mídia...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioDevice = devices.some((device: DeviceInfo) => device.kind === 'audioinput');
      const hasVideoDevice = devices.some((device: DeviceInfo) => device.kind === 'videoinput');
      
      console.log('Dispositivos disponíveis:', {
        audio: hasAudioDevice ? 'Sim' : 'Não',
        video: hasVideoDevice ? 'Sim' : 'Não'
      });
      
      if (!hasAudioDevice || !hasVideoDevice) {
        toast({
          title: "Verificação de dispositivos",
          description: `Atenção: ${!hasAudioDevice ? 'Microfone não detectado. ' : ''}${!hasVideoDevice ? 'Câmera não detectada.' : ''}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao verificar dispositivos:', error);
      toast({
        title: "Erro ao verificar dispositivos",
        description: "Não foi possível verificar os dispositivos de mídia.",
        variant: "destructive",
      });
    }
  };

  const initializeAgoraClient = async (tokenData: AgoraTokenResponse) => {
    try {
      console.log('Verificando permissões de mídia...');
      await checkMediaDevices();
      
      // Verificar se as ferramentas globais do Agora estão disponíveis
      if (!window.AgoraRTC) {
        console.error("AgoraRTC não está disponível na janela global");
        toast({
          title: "Erro crítico",
          description: "Biblioteca de vídeo não foi carregada corretamente. Recarregue a página.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Inicializando Agora.io com dados:', {
        appId: tokenData.appId,
        channelName: tokenData.channelName,
        token: tokenData.token ? `${tokenData.token.substring(0, 20)}...` : 'indefinido', // Não mostrar token completo por segurança
        uid: tokenData.uid
      });
      
      // Verificar se temos os dados necessários
      if (!tokenData.appId || !tokenData.channelName || !tokenData.token) {
        throw new Error('Dados de configuração do Agora.io incompletos');
      }
      
      // Usar o objeto global do AgoraRTC
      const AgoraRTC = window.AgoraRTC;
      
      // Verificar disponibilidade de dispositivos antes de criar o cliente
      console.log('Verificando dispositivos disponíveis...');
      const devices = await AgoraRTC.getDevices();
      const hasAudioDevice = devices.some(device => device.kind === 'audioinput');
      const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
      
      console.log(`Dispositivos disponíveis: Áudio=${hasAudioDevice}, Vídeo=${hasVideoDevice}`);
      
      // Inicializar cliente AgoraRTC
      console.log('Criando cliente Agora RTC...');
      const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      setClient(rtcClient);

      // Configurar handlers de eventos
      console.log('Configurando handlers de eventos...');
      rtcClient.on("user-published", handleUserPublished);
      rtcClient.on("user-unpublished", handleUserUnpublished);
      rtcClient.on("user-left", handleUserLeft);
      
      // Adicionar listeners para erros de conexão com feedback mais detalhado
      rtcClient.on("connection-state-change", (curState: string, prevState: string) => {
        console.log("Mudança de estado da conexão:", prevState, "->", curState);
        
        if (curState === "CONNECTED") {
          toast({
            title: "Conectado",
            description: "Conexão com a sala de emergência estabelecida com sucesso.",
          });
        } else if (curState === "CONNECTING") {
          console.log("Conectando ao servidor Agora.io...");
        } else if (curState === "DISCONNECTED") {
          toast({
            title: "Desconectado",
            description: "Você foi desconectado da sala. Tentando reconectar...",
            variant: "destructive",
          });
        } else if (curState === "RECONNECTING") {
          toast({
            title: "Reconectando",
            description: "Tentando restabelecer a conexão...",
          });
        }
      });
      
      // Configurar manipulador de erros global do cliente
      rtcClient.on("exception", (event: any) => {
        console.error("Exceção do Agora:", event);
      });

      // Entrar no canal
      console.log('Entrando no canal Agora.io...');
      try {
        await rtcClient.join(
          tokenData.appId,
          tokenData.channelName,
          tokenData.token,
          tokenData.uid
        );
        console.log('Entrou com sucesso no canal:', tokenData.channelName);
      } catch (joinError: any) {
        console.error('Erro ao entrar no canal:', joinError);
        
        // Análise mais detalhada do erro de conexão
        const errorMessage = joinError.toString();
        if (errorMessage.includes("token")) {
          toast({
            title: "Erro de autenticação",
            description: "Token inválido ou expirado. Recarregue a página.",
            variant: "destructive",
          });
        } else if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
          toast({
            title: "Erro de rede",
            description: "Falha na conexão com o servidor. Verifique sua internet.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro de conexão",
            description: "Não foi possível conectar à sala de emergência. Código: " + (joinError.code || "desconhecido"),
            variant: "destructive",
          });
        }
        throw joinError;
      }

      // Criar e publicar tracks locais
      console.log('Criando tracks de áudio e vídeo...');
      let microphoneTrack = null, cameraTrack = null;
      
      // Abordagem sequencial para diagnósticos mais precisos
      if (hasAudioDevice && hasVideoDevice) {
        try {
          console.log('Tentando criar track de áudio...');
          microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true, // Echo cancellation
            ANS: true, // Automatic noise suppression
          });
          console.log('Track de áudio criado com sucesso');
          
          try {
            console.log('Tentando criar track de vídeo...');
            cameraTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: "standard",
              facingMode: "user",
            });
            console.log('Track de vídeo criado com sucesso');
            
            // Ambos os tracks criados com sucesso
            setLocalTracks([microphoneTrack, cameraTrack]);
          } catch (videoError) {
            console.error('Erro ao criar track de vídeo:', videoError);
            toast({
              title: "Problema com a câmera",
              description: "Não foi possível acessar sua câmera. Continuando apenas com áudio.",
              variant: "default",
            });
            
            // Apenas áudio disponível
            setLocalTracks([microphoneTrack, null]);
          }
        } catch (audioError) {
          console.error('Erro ao criar track de áudio:', audioError);
          
          // Tentar apenas vídeo como última tentativa
          try {
            console.log('Tentando criar apenas track de vídeo...');
            cameraTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: "standard",
              facingMode: "user",
            });
            console.log('Track de vídeo criado com sucesso');
            
            toast({
              title: "Problema com o microfone",
              description: "Não foi possível acessar seu microfone. Continuando apenas com vídeo.",
              variant: "default",
            });
            
            // @ts-ignore - Ignorar erro de tipo para permitir null em microphoneTrack
            setLocalTracks([null, cameraTrack]);
          } catch (completeError) {
            console.error('Erro ao criar qualquer track de mídia:', completeError);
            toast({
              title: "Erro de mídia",
              description: "Não foi possível acessar seu microfone ou câmera. Verifique as permissões.",
              variant: "destructive",
            });
            throw new Error('Falha ao acessar dispositivos de mídia');
          }
        }
      } else if (hasAudioDevice) {
        // Apenas microfone disponível
        try {
          microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalTracks([microphoneTrack, null]);
          toast({
            title: "Apenas áudio disponível",
            description: "Não detectamos uma câmera no seu dispositivo.",
            variant: "default",
          });
        } catch (audioError) {
          console.error('Erro ao criar track de áudio:', audioError);
          toast({
            title: "Erro de áudio",
            description: "Não foi possível acessar seu microfone. Verifique as permissões.",
            variant: "destructive",
          });
          throw new Error('Falha ao acessar microfone');
        }
      } else if (hasVideoDevice) {
        // Apenas câmera disponível
        try {
          cameraTrack = await AgoraRTC.createCameraVideoTrack();
          // @ts-ignore - Ignorar erro de tipo
          setLocalTracks([null, cameraTrack]);
          toast({
            title: "Apenas vídeo disponível",
            description: "Não detectamos um microfone no seu dispositivo.",
            variant: "default",
          });
        } catch (videoError) {
          console.error('Erro ao criar track de vídeo:', videoError);
          toast({
            title: "Erro de vídeo",
            description: "Não foi possível acessar sua câmera. Verifique as permissões.",
            variant: "destructive",
          });
          throw new Error('Falha ao acessar câmera');
        }
      } else {
        // Nenhum dispositivo disponível
        toast({
          title: "Sem dispositivos",
          description: "Não detectamos câmera ou microfone no seu dispositivo.",
          variant: "destructive",
        });
        throw new Error('Nenhum dispositivo de mídia encontrado');
      }

      // Publicar tracks locais
      console.log('Publicando tracks no canal...');
      try {
        const tracksToPublish = [];
        if (microphoneTrack) tracksToPublish.push(microphoneTrack);
        if (cameraTrack) tracksToPublish.push(cameraTrack);
        
        if (tracksToPublish.length > 0) {
          await rtcClient.publish(tracksToPublish);
          console.log(`${tracksToPublish.length} track(s) publicado(s) com sucesso!`);
        } else {
          console.warn('Nenhum track para publicar');
        }
      } catch (publishError: any) {
        console.error('Erro ao publicar tracks:', publishError);
        
        // Erros específicos
        if (publishError.message && publishError.message.includes("permission")) {
          toast({
            title: "Permissão negada",
            description: "O servidor recusou a publicação. Verifique suas permissões.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro de publicação",
            description: "Não foi possível publicar sua mídia no canal.",
            variant: "destructive",
          });
        }
      }

      // Exibir vídeo local
      if (cameraTrack && localVideoRef.current) {
        console.log('Reproduzindo vídeo local...');
        cameraTrack.play(localVideoRef.current);
        console.log('Vídeo local em reprodução');
      } else if (cameraTrack) {
        console.warn('Elemento de referência localVideoRef não encontrado');
      }

      setIsConnecting(false);
      
      toast({
        title: "Conectado à sala",
        description: "Você está conectado à sala de emergência.",
      });
      console.log('Conexão estabelecida com sucesso!');
      
      // Iniciar o timer para rastrear duração da consulta
      setConsultationStartTime(new Date());
      
    } catch (error) {
      console.error("Erro ao inicializar cliente Agora:", error);
      
      // Exibir detalhes mais específicos do erro
      if (error instanceof Error) {
        console.error("Detalhes do erro:", error.message);
        console.error("Stack:", error.stack);
        
        // Mensagem mais específica baseada no tipo de erro
        let errorMessage = "Ocorreu um erro ao conectar à sala de emergência. Tente novamente.";
        
        if (error.message.includes("permission") || error.message.includes("Permission") || 
            error.message.includes("permissão") || error.message.includes("access")) {
          errorMessage = "Não foi possível acessar sua câmera ou microfone. Verifique as permissões do navegador.";
        } else if (error.message.includes("network") || error.message.includes("Network") || 
                  error.message.includes("rede") || error.message.includes("connection")) {
          errorMessage = "Problema de conexão. Verifique sua internet e tente novamente.";
        } else if (error.message.includes("token") || error.message.includes("Token") || 
                  error.message.includes("credential")) {
          errorMessage = "Erro de autenticação. Tente reiniciar a consulta.";
        }
        
        toast({
          title: "Erro de conexão",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro de conexão",
          description: "Ocorreu um erro desconhecido. Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
      
      setIsConnecting(false);
      
      // Tentar limpeza em caso de erro
      if (client) {
        try {
          await client.leave();
        } catch (e) {
          console.error("Erro ao limpar recursos após falha:", e);
        }
      }
    }
  };

  // Gerenciar usuário remoto publicado
  const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
    try {
      // Inscrever-se no usuário
      await client?.subscribe(user, mediaType);
      
      // Definir o usuário remoto para referência
      setRemoteUser(user);

      // Se o tipo de mídia é 'video', reproduzir o vídeo do usuário remoto
      if (mediaType === "video" && remoteVideoRef.current) {
        user.videoTrack?.play(remoteVideoRef.current);
      }
      
      // Se o tipo de mídia é 'audio', reproduzir o áudio
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }

      // Forçar atualização de estado para re-renderizar
      setClient((prevClient) => prevClient);
    } catch (error) {
      console.error("Erro ao inscrever-se no usuário remoto:", error);
    }
  };

  // Gerenciar quando usuário remoto para de publicar
  const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
    if (mediaType === "video") {
      // O usuário remoto parou de compartilhar vídeo
      // Você pode adicionar lógica aqui para lidar com isso
    }
  };

  // Gerenciar quando usuário remoto sai
  const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
    if (remoteUser?.uid === user.uid) {
      setRemoteUser(null);
      toast({
        title: "Usuário desconectado",
        description: "O outro participante saiu da chamada.",
      });
    }
  };

  // Ativar/desativar microfone
  const toggleMicrophone = async () => {
    if (localTracks) {
      const [microphoneTrack] = localTracks;
      if (isMuted) {
        await microphoneTrack.setEnabled(true);
        setIsMuted(false);
      } else {
        await microphoneTrack.setEnabled(false);
        setIsMuted(true);
      }
    }
  };

  // Ativar/desativar câmera
  const toggleCamera = async () => {
    if (localTracks) {
      const [_, cameraTrack] = localTracks;
      if (isVideoOff) {
        await cameraTrack.setEnabled(true);
        setIsVideoOff(false);
      } else {
        await cameraTrack.setEnabled(false);
        setIsVideoOff(true);
      }
    }
  };

  // Sair do canal e limpar recursos
  const leaveChannel = async () => {
    try {
      // Desconectar e limpar tracks
      if (localTracks) {
        localTracks[0].close();
        localTracks[1].close();
      }
      
      // Deixar o canal
      await client?.leave();
      
      setIsCallEnded(true);
      setRemoteUser(null);
      
      // Limpar intervalo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } catch (error) {
      console.error("Erro ao sair do canal:", error);
    }
  };

  // Finalizar chamada
  const endCall = async () => {
    // Se for médico, finalizar consulta no backend
    if (doctorMode) {
      endConsultationMutation.mutate();
    } else {
      // Se for paciente, apenas sair da chamada
      await leaveChannel();
      navigate("/");
    }
  };

  // Formatar duração da consulta
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Se o token estiver sendo carregado ou a conexão estiver sendo estabelecida
  if (isLoadingToken || isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Spinner size="xl" />
        <p className="text-lg font-medium">Conectando à sala de emergência...</p>
      </div>
    );
  }

  // Se houve erro ao obter token
  if (tokenError) {
    return (
      <div className="container py-10 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-600">Erro de conexão</CardTitle>
            <CardDescription>
              Não foi possível conectar à sala de emergência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Ocorreu um erro ao conectar à sala de emergência. Verifique sua conexão e tente novamente.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate("/")} variant="default">
              Voltar para o início
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-6xl min-h-screen flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold">
                {doctorMode ? 'Atendimento de Emergência' : 'Consulta de Emergência'}
              </CardTitle>
              <CardDescription>
                {patientMode && 'Aguarde o médico atender sua chamada'}
                {doctorMode && patientInfo && `Atendendo: ${patientInfo.name}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1 rounded-full">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium">
                {consultationDuration > 0 
                  ? `Tempo: ${formatDuration(consultationDuration)}` 
                  : "Conectando..."}
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 flex-1">
            {/* Vídeo remoto (participante) */}
            <div className="lg:col-span-2 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden relative min-h-[400px]">
              {remoteUser ? (
                <div ref={remoteVideoRef} className="w-full h-full"></div>
              ) : (
                <div className="text-center p-6 text-white">
                  <div className="flex justify-center mb-4">
                    <Spinner variant="secondary" size="lg" />
                  </div>
                  <p className="font-medium">Aguardando outro participante...</p>
                </div>
              )}
            </div>
            
            {/* Vídeo local (você) */}
            <div className="bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden relative min-h-[200px]">
              <div ref={localVideoRef} className="w-full h-full"></div>
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
                  <p>Câmera desativada</p>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                Você
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center gap-4 py-6">
          <Button
            variant={isMuted ? "outline" : "secondary"}
            size="lg"
            className="rounded-full w-12 h-12 p-0"
            onClick={toggleMicrophone}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14 p-0"
            onClick={endCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          
          <Button
            variant={isVideoOff ? "outline" : "secondary"}
            size="lg"
            className="rounded-full w-12 h-12 p-0"
            onClick={toggleCamera}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TelemedicineEmergencyV4;