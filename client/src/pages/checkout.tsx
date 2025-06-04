import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutFormProps {
  clientSecret: string;
  amount: number;
  serviceName?: string;
}

const CheckoutForm = ({ clientSecret, amount, serviceName }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [, navigate] = useLocation();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/payment-success",
      },
      redirect: 'if_required',
    });

    if (error) {
      toast({
        title: "Erro no pagamento",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      toast({
        title: "Pagamento realizado",
        description: "Obrigado pelo seu pagamento!",
      });
      navigate("/payment-success");
    } else {
      toast({
        title: "Pagamento em processamento",
        description: "Seu pagamento está sendo processado.",
      });
      setIsProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      <div className="pt-4">
        <Button 
          type="submit" 
          className="w-full" 
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
          ) : (
            `Pagar R$ ${(amount / 100).toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
};

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState("");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const amount = Number(urlParams.get('amount')) || 10000; // Default to R$100 if not provided
  const serviceId = urlParams.get('serviceId');
  const serviceName = urlParams.get('serviceName') || "Serviço de Saúde";

  useEffect(() => {
    if (!user) {
      toast({
        title: "Acesso não autorizado",
        description: "Faça login para continuar.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    // Create PaymentIntent as soon as the page loads
    apiRequest("POST", "/api/create-payment-intent", { 
      amount: amount, // Manter o valor em centavos, a API espera em centavos
      serviceId 
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
      })
      .catch(error => {
        toast({
          title: "Erro ao iniciar pagamento",
          description: error.message,
          variant: "destructive",
        });
      });
  }, [user, amount, serviceId, navigate, toast]);

  if (!clientSecret) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Carregando"/>
      </div>
    );
  }
  
  // Make SURE to wrap the form in <Elements> which provides the stripe context.
  return (
    <div className="container max-w-4xl py-10">
      <div className="flex flex-col md:flex-row gap-8">
        <div className={`${isMobile ? 'order-2' : 'order-1'} flex-1`}>
          <Card>
            <CardHeader>
              <CardTitle>Pagamento Seguro</CardTitle>
              <CardDescription>
                Seus dados de pagamento estão seguros
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm 
                  clientSecret={clientSecret} 
                  amount={amount} 
                  serviceName={serviceName} 
                />
              </Elements>
            </CardContent>
          </Card>
        </div>
        
        <div className={`${isMobile ? 'order-1' : 'order-2'} flex-1`}>
          <Card>
            <CardHeader>
              <CardTitle>Resumo da compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Serviço:</span>
                  <span className="font-medium">{serviceName}</span>
                </div>
                <div className="flex justify-between border-t pt-4">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-lg font-bold">R$ {(amount / 100).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}