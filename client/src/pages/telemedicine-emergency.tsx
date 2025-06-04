import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Video, CheckCircle2 } from 'lucide-react';
import RobustDailyVideoCall from '@/components/telemedicine/RobustDailyVideoCall';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Helmet } from 'react-helmet';
import type { Doctor } from '@/shared/types';

interface EmergencyConsultationResponse {
  success: boolean;
  appointmentId: number;
  roomName: string;
}

export function TelemedicineEmergencyPage() {
  // Estados
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [appointmentCreated, setAppointmentCreated] = useState<boolean>(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Obter os médicos disponíveis para emergência
  useEffect(() => {
    const fetchAvailableDoctors = async (): Promise<void> => {
      try {
        const response = await apiRequest('GET', '/api/doctors/available');
        if (!response.ok) {
          throw new Error('Falha ao buscar médicos disponíveis');
        }
        
        const doctors: Doctor[] = await response.json();
        setAvailableDoctors(doctors);
        
        // Selecionar automaticamente o primeiro médico disponível
        if (doctors.length > 0) {
          setSelectedDoctor(doctors[0]);
          setDoctorId(doctors[0].id);
        } else {
          setError('Não há médicos disponíveis para consulta de emergência no momento');
        }
      } catch (err) {
        console.error('Erro ao buscar médicos:', err);
        setError('Erro ao buscar médicos disponíveis');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableDoctors();
  }, []);
  
  // Iniciar consulta de emergência
  const startEmergencyConsultation = async (): Promise<void> => {
    if (!selectedDoctor) {
      toast({
        title: 'Erro',
        description: 'Selecione um médico para iniciar a consulta',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Chamar a API robusta V2 para criação de consulta de emergência
      const response = await apiRequest('POST', '/api/emergency-consultation', {
        doctorId: selectedDoctor.id,
        userId: user?.id
      });
      
      if (!response.ok) {
        throw new Error('Falha ao iniciar consulta de emergência');
      }
      
      const data: EmergencyConsultationResponse & { success: boolean } = await response.json();
      console.log('Consulta de emergência criada:', data);
      
      // Redirecionar para a nova implementação de consulta
      if (data.success && data.appointmentId) {
        toast({
          title: 'Consulta iniciada',
          description: 'Redirecionando para a sala de consulta...',
        });
        
        // Redirecionar para o novo componente de consulta
        setLocation(`/consultation/${data.appointmentId}`);
        return;
      }
      
      // Fallback para o fluxo anterior (caso não consiga redirecionar)
      setAppointmentId(data.appointmentId);
      setRoomName(data.roomName);
      setAppointmentCreated(true);
      
      toast({
        title: 'Consulta iniciada',
        description: 'Você está entrando na sala de videochamada',
      });
    } catch (err) {
      console.error('Erro ao iniciar consulta:', err);
      setError('Erro ao iniciar consulta de emergência');
      
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a consulta de emergência',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Voltar para a página de telemedicina após sair da consulta
  const handleLeaveCall = (): void => {
    setLocation('/telemedicine');
  };
  
  // Renderização para carregamento
  if (loading && !appointmentCreated) {
    return (
      <div className="container py-8">
        <Helmet>
          <title>Consulta de Emergência | CN Vidas</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h2 className="text-2xl font-bold mb-2">Preparando consulta de emergência</h2>
          <p className="text-muted-foreground">Aguarde enquanto configuramos sua consulta...</p>
        </div>
      </div>
    );
  }
  
  // Renderização para erro
  if (error && !appointmentCreated) {
    return (
      <div className="container py-8">
        <Helmet>
          <title>Erro | CN Vidas</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="bg-destructive/10 p-3 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Erro ao iniciar consulta</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }
  
  // Renderização para seleção de médico
  if (!appointmentCreated) {
    return (
      <div className="container py-8">
        <Helmet>
          <title>Consulta de Emergência | CN Vidas</title>
        </Helmet>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Consulta de Emergência</h1>
          
          <div className="bg-destructive/10 p-4 rounded-lg mb-8">
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 text-destructive mr-3 mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">Atenção</h3>
                <p className="text-sm">
                  Consultas de emergência são para situações que necessitam de atendimento médico imediato.
                  Você será cobrado conforme seu plano de assinatura.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow-sm border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Médicos disponíveis para emergência</h2>
            
            {availableDoctors.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                Não há médicos disponíveis para emergência no momento
              </p>
            ) : (
              <div className="space-y-4">
                {availableDoctors.map((doctor) => (
                  <div 
                    key={doctor.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedDoctor?.id === doctor.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedDoctor(doctor);
                      setDoctorId(doctor.id);
                    }}
                  >
                    <div className="flex items-center">
                      <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mr-4">
                        {doctor.profileImage ? (
                          <img 
                            src={doctor.profileImage || ''} 
                            alt={'Médico'} 
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-primary">
                            {'MD'}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {doctor.fullName || 'Médico'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {doctor.specialization || 'Clínica Geral'}
                        </p>
                      </div>
                      {selectedDoctor?.id === doctor.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={startEmergencyConsultation}
                disabled={!selectedDoctor || loading}
                className="w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    Iniciar Consulta de Emergência
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderização da consulta em andamento
  return (
    <div className="container py-4">
      <Helmet>
        <title>Consulta em Andamento | CN Vidas</title>
      </Helmet>
      
      <div className="flex flex-col">
        <div className="bg-white shadow-sm border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Consulta de Emergência em Andamento</h1>
            <div className="flex items-center">
              <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                Ao vivo
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow-sm border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
          <RobustDailyVideoCall 
            appointmentId={appointmentId || undefined}
            roomName={roomName || undefined}
            userName={user?.fullName || user?.username || 'Paciente'}
            onLeave={handleLeaveCall}
          />
        </div>
      </div>
    </div>
  );
}

export default TelemedicineEmergencyPage;