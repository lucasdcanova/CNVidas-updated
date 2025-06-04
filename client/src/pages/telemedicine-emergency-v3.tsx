import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';
// Importando componente de iframe direto para videochamada
import { DirectIframeVideoCall } from '@/components/telemedicine/DirectIframeVideoCall';
import { apiRequest } from '@/lib/queryClient';

/**
 * Nova implementação de consulta de emergência com abordagem simplificada
 * - Usa o SimpleVideoCall que tem melhor gerenciamento de DOM
 * - Tratamento robusto de erros
 * - Protocolos de segurança aprimorados
 */
export default function TelemedicineEmergencyV3() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados para controle da consulta
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<{
    roomUrl: string;
    token: string;
    appointmentId: number;
    roomName: string;
  } | null>(null);
  
  // Ref para rastrear quando a consulta foi iniciada
  const consultationStartedRef = useRef(false);
  
  // Detectar o tipo de usuário (médico ou paciente)
  const isDoctor = user?.role === 'doctor';
  
  // Extrair ID da consulta da URL, se disponível
  const getAppointmentIdFromUrl = (): number | null => {
    // Nova abordagem unificada para extrair appointmentId da URL
    const urlParams = new URLSearchParams(window.location.search);
    const appointmentId = urlParams.get('appointmentId');
    return appointmentId ? parseInt(appointmentId) : null;
  };
  
  // Iniciar consulta de emergência
  const startEmergencyConsultation = async () => {
    // Prevenir múltiplas chamadas
    if (consultationStartedRef.current) return;
    consultationStartedRef.current = true;
    
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        toast({
          title: 'Não autorizado',
          description: 'Você precisa estar logado para acessar esta funcionalidade.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      
      // Diferentes fluxos para médicos e pacientes
      if (isDoctor) {
        // FLUXO DO MÉDICO: Verifica se há consultas de emergência pendentes
        console.log('Médico acessando sala de emergência');
        
        // Usar a rota específica do médico para entrar na emergência
        // Esta rota usa o backend que corrigimos anteriormente para garantir
        // que o médico entre na mesma sala criada pelo paciente
        const joinResponse = await apiRequest('POST', '/api/emergency/join', {});
        
        if (!joinResponse.ok) {
          const errorData = await joinResponse.json();
          console.error('Erro ao entrar na sala de emergência:', errorData);
          throw new Error(errorData.message || 'Não há consultas de emergência disponíveis para atendimento');
        }
        
        const joinData = await joinResponse.json();
        console.log('Resposta da API de emergência para médico:', joinData);
        
        if (!joinData.success || !joinData.room || !joinData.token) {
          throw new Error('Dados de conexão inválidos ou consulta não encontrada');
        }
        
        // Criar objeto com informações da sala para o médico (usando format correto)
        const roomInfoData = {
          roomUrl: joinData.room.url,
          token: joinData.token,
          appointmentId: joinData.appointmentId || 0,
          roomName: joinData.room.name
        };
        
        // Salvar informações no sessionStorage para persistir a sala
        sessionStorage.setItem('emergency_room_info', JSON.stringify(roomInfoData));
        
        // Atualizar estado
        setRoomInfo(roomInfoData);
        
        toast({
          title: 'Atendimento iniciado',
          description: 'Você está entrando na sala de emergência para atender um paciente',
        });
      } else {
        // FLUXO DO PACIENTE: Inicia uma nova consulta de emergência
        console.log('Paciente iniciando consulta de emergência');
        
        // Buscar médicos disponíveis para garantir que existem antes de iniciar
        const doctorsResponse = await apiRequest('GET', '/api/doctors/available');
        const availableDoctors = await doctorsResponse.json();
        
        if (!availableDoctors || availableDoctors.length === 0) {
          throw new Error('Não há médicos disponíveis no momento. Tente novamente mais tarde.');
        }
        
        // Selecionar um médico disponível
        const doctor = availableDoctors[0];
        
        // Iniciar consulta (endpoint V3 direto)
        const response = await apiRequest('POST', '/api/emergency-consultation', {
          doctorId: doctor.id,
          userId: user.id
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Não foi possível iniciar a consulta de emergência.');
        }
        
        const data = await response.json();
        console.log('Consulta de emergência iniciada com sucesso:', data);
        
        if (!data.token || !data.roomName) {
          throw new Error('Dados da sala de consulta inválidos.');
        }
        
        // Criar objeto com informações da sala
        const roomInfoData = {
          roomUrl: data.url || `https://cnvidas.daily.co/${data.roomName}`,
          token: data.token,
          appointmentId: data.appointmentId,
          roomName: data.roomName
        };
        
        // Salvar informações no sessionStorage para persistir a sala
        sessionStorage.setItem('emergency_room_info', JSON.stringify(roomInfoData));
        
        // Atualizar estado
        setRoomInfo(roomInfoData);
        
        // Depuração de dados recebidos
        console.log("Dados recebidos da consulta:", JSON.stringify({
          url: data.url,
          token: data.token ? `${data.token.substring(0, 20)}...` : 'undefined',
          roomName: data.roomName
        }));
        
        toast({
          title: 'Consulta iniciada',
          description: 'Você está entrando na sala de videochamada de emergência',
        });
      }
    } catch (err) {
      console.error('Erro ao iniciar consulta:', err);
      setError(err instanceof Error ? err.message : 'Erro ao iniciar consulta de emergência');
      
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a consulta de emergência. Tente novamente.',
        variant: 'destructive',
      });
      
      // Resetar flag para permitir nova tentativa
      consultationStartedRef.current = false;
    } finally {
      setLoading(false);
    }
  };
  
  // Tentar novamente
  const handleRetry = () => {
    consultationStartedRef.current = false;
    startEmergencyConsultation();
  };
  
  // Tentar carregar sala a partir do sessionStorage quando iniciar
  useEffect(() => {
    // Verificar se temos dados da sala no sessionStorage
    const savedRoomInfo = sessionStorage.getItem('emergency_room_info');
    if (savedRoomInfo) {
      try {
        const parsedRoomInfo = JSON.parse(savedRoomInfo);
        console.log('Restaurando sala de emergência do sessionStorage:', parsedRoomInfo);
        setRoomInfo(parsedRoomInfo);
        setLoading(false);
      } catch (e) {
        console.error('Erro ao restaurar dados da sala:', e);
        // Se falhar, iniciar consulta normalmente
        startEmergencyConsultation();
      }
    } else {
      // Se não houver dados salvos, iniciar consulta normalmente
      startEmergencyConsultation();
    }
  }, []);
  
  // Voltar para a página de telemedicina após sair da consulta
  const handleLeaveCall = () => {
    // Limpar dados da sala no sessionStorage
    sessionStorage.removeItem('emergency_room_info');
    console.log('Saindo da sala de emergência - dados limpos');
    
    // Redirecionar para a página de telemedicina
    navigate('/telemedicine');
  };
  
  // Renderização para carregamento
  if (loading && !roomInfo) {
    return (
      <div className="container py-8 max-w-5xl mx-auto">
        <Helmet>
          <title>Consulta de Emergência | CN Vidas</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative w-20 h-20 mb-6">
            <Loader2 className="absolute inset-0 h-20 w-20 text-primary animate-spin" />
            <ShieldAlert className="absolute inset-0 h-10 w-10 text-primary m-auto" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Preparando consulta de emergência</h2>
          <p className="text-muted-foreground">Aguarde enquanto conectamos você a um médico...</p>
        </div>
      </div>
    );
  }
  
  // Renderização para erro
  if (error && !roomInfo) {
    return (
      <div className="container py-8 max-w-5xl mx-auto">
        <Helmet>
          <title>Erro na Consulta | CN Vidas</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="bg-destructive/20 rounded-full w-20 h-20 flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-destructive"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Erro ao iniciar consulta</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
            onClick={handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
  
  // Renderização da videochamada
  return (
    <div className="container py-8 max-w-5xl mx-auto">
      <Helmet>
        <title>Consulta de Emergência | CN Vidas</title>
      </Helmet>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          Consulta de Emergência
        </h1>
        <p className="text-muted-foreground">
          Você está em uma consulta de emergência com um de nossos médicos.
        </p>
      </div>
      
      {roomInfo && (
        <div className="bg-card rounded-xl shadow-lg overflow-hidden">
          <div className="aspect-video md:aspect-[16/9] lg:aspect-[16/9] w-full">
            <div className="p-1 bg-white">
              <iframe
                src={`https://cnvidas.daily.co/${roomInfo.roomName}?t=${roomInfo.token}&name=${encodeURIComponent(user?.fullName || (isDoctor ? 'Médico' : 'Paciente'))}&_=${Date.now()}`}
                allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
                style={{
                  border: 'none',
                  width: '100%', 
                  height: '500px'
                }}
                title="Videochamada médica de emergência"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}