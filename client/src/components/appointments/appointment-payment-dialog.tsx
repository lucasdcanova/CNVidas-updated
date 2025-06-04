import { useState } from "react";
import PreAuthPaymentDialog from '../checkout/pre-auth-payment-dialog';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface AppointmentPaymentDialogProps {
  doctorId: number;
  doctorName: string;
  date: string;
  price: number;
  isEmergency?: boolean;
  onSuccess: (appointmentId: number) => void;
  onCancel: () => void;
}

export function AppointmentPaymentDialog({
  doctorId,
  doctorName,
  date,
  price,
  isEmergency = false,
  onSuccess,
  onCancel
}: AppointmentPaymentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para criar consulta após a pré-autorização de pagamento
  const createAppointment = async (paymentIntentId: string) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/appointments", {
        doctorId,
        date,
        isEmergency,
        paymentIntentId,
        paymentAmount: price,
        type: "telemedicine"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao agendar consulta");
      }
      
      const data = await response.json();
      
      // Invalidar cache para forçar atualização da lista de consultas
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
      
      toast({
        title: "Consulta agendada!",
        description: `Sua consulta com Dr. ${doctorName} foi agendada com sucesso.`,
      });
      
      // Chamar callback de sucesso passando o ID da consulta
      onSuccess(data.id);
    } catch (error: any) {
      console.error("Erro ao agendar consulta:", error);
      toast({
        title: "Erro ao agendar consulta",
        description: error.message || "Ocorreu um erro ao agendar sua consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quando o pagamento for bem-sucedido, criar a consulta
  const handlePaymentSuccess = (paymentIntentId: string) => {
    createAppointment(paymentIntentId);
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-md p-4 bg-gray-50">
        <h3 className="font-semibold text-lg mb-2">Resumo da consulta</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Médico:</span>
            <span className="font-medium">{doctorName}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data:</span>
            <span className="font-medium">{new Date(date).toLocaleDateString('pt-BR')}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Horário:</span>
            <span className="font-medium">{new Date(date).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo:</span>
            <span className="font-medium">{isEmergency ? 'Consulta de Emergência' : 'Consulta Agendada'}</span>
          </div>
          
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="text-muted-foreground">Valor:</span>
            <span className="font-medium">R$ {(price / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-sm text-amber-800">
          <strong>Importante:</strong> Para confirmar sua consulta, será feita uma pré-autorização 
          deste valor em seu cartão de crédito. A cobrança só será efetivada após a realização da consulta.
        </p>
      </div>
      
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        
        <Button
          onClick={() => setIsPaymentOpen(true)}
          className="flex-1"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            "Continuar para pagamento"
          )}
        </Button>
      </div>
      
      {/* Diálogo de pagamento pré-autorizado */}
      <PreAuthPaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
        appointmentData={{
          doctorId,
          doctorName,
          date,
          amount: price,
          isEmergency
        }}
      />
    </div>
  );
}