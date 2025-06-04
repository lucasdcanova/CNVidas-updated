import React, { useState, useEffect, useRef } from "react";
import { useLocation, useRoute, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

declare global {
  interface Window {
    AgoraRTC: any;
  }
}

// Interfaces para tipagem
interface PatientInfo {
  id: number;
  name: string;
  profileImage: string | null;
}

interface AgoraTokenResponse {
  success: boolean;
  appointmentId: number;
  token: string;
  channelName: string;
  uid: number;
  appId: string;
  patientInfo?: PatientInfo;
  role: 'patient' | 'doctor' | 'admin' | 'partner';
}

interface LocalTracks {
  audioTrack: any | null;
  videoTrack: any | null;
}

// Componente principal
export default function TelemedicineEmergencyV4New() {
  // Obter o ID da consulta da URL
  const params = useParams();
  const appointmentId = params.id;
  
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  // Referências para elementos DOM
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  
  // Estados para gerenciar a chamada
  const [isLoading, setIsLoading] = useState(true);
  const [agoraClient, setAgoraClient] = useState<any>(null);
  const [localTracks, setLocalTracks] = useState<LocalTracks>({ audioTrack: null, videoTrack: null });
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState("DISCONNECTED");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [consultationDuration, setConsultationDuration] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<AgoraTokenResponse | null>(null);
  
  // Temporizador para duração da consulta
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Obter token do Agora e inicializar
  useEffect(() => {
    async function initializeCall() {
      try {
        setIsLoading(true);
        
        // Verificar se o SDK do Agora está disponível
        if (typeof window.AgoraRTC === 'undefined') {
          console.error("AgoraRTC não encontrado na janela global");
          // Tentar carregar dinamicamente
          try {
            const script = document.createElement('script');
            script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.18.2.js';
            script.async = true;
            script.onload = () => {
              console.log("SDK do Agora carregado com sucesso");
              // Reiniciar o processo após carregamento
              initializeCall();
            };
            script.onerror = () => {
              console.error("Falha ao carregar o SDK do Agora");
              setErrorMessage("Não foi possível carregar a biblioteca de vídeo. Atualize a página.");
              setIsLoading(false);
            };
            document.head.appendChild(script);
          } catch (loadError) {
            console.error("Erro ao tentar carregar dinamicamente:", loadError);
            setErrorMessage("Biblioteca de vídeo não carregada. Atualize a página.");
            setIsLoading(false);
          }
          return;
        }
        
        // Obter token para a sala
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
          setErrorMessage("Você precisa estar autenticado para acessar esta página.");
          setIsLoading(false);
          return;
        }
        
        // Fazer requisição para obter token Agora
        const response = await fetch('/api/agora/v4/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-Auth-Token': authToken || ''
          },
          body: JSON.stringify({ appointmentId }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro ao obter token:', response.status, errorText);
          setErrorMessage(`Erro de autenticação: ${response.status} - Falha ao obter token`);
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        console.log('Token obtido com sucesso:', data);
        setTokenData(data);
        
        // Inicializar chamada com o token recebido
        await joinChannel(data);
        
      } catch (error) {
        console.error('Erro ao inicializar chamada:', error);
        setErrorMessage('Ocorreu um erro ao inicializar a videochamada. Tente novamente.');
        setIsLoading(false);
      }
    }
    
    initializeCall();
    
    // Limpar recursos ao desmontar o componente
    return () => {
      leaveChannel();
    };
  }, [appointmentId]);
  
  // Iniciar timer quando conectado
  useEffect(() => {
    if (connectionState === "CONNECTED" && !startTime) {
      setStartTime(new Date());
      
      // Iniciar timer para duração da consulta
      timerRef.current = setInterval(() => {
        setConsultationDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [connectionState, startTime]);
  
  // Função para entrar no canal Agora
  const joinChannel = async (tokenData: AgoraTokenResponse) => {
    try {
      // Verificar novamente se o SDK está disponível
      if (typeof window.AgoraRTC === 'undefined') {
        console.error("AgoraRTC ainda não está disponível após tentativa de carregamento");
        setErrorMessage("Não foi possível inicializar a biblioteca de vídeo. Por favor, tente novamente mais tarde.");
        setIsLoading(false);
        return;
      }
      
      const AgoraRTC = window.AgoraRTC;
      
      // Verificar se temos todos os dados necessários
      if (!tokenData.appId || !tokenData.channelName || !tokenData.token) {
        setErrorMessage('Dados de conexão incompletos. Tente novamente.');
        setIsLoading(false);
        return;
      }
      
      console.log('Criando cliente Agora...');
      
      // Criar cliente Agora
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setAgoraClient(client);
      
      // Configurar handlers de eventos
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', handleUserUnpublished);
      client.on('user-left', handleUserLeft);
      
      // Monitor de estado da conexão
      client.on('connection-state-change', (newState: string) => {
        console.log(`Estado da conexão alterado para: ${newState}`);
        setConnectionState(newState);
        
        if (newState === 'CONNECTED') {
          toast({
            title: 'Conexão estabelecida',
            description: 'Você está conectado à sala de emergência',
          });
        } else if (newState === 'DISCONNECTED') {
          toast({
            title: 'Desconectado',
            description: 'Você foi desconectado da sala de emergência',
            variant: 'destructive',
          });
        }
      });
      
      // Solicitar permissões de mídia ANTES de entrar no canal
      try {
        console.log('Solicitando permissões de mídia...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        // Liberar a stream após obter permissões
        stream.getTracks().forEach(track => track.stop());
        console.log('Permissões de mídia concedidas com sucesso');
      } catch (permError) {
        console.error('Erro ao obter permissões de mídia:', permError);
        setErrorMessage('Para iniciar a videochamada, por favor conceda permissões de câmera e microfone no seu navegador.');
        setIsLoading(false);
        return;
      }
      
      // Entrar no canal
      console.log('Entrando no canal:', tokenData.channelName);
      try {
        await client.join(
          tokenData.appId,
          tokenData.channelName,
          tokenData.token,
          tokenData.uid
        );
        console.log('Conectado ao canal com sucesso!');
      } catch (joinError) {
        console.error('Erro ao entrar no canal:', joinError);
        setErrorMessage('Não foi possível conectar à sala. Verifique sua conexão com a internet.');
        setIsLoading(false);
        return;
      }
      
      console.log('Entrada no canal bem-sucedida!');
      
      // Verificar dispositivos disponíveis
      const devices = await AgoraRTC.getDevices();
      const hasAudio = devices.some((device: any) => device.kind === 'audioinput');
      const hasVideo = devices.some((device: any) => device.kind === 'videoinput');
      
      console.log('Dispositivos disponíveis:', { audio: hasAudio, video: hasVideo });
      
      let audioTrack = null;
      let videoTrack = null;
      
      // Criar trilhas de áudio e vídeo separadamente para melhor tratamento de erros
      if (hasAudio) {
        try {
          console.log('Criando trilha de áudio...');
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          console.log('Trilha de áudio criada com sucesso');
        } catch (audioError) {
          console.error('Erro ao criar trilha de áudio:', audioError);
          toast({
            title: 'Problema com microfone',
            description: 'Não foi possível acessar seu microfone. Verifique as permissões.',
            variant: 'destructive',
          });
        }
      }
      
      if (hasVideo) {
        try {
          console.log('Criando trilha de vídeo...');
          videoTrack = await AgoraRTC.createCameraVideoTrack();
          console.log('Trilha de vídeo criada com sucesso');
          
          // Exibir vídeo local
          if (videoTrack && localVideoRef.current) {
            videoTrack.play(localVideoRef.current);
          }
        } catch (videoError) {
          console.error('Erro ao criar trilha de vídeo:', videoError);
          toast({
            title: 'Problema com câmera',
            description: 'Não foi possível acessar sua câmera. Verifique as permissões.',
            variant: 'default',
          });
        }
      }
      
      // Salvar trilhas locais
      setLocalTracks({ audioTrack, videoTrack });
      
      // Publicar trilhas disponíveis
      const tracksToPublish = [];
      if (audioTrack) tracksToPublish.push(audioTrack);
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        console.log('Trilhas publicadas com sucesso!');
      } else {
        console.warn('Nenhuma trilha disponível para publicar');
        setErrorMessage('Não foi possível acessar sua câmera ou microfone. Verifique as permissões do seu navegador.');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao entrar no canal:', error);
      setErrorMessage(`Erro ao conectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setIsLoading(false);
    }
  };
  
  // Handler para quando um usuário remoto publica mídia
  const handleUserPublished = async (user: any, mediaType: string) => {
    console.log(`Usuário ${user.uid} publicou ${mediaType}`);
    
    // Inscrever-se no usuário remoto
    await agoraClient.subscribe(user, mediaType);
    
    // Atualizar lista de usuários remotos
    setRemoteUsers(prev => {
      // Se o usuário já existe, apenas atualizar
      if (prev.find(u => u.uid === user.uid)) {
        return prev.map(u => u.uid === user.uid ? user : u);
      }
      // Caso contrário, adicionar à lista
      return [...prev, user];
    });
    
    // Reproduzir mídia remota
    if (mediaType === 'video' && remoteVideoRef.current) {
      user.videoTrack?.play(remoteVideoRef.current);
    }
    if (mediaType === 'audio') {
      user.audioTrack?.play();
    }
    
    // Iniciar timer se ainda não iniciado
    if (!startTime && connectionState === 'CONNECTED') {
      setStartTime(new Date());
      timerRef.current = setInterval(() => {
        setConsultationDuration(prev => prev + 1);
      }, 1000);
    }
    
    // Notificar usuário
    toast({
      title: 'Usuário conectado',
      description: 'Um profissional de saúde entrou na sala',
    });
  };
  
  // Handler para quando um usuário para de publicar mídia
  const handleUserUnpublished = (user: any, mediaType: string) => {
    console.log(`Usuário ${user.uid} despublicou ${mediaType}`);
    
    // Atualizar lista de usuários remotos
    setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? user : u));
  };
  
  // Handler para quando um usuário sai
  const handleUserLeft = (user: any) => {
    console.log(`Usuário ${user.uid} saiu da sala`);
    
    // Remover usuário da lista
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    
    // Notificar usuário
    toast({
      title: 'Usuário desconectado',
      description: 'O outro participante saiu da sala',
      variant: 'destructive',
    });
  };
  
  // Sair do canal e limpar recursos
  const leaveChannel = async () => {
    try {
      // Parar timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Fechar trilhas locais
      if (localTracks.audioTrack) {
        localTracks.audioTrack.close();
      }
      if (localTracks.videoTrack) {
        localTracks.videoTrack.close();
      }
      
      // Sair do canal Agora
      if (agoraClient) {
        await agoraClient.leave();
      }
      
      // Finalizar a consulta no servidor
      if (tokenData?.appointmentId) {
        try {
          const authToken = localStorage.getItem('authToken');
          await fetch(`/api/agora/end-consultation/${tokenData.appointmentId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'X-Auth-Token': authToken || ''
            },
            body: JSON.stringify({ duration: consultationDuration }),
          });
          
          console.log('Consulta finalizada com sucesso');
        } catch (endError) {
          console.error('Erro ao finalizar consulta:', endError);
        }
      }
      
      toast({
        title: 'Chamada encerrada',
        description: 'Você saiu da sala de emergência',
      });
      
      // Voltar para a página inicial
      navigate('/');
    } catch (error) {
      console.error('Erro ao sair do canal:', error);
      
      // Mesmo com erro, retornar à página inicial
      navigate('/');
    }
  };
  
  // Alternar áudio
  const toggleAudio = async () => {
    if (!localTracks.audioTrack) return;
    
    try {
      if (isMuted) {
        await localTracks.audioTrack.setEnabled(true);
        setIsMuted(false);
        toast({
          title: 'Microfone ativado',
          description: 'Os outros participantes podem ouvir você agora',
        });
      } else {
        await localTracks.audioTrack.setEnabled(false);
        setIsMuted(true);
        toast({
          title: 'Microfone desativado',
          description: 'Os outros participantes não podem ouvir você',
        });
      }
    } catch (error) {
      console.error('Erro ao alternar áudio:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alternar o estado do microfone',
        variant: 'destructive',
      });
    }
  };
  
  // Alternar vídeo
  const toggleVideo = async () => {
    if (!localTracks.videoTrack) return;
    
    try {
      if (isVideoOff) {
        await localTracks.videoTrack.setEnabled(true);
        setIsVideoOff(false);
        toast({
          title: 'Câmera ativada',
          description: 'Os outros participantes podem ver você agora',
        });
      } else {
        await localTracks.videoTrack.setEnabled(false);
        setIsVideoOff(true);
        toast({
          title: 'Câmera desativada',
          description: 'Os outros participantes não podem ver você',
        });
      }
    } catch (error) {
      console.error('Erro ao alternar vídeo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alternar o estado da câmera',
        variant: 'destructive',
      });
    }
  };
  
  // Formatar tempo de duração
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Renderização do componente
  return (
    <div className="flex flex-col items-center justify-center w-full p-4 h-full min-h-[80vh]">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Consulta de Emergência</span>
            {!isLoading && (
              <span className="text-sm font-normal bg-slate-100 px-2 py-1 rounded-md">
                Duração: {formatDuration(consultationDuration)}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {connectionState === 'CONNECTED' ? 
              "Você está conectado à sala de emergência" : 
              "Estabelecendo conexão com a sala..."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 flex flex-col items-center space-y-4">
          {/* Mostrar erro se houver */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          
          {/* Tela de carregamento */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 w-full">
              <Spinner size="lg" />
              <p className="mt-4 text-muted-foreground">Conectando à sala de emergência...</p>
            </div>
          )}
          
          {/* Conteúdo principal da videochamada */}
          {!isLoading && !errorMessage && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
              {/* Stream remoto (ocupa mais espaço) */}
              <div className={`relative ${remoteUsers.length > 0 ? 'col-span-2' : 'col-span-1'} bg-slate-100 rounded-lg overflow-hidden`} style={{ height: '400px' }}>
                {remoteUsers.length > 0 ? (
                  <div ref={remoteVideoRef} className="h-full w-full bg-slate-800"></div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-semibold mb-2">
                      ?
                    </div>
                    <p className="text-muted-foreground">Aguardando o médico entrar na sala...</p>
                  </div>
                )}
              </div>
              
              {/* Stream local (menor, no canto) */}
              <div className={`relative ${remoteUsers.length > 0 ? 'absolute bottom-4 right-4 w-1/4 h-1/4 z-10' : 'col-span-1 h-[300px]'} bg-slate-800 rounded-lg overflow-hidden`}>
                {localTracks.videoTrack ? (
                  <div ref={localVideoRef} className="h-full w-full"></div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-lg font-semibold">
                      {tokenData?.role?.charAt(0).toUpperCase() || "P"}
                    </div>
                    <p className="text-sm text-white mt-2">Câmera desativada</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center space-x-4 p-6 bg-slate-50">
          {/* Controles de áudio e vídeo */}
          <Button
            variant={isMuted ? "outline" : "default"}
            size="icon"
            onClick={toggleAudio}
            disabled={isLoading || !localTracks.audioTrack}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "outline" : "default"}
            size="icon"
            onClick={toggleVideo}
            disabled={isLoading || !localTracks.videoTrack}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          {/* Botão para encerrar chamada */}
          <Button
            variant="destructive"
            size="icon"
            onClick={leaveChannel}
            disabled={isLoading}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}