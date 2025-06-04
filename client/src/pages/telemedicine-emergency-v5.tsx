import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AgoraRTC, { IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { useNavigate } from 'react-router-dom';
import type { AgoraRTCClient } from 'agora-rtc-sdk-ng';

interface AgoraRTCStream {
  play: (element: HTMLElement) => void;
  stop: () => void;
  close: () => void;
  audioTrack: IMicrophoneAudioTrack;
  videoTrack: ICameraVideoTrack;
  mute: () => void;
  unmute: () => void;
}

interface AgoraRTC {
  createClient: (config: { mode: string; codec: string }) => AgoraRTCClient;
  createMicrophoneAudioTrack: () => Promise<IMicrophoneAudioTrack>;
  createCameraVideoTrack: () => Promise<ICameraVideoTrack>;
}

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

export default function TelemedicineEmergencyV5() {
  // Extrair ID da consulta da URL
  const params = useParams<{ id: string }>();
  const appointmentId = parseInt(params.id);
  
  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localTracks, setLocalTracks] = useState<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<{ [key: string]: AgoraRTCStream }>({});
  const [client, setClient] = useState<AgoraRTCClient | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [joinError, setJoinError] = useState<Error | null>(null);
  const [audioError, setAudioError] = useState<Error | null>(null);
  
  // Refs
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hooks
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Inicializar SDK e obter token
  useEffect(() => {
    const loadAgoraSdk = () => {
      return new Promise<void>((resolve, reject) => {
        if (typeof window.AgoraRTC !== 'undefined') {
          console.log("Agora SDK já está carregado");
          resolve();
          return;
        }
        
        // Verificar se já existe um script sendo carregado
        const existingScript = document.querySelector('script[src*="AgoraRTC"]');
        if (existingScript) {
          console.log("Script Agora SDK já está sendo carregado, aguardando...");
          existingScript.addEventListener('load', () => {
            console.log("Agora SDK carregado com sucesso (script existente)");
            resolve();
          });
          existingScript.addEventListener('error', () => {
            console.error("Erro ao carregar Agora SDK existente");
            reject(new Error("Falha ao carregar a biblioteca de vídeo existente"));
          });
          return;
        }
        
        // Criar novo script com versão fixa do SDK para maior compatibilidade
        const script = document.createElement('script');
        script.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.17.0.js";
        script.async = true;
        script.id = "agora-rtc-sdk";
        
        // Adicionar um timeout para detectar problemas de carregamento
        const timeoutId = setTimeout(() => {
          console.error("Timeout ao carregar Agora SDK");
          reject(new Error("Tempo esgotado ao carregar a biblioteca de vídeo (30s)"));
        }, 30000);
        
        script.onload = () => {
          console.log("Agora SDK carregado com sucesso");
          clearTimeout(timeoutId);
          resolve();
        };
        
        script.onerror = () => {
          console.error("Erro ao carregar Agora SDK");
          clearTimeout(timeoutId);
          reject(new Error("Falha ao carregar a biblioteca de vídeo"));
        };
        
        document.head.appendChild(script);
      });
    };

    const initializeCall = async () => {
      try {
        setIsLoading(true);
        
        // 1. Carregar SDK
        await loadAgoraSdk();
        
        // 2. Verificar permissões de mídia
        try {
          console.log("Solicitando permissões de mídia");
          
          // Verificação específica para Safari e iOS
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          
          // Em navegadores Safari, solicitar permissões separadamente
          if (isSafari) {
            console.log("Navegador Safari detectado, solicitando permissões separadamente");
            // Primeiro solicita apenas áudio
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false
            });
            
            // Depois solicita apenas vídeo
            const videoStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true
            });
            
            // Liberar os streams
            audioStream.getTracks().forEach(track => track.stop());
            videoStream.getTracks().forEach(track => track.stop());
          } else {
            // Para outros navegadores, solicitar permissões juntas
            const mediaStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: true
            });
            
            // Liberar stream
            mediaStream.getTracks().forEach(track => track.stop());
          }
          
          console.log("Permissões concedidas");
        } catch (permError) {
          console.error("Erro de permissão:", permError);
          setErrorMessage("Para iniciar a videochamada, conceda permissões de câmera e microfone no seu navegador. Se estiver usando Safari, verifique as configurações de privacidade.");
          setIsLoading(false);
          return;
        }
        
        // 3. Obter token e verificar autenticação
        const getAuthToken = () => {
          // Prioridade 1: Token salvo por nossa aplicação
          const storedToken = localStorage.getItem('authToken');
          if (storedToken) return storedToken;
          
          // Prioridade 2: Token na URL (ambiente de produção)
          const urlParams = new URLSearchParams(window.location.search);
          const urlToken = urlParams.get('token');
          if (urlToken) {
            // Salvar para uso futuro
            localStorage.setItem('authToken', urlToken);
            return urlToken;
          }
          
          return null;
        };
        
        const authToken = getAuthToken();
        const sessionID = localStorage.getItem('sessionID') || 
                         document.cookie.split('; ').find(row => row.startsWith('cnvidas.sid='))?.split('=')[1];
        
        // Verificar se temos alguma forma de autenticação
        if (!authToken && !sessionID && !document.cookie.includes('cnvidas.sid')) {
          console.error("Nenhuma forma de autenticação encontrada");
          setErrorMessage("Você precisa estar autenticado para acessar esta página. Por favor, faça login novamente.");
          setIsLoading(false);
          return;
        }
        
        // Preparar headers com todas as formas de autenticação possíveis
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Adicionar todos os métodos de autenticação disponíveis
        if (authToken) {
          // Token no formato padrão da nossa aplicação
          headers['Authorization'] = `Bearer ${authToken}`;
          headers['X-Auth-Token'] = authToken;
          console.log("Enviando token de autenticação:", authToken);
          
          // Também salvar como cookie para maior compatibilidade
          document.cookie = `authToken=${authToken}; path=/; max-age=86400; SameSite=Lax`;
        }
        
        if (sessionID) {
          headers['X-Session-ID'] = sessionID;
          console.log("Usando X-Session-ID:", sessionID);
        }
        
        // Buscar primeiro informações do usuário para garantir que a autenticação está funcionando
        try {
          console.log("Verificando autenticação do usuário...");
          console.log("Cookies disponíveis ANTES da requisição:", document.cookie);
          
          const authCheckResponse = await fetch('/api/user', {
            method: 'GET',
            headers,
            credentials: 'include',
          });
          
          const headersObj: Record<string, string> = {};
          authCheckResponse.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          console.log("Headers da resposta de autenticação:", headersObj);
          console.log("Cookies disponíveis APÓS a requisição:", document.cookie);
          
          if (!authCheckResponse.ok) {
            const errorText = await authCheckResponse.text();
            console.error(`Erro na verificação de autenticação: ${authCheckResponse.status} ${errorText}`);
            setErrorMessage("Erro de autenticação. Por favor, faça login novamente.");
            setIsLoading(false);
            return;
          }
          
          const userData = await authCheckResponse.json();
          console.log("Usuário autenticado com sucesso:", userData);
          
          // Armazenar ID da sessão se estiver disponível
          const newSessionID = authCheckResponse.headers.get('Set-Cookie')?.match(/cnvidas\.sid=([^;]+)/)?.[1];
          if (newSessionID) {
            localStorage.setItem('sessionID', newSessionID);
            headers['X-Session-ID'] = newSessionID;
          }
        } catch (authError) {
          console.error("Erro ao verificar autenticação:", authError);
          setErrorMessage("Não foi possível verificar sua autenticação. Por favor, recarregue a página.");
          setIsLoading(false);
          return;
        }
        
        console.log("Iniciando solicitação de token");
        const response = await fetch('/api/agora/v4/token', {
          method: 'POST',
          headers,
          credentials: 'include', // Incluir cookies para autenticação de sessão
          body: JSON.stringify({ appointmentId }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erro na resposta HTTP: ${response.status} ${response.statusText}`);
          console.error(`Corpo da resposta: ${errorText}`);
          throw new Error(`Erro ao obter token: ${errorText}`);
        }
        
        const tokenData: AgoraTokenResponse = await response.json();
        console.log("Token obtido:", tokenData);
        
        if (!tokenData.success || !tokenData.token) {
          throw new Error("Falha ao obter token de acesso.");
        }
        
        // 4. Inicializar cliente
        const AgoraRTC = window.AgoraRTC;
        console.log("Versão do Agora SDK:", AgoraRTC.VERSION);
        
        const rtcClient = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp8'
        });
        setClient(rtcClient);
        
        // Adicionar logs de estados de conexão para diagnóstico
        rtcClient.on('connection-state-change', (currentState: string, prevState: string, reason?: any) => {
          console.log("Mudança de estado do Agora:", {
            anterior: prevState,
            atual: currentState,
            motivo: reason
          });
          
          // Toast informativo para usuário
          if (currentState === "CONNECTED") {
            toast({
              title: "Conexão estabelecida",
              description: "Você está conectado à sala de videochamada",
            });
          } else if (currentState === "DISCONNECTED") {
            toast({
              title: "Conexão perdida",
              description: reason ? `Motivo: ${reason.msg || 'Desconhecido'}` : "Tentando reconectar...",
              variant: "destructive"
            });
          }
        });
        
        // Log de exceções do SDK
        rtcClient.on('exception', (event: any) => {
          console.error("Exceção do Agora SDK:", event);
        });
        
        // 5. Registrar eventos de mídia
        rtcClient.on('user-published', async (user: any, mediaType: string) => {
          console.log(`Usuário ${user.uid} publicou ${mediaType}`);
          
          try {
            // Inscrever-se no stream do usuário
            await rtcClient.subscribe(user, mediaType);
            console.log(`Inscrito no ${mediaType} do usuário ${user.uid}`);
            
            // Reproduzir o stream conforme o tipo de mídia
            if (mediaType === 'video' && remoteVideoRef.current) {
              console.log("Reproduzindo vídeo remoto");
              user.videoTrack.play(remoteVideoRef.current);
            }
            
            if (mediaType === 'audio') {
              console.log("Reproduzindo áudio remoto");
              user.audioTrack.play();
            }
            
            // Atualizar lista de streams remotos
            setRemoteUsers((prev: { [key: string]: AgoraRTCStream }) => ({
              ...prev,
              [user.uid]: user
            }));
            
            // Iniciar cronômetro se ainda não estiver rodando
            if (!timerRef.current) {
              console.log("Iniciando cronômetro da chamada");
              timerRef.current = setInterval(() => {
                setDuration((prev: number) => prev + 1);
              }, 1000);
            }
          } catch (subscribeError) {
            console.error(`Erro ao se inscrever no ${mediaType} do usuário ${user.uid}:`, subscribeError);
          }
        });
        
        rtcClient.on('user-unpublished', (user: any) => {
          console.log(`Usuário ${user.uid} parou de publicar`);
          setRemoteUsers((prev: { [key: string]: AgoraRTCStream }) => ({
            ...prev,
            [user.uid]: undefined
          }));
        });
        
        // 6. Entrar no canal
        // Usar o mesmo UID que foi usado para gerar o token no servidor
        // Importante: usar o mesmo valor garante compatibilidade
        const clientUid = parseInt(tokenData.uid.toString());
        console.log("Tentando entrar no canal:", tokenData.channelName, "com UID:", clientUid, "AppID:", tokenData.appId.slice(0, 5) + "...");
        
        // Dados do token para debug
        console.log("Token info:", {
          token: tokenData.token.substring(0, 20) + "...",
          tamanho: tokenData.token.length,
          channelName: tokenData.channelName
        });
        
        try {
          // Configuração mais compatível com navegadores e ambientes restritos
          console.log("Configurando opções de conexão para maior compatibilidade");
          
          // Defina tempos de conexão e tentativas mais flexíveis
          rtcClient.setParameters({
            'rtc.websocket.compression': false, // Desativar compressão para maior compatibilidade
            'rtc.logFilter': 0x803, // Mais logs para diagnóstico
            'rtc.timeout': 60, // Aumentar timeout para ambientes com alta latência
            'rtc.useProxyServer': true // Usar proxy para maior compatibilidade com firewalls
          });
          
          // Redefina handlers para conexão em caso de erro
          rtcClient.on('stream-fallback', (uid: string | number, isFallbackOrRecovery: boolean) => {
            console.log(`Stream fallback para ${uid}: ${isFallbackOrRecovery}`);
          });
          
          console.log("Tentando conectar com opções de compatibilidade aumentada");
          
          // Usar abordagem baseada em promise com retry
          let retryCount = 0;
          const maxRetries = 3;
          
          async function attemptJoin() {
            try {
              await rtcClient.join(
                tokenData.appId, 
                tokenData.channelName,
                tokenData.token,
                clientUid
              );
              console.log("Conectado ao canal com sucesso!");
              return true;
            } catch (error) {
              console.error(`Tentativa ${retryCount + 1} falhou:`, error);
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Tentando novamente (${retryCount}/${maxRetries})...`);
                // Aguarde um pouco antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, 2000));
                return attemptJoin();
              }
              throw error;
            }
          }
          
          await attemptJoin();
        } catch (joinError: unknown) {
          console.error("Erro ao entrar no canal:", joinError);
          throw new Error(`Não foi possível entrar na sala de vídeo: ${joinError instanceof Error ? joinError.message : 'Erro desconhecido'}`);
        }
        
        // 7. Criar streams locais
        console.log("Iniciando criação de tracks de áudio e vídeo");
        let microphoneTrack;
        let cameraTrack;
        
        try {
          console.log("Criando track de áudio");
          microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack();
          console.log("Track de áudio criado com sucesso");
        } catch (audioError: unknown) {
          console.error("Erro ao criar track de áudio:", audioError);
          throw new Error(`Não foi possível acessar seu microfone: ${audioError instanceof Error ? audioError.message : 'Erro desconhecido'}`);
        }
        
        try {
          console.log("Criando track de vídeo");
          cameraTrack = await AgoraRTC.createCameraVideoTrack();
          console.log("Track de vídeo criado com sucesso");
        } catch (videoError) {
          console.error("Erro ao criar track de vídeo:", videoError);
          // Se falhar ao criar vídeo, tentar continuar apenas com áudio
          toast({
            title: "Atenção",
            description: "Não foi possível acessar sua câmera. A consulta continuará apenas com áudio.",
            variant: "default"
          });
        }
        
        // 8. Publicar streams
        console.log("Tentando publicar streams");
        
        // Verificar se temos tracks válidos para publicar
        const tracksToPublish = [];
        if (microphoneTrack) {
          console.log("Adicionando track de áudio para publicação");
          tracksToPublish.push(microphoneTrack);
        }
        
        if (cameraTrack) {
          console.log("Adicionando track de vídeo para publicação");
          tracksToPublish.push(cameraTrack);
        }
        
        if (tracksToPublish.length === 0) {
          console.error("Nenhum track disponível para publicar");
          throw new Error("Não foi possível acessar seu microfone ou câmera. Verifique as permissões do navegador.");
        }
        
        try {
          console.log(`Publicando ${tracksToPublish.length} tracks`);
          
          // Estratégia 1: Tentar publicar um por um em vez de array
          for (const track of tracksToPublish) {
            console.log(`Publicando track individual (${track.trackMediaType})`);
            await rtcClient.publish(track);
            console.log(`Track ${track.trackMediaType} publicado com sucesso`);
          }
          
          console.log("Todos os streams publicados com sucesso");
        } catch (publishError) {
          console.error("Erro ao publicar streams:", publishError);
          
          // Estratégia de fallback - publicar com atraso
          let publishedAny = false;
          
          if (microphoneTrack) {
            try {
              console.log("Tentando publicar apenas áudio com atraso");
              // Pequeno atraso para garantir que o canal esteja pronto
              await new Promise(resolve => setTimeout(resolve, 1000));
              await rtcClient.publish(microphoneTrack);
              console.log("Stream de áudio publicado com sucesso");
              publishedAny = true;
            } catch (audioError) {
              console.error("Erro ao publicar stream de áudio:", audioError);
            }
          }
          
          if (cameraTrack) {
            try {
              console.log("Tentando publicar apenas vídeo com atraso");
              // Pequeno atraso para garantir que o canal esteja pronto
              await new Promise(resolve => setTimeout(resolve, 1000));
              await rtcClient.publish(cameraTrack);
              console.log("Stream de vídeo publicado com sucesso");
              publishedAny = true;
            } catch (videoError) {
              console.error("Erro ao publicar stream de vídeo:", videoError);
            }
          }
          
          if (!publishedAny) {
            // Continuar mesmo sem streams - tente pelo menos manter a conexão
            toast({
              title: "Atenção",
              description: "Não foi possível transmitir seu áudio e vídeo. Tente atualizar a página.",
              variant: "destructive"
            });
          }
        }
        
        // 9. Exibir vídeo local
        if (localVideoRef.current && cameraTrack) {
          try {
            console.log("Tentando exibir vídeo local no elemento");
            cameraTrack.play(localVideoRef.current);
            console.log("Vídeo local exibido com sucesso");
          } catch (playError) {
            console.error("Erro ao exibir vídeo local:", playError);
            // Não falhar aqui, apenas registrar o erro
          }
        } else if (!cameraTrack) {
          console.warn("Nenhum track de câmera disponível para exibir");
        } else if (!localVideoRef.current) {
          console.error("Elemento DOM para vídeo local não está disponível");
        }
        
        // 10. Armazenar streams para controles
        setLocalTracks([microphoneTrack, cameraTrack]);
        
        toast({
          title: "Conexão estabelecida",
          description: "Você está conectado à sala de emergência",
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error("Erro ao inicializar chamada:", error);
        setErrorMessage(`Ocorreu um erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        setIsLoading(false);
      }
    };
    
    initializeCall();
    
    // Limpeza ao desmontar
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (client) {
        client.leave();
      }
      
      if (localTracks) {
        localTracks[0].close();
        localTracks[1].close();
      }
    };
  }, [appointmentId, toast]);
  
  // Funções de controle de mídia
  const toggleAudio = () => {
    if (localTracks) {
      const audioTrack = localTracks[0] as IMicrophoneAudioTrack;
      if (audioTrack.muted) {
        audioTrack.unmute();
        setIsAudioMuted(false);
      } else {
        audioTrack.mute();
        setIsAudioMuted(true);
      }
    }
  };
  
  const toggleVideo = () => {
    if (localTracks) {
      const videoTrack = localTracks[1] as ICameraVideoTrack;
      if (videoTrack.muted) {
        videoTrack.unmute();
        setIsVideoMuted(false);
      } else {
        videoTrack.mute();
        setIsVideoMuted(true);
      }
    }
  };
  
  const endCall = async () => {
    try {
      // Parar timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Fechar streams
      if (localTracks) {
        localTracks[0].close();
        localTracks[1].close();
      }
      
      // Deixar canal
      if (client) {
        await client.leave();
      }
      
      // Voltar para a página inicial
      navigate('/');
      
      toast({
        title: "Chamada encerrada",
        description: "Você saiu da sala de emergência",
      });
    } catch (error) {
      console.error("Erro ao encerrar chamada:", error);
    }
  };
  
  // Formatação da duração
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleJoinError = (error: unknown) => {
    console.error('Erro ao entrar na sala:', error);
    setJoinError(error instanceof Error ? error : new Error('Erro desconhecido ao entrar na sala'));
  };

  const handleAudioError = (error: unknown) => {
    console.error('Erro de áudio:', error);
    setAudioError(error instanceof Error ? error : new Error('Erro desconhecido com áudio'));
  };

  const handleStreamUpdate = (stream: AgoraRTCStream) => {
    const audioTrack = stream.audioTrack;
    const videoTrack = stream.videoTrack;
    
    if (audioTrack && videoTrack) {
      setLocalTracks([audioTrack, videoTrack]);
    }
  };

  return (
    <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-4xl">
        <CardHeader className="relative">
          <CardTitle>Consulta de Emergência</CardTitle>
          <div className="absolute right-6 top-6">
            <span className="font-mono">Duração: {formatDuration(duration)}</span>
          </div>
          <CardDescription>
            {isLoading ? "Estabelecendo conexão com a sala..." : "Conectado"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{errorMessage && errorMessage.includes("The string did not match") ? "Houve um erro ao iniciar a chamada. Por favor, tente novamente." : errorMessage}</AlertDescription>
            </Alert>
          )}
          
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <Spinner size="lg" />
              <span className="ml-3">Preparando videochamada...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Vídeo remoto - ocupando 2/3 da largura em telas maiores */}
              <div className="md:col-span-2 bg-gray-100 rounded-lg overflow-hidden h-[300px] md:h-[400px] flex items-center justify-center relative">
                {Object.keys(remoteUsers).length > 0 ? (
                  <div ref={remoteVideoRef} className="w-full h-full bg-black"></div>
                ) : (
                  <div className="text-center p-4">
                    <p>Aguardando o profissional entrar na sala...</p>
                  </div>
                )}
              </div>
              
              {/* Vídeo local - ocupando 1/3 da largura em telas maiores */}
              <div className="bg-gray-100 rounded-lg overflow-hidden h-[200px] md:h-[400px] relative">
                <div ref={localVideoRef} className="w-full h-full bg-black"></div>
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs">
                  Você
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center gap-4">
          <Button
            variant={isAudioMuted ? "outline" : "secondary"}
            size="icon"
            onClick={toggleAudio}
            disabled={isLoading || !localTracks}
          >
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isVideoMuted ? "outline" : "secondary"}
            size="icon"
            onClick={toggleVideo}
            disabled={isLoading || !localTracks}
          >
            {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="destructive"
            size="icon"
            onClick={endCall}
            disabled={isLoading}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}