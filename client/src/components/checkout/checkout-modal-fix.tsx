import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
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

// Componente interno para o formulário de pagamento com cartão
const CheckoutForm: React.FC<{
  onSuccess?: () => void;
  onClose: () => void;
  planName: string;
  planPrice: string;
}> = ({ 
  onSuccess, 
  onClose, 
  planName, 
  planPrice 
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
        // Pagamento bem-sucedido - confirmar no backend
        try {
          const confirmResponse = await apiRequest('POST', '/api/subscription/confirm-payment', {
            paymentIntentId: paymentIntent.id
          });
          
          if (confirmResponse.ok) {
            toast({
              title: "Assinatura ativada!",
              description: "Sua assinatura foi ativada com sucesso!",
            });
            
            // Invalidar a consulta para atualizar a UI
            queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/check"] });
            
            // Marcar que o pagamento foi confirmado para evitar loops
            sessionStorage.setItem('payment-confirmed', 'true');
            
            // Redirecionar para página de ativação
            window.location.href = '/plan-activation';
            
            // Fechar o modal
            onClose();
          } else {
            throw new Error('Falha ao confirmar pagamento no servidor');
          }
        } catch (confirmError) {
          console.error('Erro ao confirmar pagamento:', confirmError);
          toast({
            title: "Aviso",
            description: "Pagamento recebido, mas houve um erro ao ativar a assinatura. Por favor, entre em contato com o suporte.",
            variant: "destructive",
          });
        }
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        // Pagamento em processamento
        toast({
          title: "Processando pagamento",
          description: "Seu pagamento está sendo processado. Você receberá uma confirmação em breve.",
        });
        
        // Marcar que o pagamento está sendo processado
        sessionStorage.setItem('payment-processing', 'true');
        
        // Redirecionar para página de ativação para aguardar confirmação
        window.location.href = '/plan-activation';
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

// Componente para selecionar o método de pagamento
const PaymentMethodSelection: React.FC<{ 
  onSelectMethod: (method: 'card' | 'pix' | 'boleto') => void 
}> = ({ onSelectMethod }) => {
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

// Componente principal do modal de checkout
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
  
  // Etapa do checkout - 'select' para seleção de método, 'form' para o formulário de pagamento
  const [checkoutStep, setCheckoutStep] = useState<'select' | 'form'>('select');
  
  // Função para criar assinatura com método de pagamento específico
  const createSubscription = async (method: 'card' | 'pix' | 'boleto') => {
    if (!planId) return;
    
    setIsLoading(true);
    try {
      console.log('Iniciando criação de assinatura para o plano:', planId, 'com método de pagamento:', method);
      
      // Obter o token de autenticação do localStorage
      const authToken = localStorage.getItem("authToken");
      console.log('Token de autenticação disponível:', !!authToken);
      
      // Fazer a solicitação incluindo o token nos headers manualmente
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        headers['X-Auth-Token'] = authToken; // Header adicional para compatibilidade
      }
      
      const response = await fetch("/api/subscription/create-session", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ planId: planId.toString(), paymentMethod: method }),
        credentials: 'include'
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
        setCheckoutStep('form');
        
        if (data.pixInfo) {
          setPixInfo(data.pixInfo);
        }
      } else if (data.paymentMethod === 'boleto' && data.clientSecret) {
        // Para pagamentos via Boleto
        console.log('Boleto payment initiated, setting up for Boleto');
        setClientSecret(data.clientSecret);
        setPaymentMethod('boleto');
        setCheckoutStep('form');
        
        if (data.boletoInfo) {
          setBoletoInfo(data.boletoInfo);
        }
      } else if (data.clientSecret) {
        // Para planos pagos que usam Elements com cartão
        console.log('Client secret recebido, configurando checkout Elements');
        setClientSecret(data.clientSecret);
        setPaymentMethod('card');
        setCheckoutStep('form');
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
        description: error.message || "Ocorreu um erro ao processar sua assinatura. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset do estado quando o modal é fechado
  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null);
      setCheckoutUrl(null);
      setCheckoutStep('select');
      setPixInfo(null);
      setBoletoInfo(null);
    }
  }, [isOpen]);
  
  // Renderizar o componente adequado com base na etapa atual e método de pagamento
  const renderCheckoutContent = () => {
    if (isLoading) {
      return (
        <div className="mt-4 flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-center">Preparando o checkout seguro...</p>
          <p className="text-center text-sm text-muted-foreground mt-2">Aguarde enquanto preparamos sua página de pagamento.</p>
        </div>
      );
    }
    
    // Etapa de seleção de método de pagamento
    if (checkoutStep === 'select') {
      return (
        <PaymentMethodSelection onSelectMethod={createSubscription} />
      );
    }
    
    // Etapa de formulário de pagamento, baseado no método selecionado
    if (checkoutStep === 'form') {
      if (paymentMethod === 'pix') {
        return (
          <PixPaymentForm 
            pixInfo={pixInfo} 
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      }
      
      if (paymentMethod === 'boleto') {
        return (
          <BoletoPaymentForm 
            boletoInfo={boletoInfo} 
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      }
      
      // Formulário de cartão de crédito com Elements
      if (clientSecret) {
        return (
          <Elements 
            stripe={stripePromise} 
            options={{ 
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#0284c7',
                  colorBackground: '#ffffff',
                  colorText: '#1e293b',
                  colorDanger: '#ef4444',
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  spacingUnit: '4px',
                  borderRadius: '8px',
                }
              }
            }}
          >
            <CheckoutForm 
              onSuccess={onSuccess} 
              onClose={onClose} 
              planName={planName} 
              planPrice={planPrice} 
            />
          </Elements>
        );
      }
    }
    
    // Fallback
    return (
      <div className="p-6 text-center">
        <p>Ocorreu um erro ao carregar as opções de pagamento.</p>
        <Button onClick={onClose} className="mt-4">Fechar</Button>
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
        
        {renderCheckoutContent()}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;