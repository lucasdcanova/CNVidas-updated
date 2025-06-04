import { useState, useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Loader2, ShieldAlert, Clock, User, Video, 
  Phone, Mic, MicOff, VideoOff
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/layouts/dashboard-layout';

interface Doctor {
  id: number;
  userId: number;
  specialization: string;
  licenseNumber: string;
  biography?: string;
  education?: string;
  experienceYears?: number;
  availableForEmergency: boolean;
  consultationFee?: number;
  profileImage?: string;
  status?: string;
  name?: string;
  username?: string;
  email?: string;
}

export default function DoctorEmergencyRoom() {
  const [match, params] = useRoute('/emergency/doctor/:doctorId');
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [callStarted, setCallStarted] = useState(false);
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doctorId = params?.doctorId;

  // Buscar informações do médico
  const { data: doctor, isLoading: isLoadingDoctor } = useQuery({
    queryKey: ['/api/doctors', doctorId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/doctors/${doctorId}`);
      return response.json();
    },
    enabled: !!doctorId,
  });

  // Criar ou entrar na sala de emergência
  const createEmergencyRoom = async () => {
    if (!doctorId || !user) return;

    setIsConnecting(true);
    try {
      const response = await apiRequest('POST', '/api/emergency/join-doctor-room', {
        doctorId: parseInt(doctorId),
        patientId: user.id,
      });

      if (response.ok) {
        const data = await response.json();
        setRoomUrl(data.roomUrl);
        setCallStarted(true);
        
        toast({
          title: "Conectado!",
          description: "Entrando na sala de emergência do médico.",
        });
      } else {
        throw new Error('Falha ao criar sala de emergência');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível conectar à sala de emergência.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndCall = () => {
    setCallStarted(false);
    setRoomUrl('');
    toast({
      title: "Chamada Encerrada",
      description: "A consulta de emergência foi finalizada.",
    });
  };

  if (!match) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergência Médica</h1>
            <p className="text-gray-600">Consulta de emergência com especialista</p>
          </div>
        </div>

        {/* Status da consulta */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-red-700">
                  Consulta de Emergência Ativa
                </span>
              </div>
              <Badge variant="destructive" className="bg-red-500">
                <Clock className="w-3 h-3 mr-1" />
                Urgente
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Informações do médico */}
        {isLoadingDoctor ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ) : doctor ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <User className="w-5 h-5" />
                <span>Médico Responsável</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{doctor.name || 'Dr. ' + doctor.username}</h3>
                  <p className="text-gray-600">{doctor.specialization}</p>
                  <p className="text-sm text-gray-500">CRM: {doctor.licenseNumber}</p>
                  {doctor.experienceYears && (
                    <p className="text-sm text-gray-500">{doctor.experienceYears} anos de experiência</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Área da videochamada */}
        <Card className="min-h-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <Video className="w-5 h-5" />
              <span>Sala de Emergência</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!callStarted ? (
              <div className="text-center py-16 space-y-6">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-10 h-10 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Pronto para Conectar</h3>
                  <p className="text-gray-600 mb-6">
                    Clique no botão abaixo para iniciar a consulta de emergência
                  </p>
                </div>
                <Button
                  onClick={createEmergencyRoom}
                  disabled={isConnecting}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 mr-2" />
                      Iniciar Emergência
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Interface Daily.co com CSS personalizado para esconder controles */}
                {roomUrl && (
                  <div className="relative bg-black rounded-lg overflow-hidden min-h-[500px]">
                    <iframe
                      src={roomUrl}
                      className="w-full h-[500px] border-0"
                      allow="camera; microphone; fullscreen; speaker; display-capture"
                      title="Sala de Emergência"
                    />
                    
                    {/* CSS personalizado para esconder elementos */}
                    <style jsx>{`
                      iframe {
                        pointer-events: auto;
                      }
                      
                      /* Esconder elementos do Daily.co via CSS */
                      iframe::after {
                        content: '';
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 80px;
                        background: transparent;
                        z-index: 10;
                      }
                    `}</style>
                    
                    {/* Overlay para esconder controles na parte inferior */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
                  </div>
                )}

                {/* Botão para encerrar chamada */}
                {callStarted && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleEndCall}
                      variant="destructive"
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Encerrar Consulta</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações importantes */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-800">Informações Importantes:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Esta é uma consulta de emergência</li>
                <li>• O médico será notificado automaticamente</li>
                <li>• Mantenha a câmera e microfone ligados</li>
                <li>• Em caso de emergência real, ligue 192 (SAMU)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}