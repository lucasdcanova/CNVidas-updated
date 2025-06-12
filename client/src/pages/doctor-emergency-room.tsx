import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Clock, User, ShieldAlert, FileText, Save } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MinimalistVideoCall from '@/components/telemedicine/MinimalistVideoCall';

interface ConsultationInfo {
  roomUrl: string | null;
  token: string | null;
  appointmentId: number | null;
  patientName: string | null;
  patientAge?: number;
  patientPhone?: string;
  patientEmail?: string;
  notes: string;
}

export default function DoctorEmergencyRoom() {
  const params = useParams();
  const appointmentId = params.appointmentId || params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<ConsultationInfo>({
    roomUrl: null,
    token: null,
    appointmentId: null,
    patientName: null,
    notes: '',
  });
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Buscar informações da consulta
  useEffect(() => {
    const fetchConsultationInfo = async () => {
      if (!appointmentId) {
        setError('ID da consulta não fornecido');
        setLoading(false);
        return;
      }

      try {
        console.log(`🩺 Buscando informações da consulta de emergência: ${appointmentId}`);
        
        // Buscar informações da consulta
        const response = await apiRequest('GET', `/api/emergency/v2/consultation/${appointmentId}`);
        
        if (!response.ok) {
          throw new Error('Consulta não encontrada');
        }

        const data = await response.json();
        console.log('📋 Dados da consulta (Médico):', {
          appointmentId,
          roomUrl: data.roomUrl,
          dailyRoomUrl: data.dailyRoomUrl,
          telemedRoomName: data.telemedRoomName,
          hasToken: !!data.token
        });

        // Garantir que temos a URL da sala
        let roomUrl = data.roomUrl || data.dailyRoomUrl;
        const roomName = data.telemedRoomName; // Usar o nome que já está salvo!
        
        if (!roomUrl && roomName) {
          roomUrl = `https://cnvidas.daily.co/${roomName}`;
        }
        
        if (!roomUrl || !roomName) {
          throw new Error('Sala de emergência não encontrada. A consulta precisa ter uma sala criada.');
        }
        
        console.log('🎯 Usando sala existente (Médico):', {
          roomName,
          roomUrl,
          appointmentId
        });

        // Obter token para o médico também
        let token = data.token;
        
        if (!token) {
          console.log('🔑 Obtendo token para o médico...');
          const tokenResponse = await apiRequest('POST', '/api/telemedicine/daily/token', {
            appointmentId,
            roomName: roomName, // Usar o nome correto da sala!
            isDoctor: true
          });
          
          if (tokenResponse.ok) {
            try {
              const tokenData = await tokenResponse.json();
              console.log('🎫 Token recebido (Médico):', tokenData);
              
              // Extrair o token do objeto retornado
              if (typeof tokenData === 'object' && tokenData.token) {
                token = tokenData.token;
              } else if (typeof tokenData === 'string') {
                token = tokenData;
              }
              
              console.log('✅ Token processado:', typeof token);
            } catch (e) {
              console.log('⚠️ Erro ao processar token:', e);
            }
          }
        }
        
        console.log('🏠 Sala configurada (Médico):', {
          roomUrl,
          roomName: roomUrl.split('/').pop(),
          token,
          tokenType: typeof token,
          hasToken: !!token
        });
        
        setConsultation({
          roomUrl,
          token: token || null,
          appointmentId: parseInt(appointmentId),
          patientName: data.patientName || 'Paciente',
          patientAge: data.patientAge,
          patientPhone: data.patientPhone,
          patientEmail: data.patientEmail,
          notes: data.notes || '',
        });

        // Auto-iniciar a chamada
        setShowVideoCall(true);
        
      } catch (error) {
        console.error('❌ Erro ao buscar consulta:', error);
        setError('Não foi possível carregar as informações da consulta');
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as informações da consulta de emergência',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConsultationInfo();
  }, [appointmentId, toast]);

  // Salvar notas da consulta
  const saveConsultationNotes = async () => {
    if (!consultation.appointmentId) return;

    setSavingNotes(true);
    try {
      const response = await apiRequest('POST', `/api/appointments/${consultation.appointmentId}/notes`, {
        notes: consultation.notes,
      });

      if (response.ok) {
        toast({
          title: 'Notas salvas',
          description: 'As anotações foram salvas com sucesso',
        });
      } else {
        throw new Error('Erro ao salvar notas');
      }
    } catch (error) {
      console.error('Erro ao salvar notas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as anotações',
        variant: 'destructive',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  // Callback quando sair da chamada
  const handleLeaveCall = async () => {
    console.log('📞 Encerrando consulta de emergência');
    
    // Salvar notas finais se houver
    if (consultation.notes.trim()) {
      await saveConsultationNotes();
    }
    
    // Marcar consulta como concluída
    if (consultation.appointmentId) {
      try {
        await apiRequest('POST', `/api/emergency/v2/complete/${consultation.appointmentId}`, {
          notes: consultation.notes,
        });
      } catch (error) {
        console.error('Erro ao marcar consulta como concluída:', error);
      }
    }
    
    // Navegar de volta
    navigate('/doctor-telemedicine');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Preparando consulta de emergência...</p>
              <p className="text-sm text-muted-foreground mt-2">Aguarde enquanto configuramos a sala</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate('/doctor-telemedicine')}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showVideoCall) {
    return (
      <div className="relative min-h-screen bg-black">
        {/* Componente de vídeo minimalista em tela cheia */}
        <MinimalistVideoCall
          roomUrl={consultation.roomUrl!}
          token={consultation.token || undefined}
          onJoinCall={() => {
            console.log('Médico entrou na consulta de emergência');
          }}
          onLeaveCall={handleLeaveCall}
          userName={`Dr. ${user?.fullName || user?.username}`}
          isDoctor={true}
        />
        
        {/* Overlay com informações do paciente */}
        <div className="absolute top-4 left-4 z-40">
          <Card className="bg-black/70 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <Badge variant="destructive">Emergência</Badge>
              </div>
              <div className="text-white space-y-1">
                <p className="font-medium">{consultation.patientName}</p>
                {consultation.patientAge && (
                  <p className="text-sm text-white/70">{consultation.patientAge} anos</p>
                )}
                {consultation.patientPhone && (
                  <p className="text-sm text-white/70">{consultation.patientPhone}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Área de notas */}
        <div className="absolute bottom-20 right-4 z-40 w-80">
          <Card className="bg-black/70 backdrop-blur-md border-white/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-white" />
                  <CardTitle className="text-sm text-white">Anotações</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={saveConsultationNotes}
                  disabled={savingNotes}
                >
                  {savingNotes ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={consultation.notes}
                onChange={(e) => setConsultation(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Adicione suas anotações aqui..."
                className="min-h-[100px] bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}