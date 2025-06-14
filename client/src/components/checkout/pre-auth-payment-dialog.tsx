import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { stripePromise } from '@/lib/stripe-config';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PreAuthPaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

const PreAuthPaymentForm = ({ clientSecret, amount, onSuccess, onCancel }: PreAuthPaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Importante: não definir return_url para evitar redirecionamento
        // Queremos apenas pré-autorizar o pagamento, sem capturar ainda
      },
      redirect: 'if_required',
    });

    if (error) {
      toast({
        title: "Erro na pré-autorização",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'requires_capture') {
      toast({
        title: "Pré-autorização concluída",
        description: "Sua consulta será confirmada após aprovação do médico.",
      });
      // Informa o componente pai sobre o sucesso, passando o ID do paymentIntent
      onSuccess(paymentIntent.id);
    } else {
      toast({
        title: "Status de pagamento inesperado",
        description: `Status: ${paymentIntent?.status || 'desconhecido'}`,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      <div className="flex gap-4 pt-4">
        <Button 
          type="button" 
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="flex-1" 
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
          ) : (
            `Pré-autorizar R$ ${(amount / 100).toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
};

interface PreAuthPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => void;
  appointmentData: {
    doctorId: number;
    doctorName: string;
    date: string;
    amount: number;
    isEmergency?: boolean;
  };
}

// Componente para adicionar novo método de pagamento
const AddPaymentMethodForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required'
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Método de pagamento adicionado",
        description: "Seu cartão foi adicionado com sucesso. Processando o agendamento...",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar o método de pagamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-muted/50">
        <PaymentElement />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adicionando...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Adicionar e continuar
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default function PreAuthPaymentDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointmentData 
}: PreAuthPaymentDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const createPaymentIntent = async () => {
      if (!isOpen || !appointmentData) return;
      
      try {
        const response = await apiRequest("POST", "/api/consultations/create-payment-intent", {
          amount: appointmentData.amount,
          doctorId: appointmentData.doctorId,
          doctorName: appointmentData.doctorName,
          date: appointmentData.date,
          isEmergency: appointmentData.isEmergency || false
        });
        
        const data = await response.json();
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error(data.message || "Não foi possível criar a intenção de pagamento");
        }
      } catch (error: any) {
        console.error("Erro ao criar intenção de pagamento:", error);
        
        // Verificar se é erro de método de pagamento não cadastrado
        const errorMessage = error.message || error.toString();
        const isPaymentMethodError = errorMessage.includes("método de pagamento cadastrado");
        
        if (isPaymentMethodError) {
          // Criar setup intent para adicionar novo método de pagamento
          try {
            const setupResponse = await apiRequest("POST", "/api/subscription/create-setup-intent");
            const setupData = await setupResponse.json();
            
            if (setupData.clientSecret) {
              setSetupClientSecret(setupData.clientSecret);
              setIsAddingPaymentMethod(true);
            } else {
              throw new Error("Não foi possível iniciar o processo de adicionar método de pagamento");
            }
          } catch (setupError) {
            console.error("Erro ao criar setup intent:", setupError);
            toast({
              title: "Erro ao iniciar configuração",
              description: "Não foi possível iniciar o processo de adicionar método de pagamento. Tente novamente.",
              variant: "destructive",
            });
            onClose();
          }
        } else {
          toast({
            title: "Erro ao iniciar pagamento",
            description: errorMessage || "Ocorreu um erro ao processar seu pagamento. Tente novamente.",
            variant: "destructive",
          });
          onClose();
        }
      }
    };
    
    createPaymentIntent();
  }, [isOpen, appointmentData, toast, onClose]);

  // Função para lidar com sucesso ao adicionar método de pagamento
  const handlePaymentMethodAdded = async () => {
    setIsAddingPaymentMethod(false);
    setSetupClientSecret(null);
    
    // Tentar criar payment intent novamente
    if (appointmentData) {
      try {
        const response = await apiRequest("POST", "/api/consultations/create-payment-intent", {
          amount: appointmentData.amount,
          doctorId: appointmentData.doctorId,
          doctorName: appointmentData.doctorName,
          date: appointmentData.date,
          isEmergency: appointmentData.isEmergency || false
        });
        
        const data = await response.json();
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error(data.message || "Não foi possível criar a intenção de pagamento");
        }
      } catch (error: any) {
        console.error("Erro ao criar intenção de pagamento após adicionar método:", error);
        toast({
          title: "Erro ao processar pagamento",
          description: "Método de pagamento adicionado, mas houve um erro ao processar o agendamento. Tente novamente.",
          variant: "destructive",
        });
        onClose();
      }
    }
  };
  
  const handleSuccess = (paymentIntentId: string) => {
    onSuccess(paymentIntentId);
    onClose();
  };
  
  // Renderizar formulário de adicionar método de pagamento
  if (isAddingPaymentMethod && setupClientSecret) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Método de Pagamento</DialogTitle>
            <DialogDescription>
              Você precisa adicionar um método de pagamento para continuar com o agendamento.
            </DialogDescription>
          </DialogHeader>
          
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Após adicionar seu cartão, o agendamento será processado automaticamente.
            </AlertDescription>
          </Alert>
          
          <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
            <AddPaymentMethodForm
              onSuccess={handlePaymentMethodAdded}
              onCancel={onClose}
            />
          </Elements>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Mostrar loading enquanto prepara o pagamento
  if (!clientSecret) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processando pagamento</DialogTitle>
            <DialogDescription>
              Preparando o sistema de pagamento seguro...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Renderizar formulário de pagamento normal
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pré-autorização de Pagamento</DialogTitle>
          <DialogDescription>
            Pré-autorize o pagamento da sua consulta. O valor só será cobrado após a realização da consulta.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-4 text-sm">
          <div className="grid grid-cols-2 gap-2 py-2 border-b">
            <span className="text-muted-foreground">Médico:</span>
            <span className="font-medium">{appointmentData.doctorName}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 py-2 border-b">
            <span className="text-muted-foreground">Data:</span>
            <span className="font-medium">{new Date(appointmentData.date).toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 py-2 border-b">
            <span className="text-muted-foreground">Tipo:</span>
            <span className="font-medium">{appointmentData.isEmergency ? 'Consulta de Emergência' : 'Consulta Agendada'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 py-2 border-b">
            <span className="text-muted-foreground">Valor:</span>
            <span className="font-medium">R$ {(appointmentData.amount / 100).toFixed(2)}</span>
          </div>
        </div>
        
        <div className="p-1 my-2 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-700 p-2">
            <strong>Importante:</strong> Este valor será apenas pré-autorizado no seu cartão. A cobrança só será 
            realizada após a confirmação da consulta pelo médico.
          </p>
        </div>
        
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PreAuthPaymentForm 
            clientSecret={clientSecret}
            amount={appointmentData.amount}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}