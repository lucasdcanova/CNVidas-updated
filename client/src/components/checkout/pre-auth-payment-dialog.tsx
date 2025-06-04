import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Carrega o Stripe fora do componente para evitar recriar o objeto a cada render
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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

export default function PreAuthPaymentDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointmentData 
}: PreAuthPaymentDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
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
        toast({
          title: "Erro ao iniciar pagamento",
          description: error.message || "Ocorreu um erro ao processar seu pagamento. Tente novamente.",
          variant: "destructive",
        });
        onClose();
      }
    };
    
    createPaymentIntent();
  }, [isOpen, appointmentData, toast, onClose]);
  
  const handleSuccess = (paymentIntentId: string) => {
    onSuccess(paymentIntentId);
    onClose();
  };
  
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