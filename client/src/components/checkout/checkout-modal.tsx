import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, CheckCircle } from "lucide-react";
import { useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PixPaymentForm } from "./pix-payment-form";
import { BoletoPaymentForm } from "./boleto-payment-form";
import { stripePromise } from '@/lib/stripe-config';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: number | null;
  planName: string;
  planPrice: string;
  onSuccess?: () => void;
}

// Componente interno para o formulário de pagamento
const CheckoutForm = ({ 
  onSuccess, 
  onClose, 
  planName, 
  planPrice 
}: { 
  onSuccess?: () => void; 
  onClose: () => void;
  planName: string;
  planPrice: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage(null);
    
    try {
      // Confirmar o pagamento
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscription-success`,
        },
        redirect: 'if_required',
      });
      
      if (error) {
        setErrorMessage(error.message || 'Ocorreu um erro ao processar o pagamento.');
        toast({
          title: "Erro na assinatura",
          description: error.message || "Ocorreu um erro ao processar sua assinatura.",
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Pagamento bem-sucedido
        toast({
          title: "Assinatura confirmada",
          description: "Sua assinatura foi ativada com sucesso!",
        });
        
        // Invalidar a consulta para atualizar a UI
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
        
        // Chamar callback de sucesso se existir
        if (onSuccess) {
          onSuccess();
        }
        
        // Fechar o modal
        onClose();
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        // Pagamento em processamento
        toast({
          title: "Processando pagamento",
          description: "Seu pagamento está sendo processado. Você receberá uma confirmação em breve.",
        });
      }
    } catch (err: any) {
      console.error('Erro ao confirmar pagamento:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao processar sua assinatura.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement />
        
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {errorMessage}
          </div>
        )}
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="min-w-[120px]"
        >
          {isProcessing ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </span>
          ) : (
            `Assinar ${planPrice}/mês`
          )}
        </Button>
      </div>
    </form>
  );
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, 
  onClose,
  planId,
  planName,
  planPrice,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | 'boleto'>('card');
  const [pixInfo, setPixInfo] = useState<{
    qrCodeUrl?: string;
    expiresAt?: string;
    amount?: number;
  } | null>(null);
  
  const [boletoInfo, setBoletoInfo] = useState<{
    url?: string;
    code?: string;
    amount?: number;
    expiresAt?: string;
  } | null>(null);
  const { toast } = useToast();
  
  // Função para criar assinatura com método de pagamento específico
  const createSubscription = async (method: 'card' | 'pix' | 'boleto') => {
    if (!planId) return;
    
    setIsLoading(true);
    try {
      console.log('Iniciando criação de assinatura para o plano:', planId, 'com método de pagamento:', method);
      const response = await apiRequest("POST", "/api/subscription/create-session", { 
        planId: planId.toString(),
        paymentMethod: method 
      });
      
      if (!response.ok) {
        // Se a resposta não for ok, lançar um erro com mais detalhes
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro na requisição');
      }
      
      const data = await response.json();
      console.log('Resposta da API de assinatura:', data);
      
      // Armazenar que uma assinatura foi iniciada
      if (onSuccess) {
        localStorage.setItem('subscription_initiated', 'true');
      }
      
      if (data.paymentMethod === 'pix' && data.clientSecret) {
        // Para pagamentos via PIX
        console.log('PIX payment initiated, setting up for PIX');
        setClientSecret(data.clientSecret);
        setPaymentMethod('pix');
        
        if (data.pixInfo) {
          setPixInfo(data.pixInfo);
        }
      } else if (data.paymentMethod === 'boleto' && data.clientSecret) {
        // Para pagamentos via Boleto
        console.log('Boleto payment initiated, setting up for Boleto');
        setClientSecret(data.clientSecret);
        setPaymentMethod('boleto');
        
        if (data.boletoInfo) {
          setBoletoInfo(data.boletoInfo);
        }
      } else if (data.clientSecret) {
        // Para planos pagos que usam Elements com cartão
        console.log('Client secret recebido, configurando checkout Elements');
        setClientSecret(data.clientSecret);
        setPaymentMethod('card');
      } else if (data.checkoutUrl) {
        // Para planos pagos com checkout hospedado
        console.log('Incorporando Stripe Checkout na página');
        setCheckoutUrl(data.checkoutUrl);
      } else if (data.message) {
        // Plano gratuito ou outra resposta sem checkout
        console.log('Plano gratuito ou resposta sem checkout:', data.message);
        toast({
          title: "Assinatura ativada",
          description: data.message || "Sua assinatura foi ativada com sucesso!",
        });
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        throw new Error("Formato de resposta inesperado do servidor");
      }
    } catch (error: any) {
      console.error("Erro ao criar assinatura:", error);
      toast({
        title: "Erro ao criar assinatura",
        description: error.message || "Ocorreu um erro ao criar sua assinatura. Tente novamente.",
        variant: "destructive",
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    const getPaymentIntent = async () => {
      if (!planId || !isOpen) return;
      
      // Inicialmente carregamos a interface de seleção de pagamento
      // e não fazemos a requisição automaticamente
      setIsLoading(false);
    };
    
    if (isOpen && planId) {
      getPaymentIntent();
    }
  }, [planId, isOpen, toast, onClose, onSuccess]);

  // Função para lidar com o redirecionamento ao Stripe Checkout
  // Esta função só é usada como fallback se o iframe não carregar
  const redirectToCheckout = () => {
    if (checkoutUrl) {
      // Redirecionar para o checkout diretamente nesta página
      window.location.href = checkoutUrl;
    }
  };
  
  // Não definimos os componentes PixPaymentForm e BoletoPaymentForm aqui
  // pois já os importamos no início do arquivo e estamos usando-os diretamente
  
  // Componente para selecionar o método de pagamento
  const PaymentMethodSelection = ({ onSelectMethod }: { onSelectMethod: (method: 'card' | 'pix' | 'boleto') => void }) => {
    return (
      <div className="py-6">
        <h3 className="text-lg font-medium mb-4">Escolha a forma de pagamento:</h3>
        
        <Tabs defaultValue="card" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="card" className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              Cartão
            </TabsTrigger>
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="6" height="6" x="3" y="3" rx="1" /><rect width="6" height="6" x="15" y="3" rx="1" /><rect width="6" height="6" x="3" y="15" rx="1" /><path d="M15 15h.01" /><path d="M18 15h.01" /><path d="M21 15h.01" /><path d="M21 18h.01" /><path d="M21 21h.01" /><path d="M18 21h.01" /><path d="M15 21h.01" /><path d="M15 18h.01" /></svg>
              PIX
            </TabsTrigger>
            <TabsTrigger value="boleto" className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><path d="M4 15h16"/><path d="M4 10h16"/><path d="M4 5h16"/></svg>
              Boleto
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="card" className="mt-4 p-4 border rounded-lg bg-slate-50">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white rounded-md border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <div>
                  <h4 className="font-medium">Cartão de Crédito</h4>
                  <p className="text-sm text-slate-500">Pagamento recorrente mensal</p>
                </div>
              </div>
              
              <Button 
                onClick={() => onSelectMethod('card')} 
                className="w-full"
              >
                Continuar com Cartão
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="pix" className="mt-4 p-4 border rounded-lg bg-slate-50">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white rounded-md border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><rect width="6" height="6" x="3" y="3" rx="1" /><rect width="6" height="6" x="15" y="3" rx="1" /><rect width="6" height="6" x="3" y="15" rx="1" /><path d="M15 15h.01" /><path d="M18 15h.01" /><path d="M21 15h.01" /><path d="M21 18h.01" /><path d="M21 21h.01" /><path d="M18 21h.01" /><path d="M15 21h.01" /><path d="M15 18h.01" /></svg>
                </div>
                <div>
                  <h4 className="font-medium">PIX</h4>
                  <p className="text-sm text-slate-500">Pagamento único com validade de 60 minutos</p>
                </div>
              </div>
              
              <Button 
                onClick={() => onSelectMethod('pix')} 
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                Continuar com PIX
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="boleto" className="mt-4 p-4 border rounded-lg bg-slate-50">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white rounded-md border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><path d="M4 15h16"/><path d="M4 10h16"/><path d="M4 5h16"/></svg>
                </div>
                <div>
                  <h4 className="font-medium">Boleto Bancário</h4>
                  <p className="text-sm text-slate-500">Validade de 3 dias</p>
                </div>
              </div>
              
              <Button 
                onClick={() => onSelectMethod('boleto')} 
                className="w-full bg-slate-800 hover:bg-slate-900"
              >
                Continuar com Boleto
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="border-t pt-4">
          <p className="text-sm text-slate-500 text-center">
            Todos os pagamentos são processados de forma segura via Stripe
          </p>
        </div>
      </div>
    );
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assinar plano {planName}</DialogTitle>
          <DialogDescription>
            Complete os detalhes de pagamento abaixo para assinar o plano {planName} por {planPrice}/mês
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="mt-4 flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-center">Preparando o checkout seguro...</p>
            <p className="text-center text-sm text-muted-foreground mt-2">Aguarde enquanto preparamos sua página de pagamento.</p>
          </div>
        ) : checkoutUrl ? (
          <div className="py-4" id="stripe-checkout-container-modal">
            <div className="flex flex-col items-center justify-center p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium mb-2">Finalizar pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  A página de checkout seguro está pronta para concluir seu pedido
                </p>
              </div>
              
              <div className="w-full max-w-md py-4 px-6 border rounded-lg bg-slate-50 mb-6">
                <div className="flex justify-between items-center mb-6 pb-3 border-b">
                  <span className="font-medium">Detalhes da assinatura</span>
                  <span className="text-sm text-muted-foreground">CN Vidas</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Plano</span>
                    <span className="font-medium">{planName}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Valor</span>
                    <span className="font-medium">{planPrice}/mês</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-3 border-t">
                    <span className="text-sm font-medium">Total</span>
                    <span className="font-medium">{planPrice}/mês</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 w-full max-w-md">
                <Button 
                  onClick={redirectToCheckout}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium rounded-lg py-6"
                >
                  Finalizar Pagamento Seguro
                </Button>
                
                <Button 
                  onClick={onClose}
                  variant="outline"
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
              
              <div className="flex items-center justify-center mt-5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                <span className="text-xs text-muted-foreground">Pagamento 100% seguro via Stripe</span>
              </div>
            </div>
          </div>
        ) : clientSecret && paymentMethod === 'pix' ? (
          <div className="py-4">
            <PixPaymentForm
              pixInfo={pixInfo || { amount: Number(planPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) }}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </div>
        ) : clientSecret && paymentMethod === 'boleto' ? (
          <div className="py-4">
            <BoletoPaymentForm
              boletoInfo={{ amount: Number(planPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) }}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </div>
        ) : clientSecret && paymentMethod === 'card' ? (
          <div className="py-4">
            <Elements 
              stripe={stripePromise} 
              options={{ clientSecret }}
            >
              <CheckoutForm 
                onSuccess={onSuccess} 
                onClose={onClose} 
                planName={planName}
                planPrice={planPrice}
              />
            </Elements>
          </div>
        ) : !clientSecret && !checkoutUrl ? (
          <PaymentMethodSelection 
            onSelectMethod={(method) => createSubscription(method)}
          />
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center py-8">
            <p className="text-center text-red-500">Não foi possível carregar o formulário de pagamento. Tente novamente mais tarde.</p>
            <Button className="mt-4" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;