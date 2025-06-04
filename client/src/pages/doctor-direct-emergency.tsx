import React, { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { SimpleVideoCall } from '@/components/telemedicine/SimpleVideoCall';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Página direta para médicos acessarem emergência
 * Sem componentes problemáticos como EmergencyBanner
 */
export default function DoctorDirectEmergency() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  
  // Verificar se o usuário é médico
  useEffect(() => {
    if (user && user.role !== 'doctor') {
      toast({
        variant: "destructive",
        title: "Acesso não autorizado",
        description: "Esta página é apenas para médicos."
      });
      navigate('/');
    }
  }, [user, navigate, toast]);
  
  // Buscar ou criar sala de emergência
  useEffect(() => {
    const fetchOrCreateRoom = async () => {
      try {
        setIsLoading(true);
        
        const params = new URLSearchParams(search);
        const appointmentId = params.get('appointmentId');
        
        let endpoint = appointmentId 
          ? `/api/appointments/${appointmentId}/join` 
          : '/api/emergency/join';
        
        // Adicionar token de autenticação alternativo para garantir que a sessão seja mantida
        const userData = localStorage.getItem('userData');
        let sessionToken = '';
        
        if (userData) {
          try {
            const userObj = JSON.parse(userData);
            if (userObj && userObj.id) {
              sessionToken = `emergency-session:${userObj.id}:${Date.now()}`;
              console.log("Usando token alternativo para autenticação de emergência");
            }
          } catch (e) {
            console.error("Erro ao processar dados do usuário:", e);
          }
        }
        
        // Fazer a requisição com autenticação alternativa
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'X-Session-ID': sessionToken } : {})
          },
          credentials: 'include' // Incluir cookies de sessão
        });
        
        if (!response.ok) {
          throw new Error('Falha ao entrar na sala de emergência');
        }
        
        const data = await response.json();
        console.log('Sala de emergência criada/recuperada:', data);
        
        // Salvando informações da sala no estado
        setRoomInfo({
          roomUrl: data.room.url,
          roomName: data.room.name,
          token: data.token,
          appointmentId: data.appointmentId
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao criar/entrar na sala:', error);
        setError('Não foi possível criar ou entrar na sala de emergência');
        setIsLoading(false);
        
        toast({
          variant: "destructive",
          title: "Erro na sala de emergência",
          description: "Não foi possível criar ou entrar na sala. Tente novamente."
        });
      }
    };
    
    if (user) {
      fetchOrCreateRoom();
    }
  }, [user, search, toast]);
  
  // Função para lidar com o fim da chamada
  const handleLeaveCall = () => {
    navigate('/');
  };
  
  // Renderização condicional com base no estado
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-lg">Verificando autenticação...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Erro na sala de emergência</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-lg">Preparando sala de emergência...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">Consulta de Emergência</h1>
          <p className="text-muted-foreground">
            {roomInfo?.appointmentId 
              ? `Atendimento de emergência #${roomInfo.appointmentId}`
              : 'Atendimento de emergência'}
          </p>
        </div>
      </div>
      
      {roomInfo && (
        <div className="bg-card rounded-xl shadow-lg overflow-hidden">
          <div className="aspect-video md:aspect-[16/9] lg:aspect-[16/9] w-full">
            <SimpleVideoCall
              url={roomInfo.roomUrl || `https://cnvidas.daily.co/${roomInfo.roomName}`} 
              token={roomInfo.token}
              userName={user?.fullName || 'Médico'}
              onLeave={handleLeaveCall}
            />
          </div>
        </div>
      )}
    </div>
  );
}