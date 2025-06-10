import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

export type CheckoutType = "subscription" | "consultation" | "service";
export type CheckoutStatus = 
  | "initiated" 
  | "processing" 
  | "completed" 
  | "failed" 
  | "abandoned" 
  | "payment_failed" 
  | "payment_expired";

interface CreateCheckoutParams {
  checkoutType: CheckoutType;
  amount: number;
  paymentMethod?: "card" | "pix" | "boleto";
  metadata?: Record<string, any>;
}

interface UpdateCheckoutParams {
  id: number;
  status?: CheckoutStatus;
  paymentStatus?: "pending" | "processing" | "succeeded" | "failed" | "expired";
  paymentError?: string;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  stripeErrorCode?: string;
  completedAt?: string;
  abandonedAt?: string;
}

export function useCheckoutTracking() {
  const { user } = useAuth();
  
  // Criar novo registro de checkout
  const createCheckout = useMutation({
    mutationFn: async (params: CreateCheckoutParams) => {
      const response = await apiRequest('POST', '/api/checkout-tracking', params);
      const data = await response.json();
      return data.checkoutId;
    },
    onError: (error) => {
      console.error("Erro ao criar registro de checkout:", error);
    }
  });
  
  // Atualizar status do checkout
  const updateCheckout = useMutation({
    mutationFn: async ({ id, ...params }: UpdateCheckoutParams) => {
      await apiRequest('PATCH', `/api/checkout-tracking/${id}`, params);
    },
    onError: (error) => {
      console.error("Erro ao atualizar checkout:", error);
    }
  });
  
  // Função helper para rastrear início de checkout
  const trackCheckoutStart = async (
    type: CheckoutType, 
    amount: number, 
    metadata?: Record<string, any>
  ) => {
    if (!user) return null;
    
    try {
      const checkoutId = await createCheckout.mutateAsync({
        checkoutType: type,
        amount,
        metadata
      });
      
      // Salvar o ID no sessionStorage para uso posterior
      sessionStorage.setItem('currentCheckoutId', checkoutId.toString());
      
      return checkoutId;
    } catch (error) {
      console.error("Erro ao rastrear início de checkout:", error);
      return null;
    }
  };
  
  // Função helper para atualizar progresso do checkout
  const trackCheckoutProgress = async (
    status: CheckoutStatus,
    additionalData?: Partial<UpdateCheckoutParams>
  ) => {
    const checkoutId = sessionStorage.getItem('currentCheckoutId');
    if (!checkoutId) return;
    
    try {
      await updateCheckout.mutateAsync({
        id: parseInt(checkoutId),
        status,
        ...additionalData
      });
    } catch (error) {
      console.error("Erro ao rastrear progresso do checkout:", error);
    }
  };
  
  // Função helper para marcar checkout como completo
  const trackCheckoutComplete = async (
    paymentIntentId?: string,
    sessionId?: string
  ) => {
    const checkoutId = sessionStorage.getItem('currentCheckoutId');
    if (!checkoutId) return;
    
    try {
      await updateCheckout.mutateAsync({
        id: parseInt(checkoutId),
        status: 'completed',
        paymentStatus: 'succeeded',
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: sessionId,
        completedAt: new Date().toISOString()
      });
      
      // Limpar o ID do sessionStorage
      sessionStorage.removeItem('currentCheckoutId');
    } catch (error) {
      console.error("Erro ao marcar checkout como completo:", error);
    }
  };
  
  // Função helper para marcar checkout como falhado
  const trackCheckoutFailed = async (
    errorMessage?: string,
    errorCode?: string
  ) => {
    const checkoutId = sessionStorage.getItem('currentCheckoutId');
    if (!checkoutId) return;
    
    try {
      await updateCheckout.mutateAsync({
        id: parseInt(checkoutId),
        status: 'payment_failed',
        paymentStatus: 'failed',
        paymentError: errorMessage,
        stripeErrorCode: errorCode
      });
    } catch (error) {
      console.error("Erro ao marcar checkout como falhado:", error);
    }
  };
  
  // Função helper para marcar checkout como abandonado
  const trackCheckoutAbandoned = async () => {
    const checkoutId = sessionStorage.getItem('currentCheckoutId');
    if (!checkoutId) return;
    
    try {
      await updateCheckout.mutateAsync({
        id: parseInt(checkoutId),
        status: 'abandoned',
        abandonedAt: new Date().toISOString()
      });
      
      // Limpar o ID do sessionStorage
      sessionStorage.removeItem('currentCheckoutId');
    } catch (error) {
      console.error("Erro ao marcar checkout como abandonado:", error);
    }
  };
  
  // Detectar abandono quando o usuário sair da página
  const setupAbandonmentDetection = () => {
    const handleBeforeUnload = () => {
      const checkoutId = sessionStorage.getItem('currentCheckoutId');
      if (checkoutId) {
        // Usar sendBeacon para garantir que a requisição seja enviada
        const data = JSON.stringify({
          status: 'abandoned',
          abandonedAt: new Date().toISOString()
        });
        
        navigator.sendBeacon(
          `/api/checkout-tracking/${checkoutId}`,
          new Blob([data], { type: 'application/json' })
        );
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  };
  
  return {
    trackCheckoutStart,
    trackCheckoutProgress,
    trackCheckoutComplete,
    trackCheckoutFailed,
    trackCheckoutAbandoned,
    setupAbandonmentDetection,
    isTracking: createCheckout.isPending || updateCheckout.isPending
  };
}