import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, DollarSign } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DoctorPaymentActionsProps {
  appointmentId: number;
  patientName: string;
  paymentStatus: string;
  paymentAmount: number;
}

export function DoctorPaymentActions({
  appointmentId,
  patientName,
  paymentStatus,
  paymentAmount
}: DoctorPaymentActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptureDialogOpen, setIsCaptureDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para capturar o pagamento pré-autorizado
  const capturePayment = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/consultations/capture-payment/${appointmentId}`, {});
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao processar pagamento");
      }
      
      // Invalidar cache para forçar atualização da lista de consultas
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      
      toast({
        title: "Pagamento processado!",
        description: `O pagamento da consulta com ${patientName} foi processado com sucesso.`,
      });
      
      setIsCaptureDialogOpen(false);
    } catch (error: any) {
      console.error("Erro ao processar pagamento:", error);
      toast({
        title: "Erro ao processar pagamento",
        description: error.message || "Ocorreu um erro ao processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para cancelar o pagamento pré-autorizado
  const cancelPayment = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/consultations/cancel-payment/${appointmentId}`, {
        reason: "Cancelado pelo médico"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao cancelar pagamento");
      }
      
      // Invalidar cache para forçar atualização da lista de consultas
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      
      toast({
        title: "Pagamento cancelado",
        description: `O pagamento da consulta com ${patientName} foi cancelado com sucesso.`,
      });
      
      setIsCancelDialogOpen(false);
    } catch (error: any) {
      console.error("Erro ao cancelar pagamento:", error);
      toast({
        title: "Erro ao cancelar pagamento",
        description: error.message || "Ocorreu um erro ao cancelar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (paymentStatus === 'pending' || paymentStatus === 'authorized') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-green-600 border-green-600 hover:bg-green-50"
          onClick={() => setIsCaptureDialogOpen(true)}
        >
          <Check className="w-4 h-4 mr-1" /> Confirmar
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-600 hover:bg-red-50"
          onClick={() => setIsCancelDialogOpen(true)}
        >
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
        
        {/* Diálogo de confirmação para capturar pagamento */}
        <AlertDialog open={isCaptureDialogOpen} onOpenChange={setIsCaptureDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Ao confirmar, o valor de R$ {(paymentAmount / 100).toFixed(2)} será cobrado do paciente {patientName}.
                <br /><br />
                <span className="font-medium text-amber-600">
                  Importante: Esta ação só deve ser realizada após a consulta ser concluída.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={capturePayment} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Confirmar pagamento
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Diálogo de confirmação para cancelar pagamento */}
        <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a cancelar a pré-autorização de pagamento de R$ {(paymentAmount / 100).toFixed(2)} 
                para a consulta com {patientName}.
                <br /><br />
                <span className="font-medium text-amber-600">
                  O valor reservado será liberado no cartão do paciente.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={cancelPayment} 
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar pagamento
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
  
  // Mostrar status para pagamentos já processados
  if (paymentStatus === 'completed') {
    return (
      <div className="flex items-center text-green-600">
        <Check className="w-4 h-4 mr-1" />
        <span className="text-sm">Pago</span>
      </div>
    );
  }
  
  if (paymentStatus === 'cancelled') {
    return (
      <div className="flex items-center text-red-600">
        <X className="w-4 h-4 mr-1" />
        <span className="text-sm">Cancelado</span>
      </div>
    );
  }
  
  return (
    <div className="text-sm text-gray-500">
      {paymentStatus || "Sem pagamento"}
    </div>
  );
}