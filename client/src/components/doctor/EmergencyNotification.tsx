import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldAlert, User, Clock, Video, X, Bell
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface EmergencyNotificationProps {
  doctorId: number;
}

interface EmergencyAlert {
  id: string;
  patientId: number;
  patientName: string;
  patientProfileImage?: string;
  timestamp: string;
  roomUrl: string;
  appointmentId?: number;
}

export function EmergencyNotification({ doctorId }: EmergencyNotificationProps) {
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);
  const { toast } = useToast();

  // Polling para verificar chamadas de emergência
  useEffect(() => {
    const checkEmergencyCalls = async () => {
      try {
        const response = await apiRequest('GET', `/api/emergency/v2/notifications/${doctorId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            setEmergencyAlerts(data);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar chamadas de emergência:', error);
      }
    };

    // Verificar a cada 5 segundos
    const interval = setInterval(checkEmergencyCalls, 5000);
    // Verificar imediatamente
    checkEmergencyCalls();

    return () => clearInterval(interval);
  }, [doctorId]);

  const handleJoinEmergency = (alert: EmergencyAlert) => {
    // Redirecionar para a página de emergência do médico com o appointmentId
    window.location.href = `/doctor-emergency/${alert.appointmentId || alert.id}`;
    
    toast({
      title: "Entrando na sala de emergência",
      description: `Conectando com ${alert.patientName}...`,
    });
  };

  const handleDismissAlert = (alertId: string) => {
    setEmergencyAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  if (emergencyAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {emergencyAlerts.map((alert) => (
        <Card key={alert.id} className="border-red-500 bg-red-50 shadow-lg animate-pulse">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <CardTitle className="text-red-700 text-sm font-semibold">
                  EMERGÊNCIA MÉDICA
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismissAlert(alert.id)}
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Informações do paciente */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  {alert.patientProfileImage ? (
                    <img 
                      src={alert.patientProfileImage} 
                      alt={alert.patientName} 
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-red-800">{alert.patientName}</p>
                  <div className="flex items-center text-xs text-red-600">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>Há {Math.floor((Date.now() - new Date(alert.timestamp).getTime()) / 60000)} min</span>
                  </div>
                </div>
              </div>

              {/* Badge de urgência */}
              <Badge variant="destructive" className="bg-red-600 text-white">
                <Bell className="w-3 h-3 mr-1 animate-bounce" />
                Chamada urgente
              </Badge>

              {/* Botão para atender */}
              <Button
                onClick={() => handleJoinEmergency(alert)}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="sm"
              >
                <Video className="w-4 h-4 mr-2" />
                Atender Emergência
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}