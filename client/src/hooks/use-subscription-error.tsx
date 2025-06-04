import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface SubscriptionError {
  message: string;
  requiresUpgrade: boolean;
  currentPlan?: string;
  requiredPlan?: 'basic' | 'premium';
}

interface UseSubscriptionErrorReturn {
  subscriptionError: SubscriptionError | null;
  setSubscriptionError: (error: SubscriptionError | null) => void;
  handleApiError: (error: unknown) => boolean; // Returns true if it was a subscription error
  clearSubscriptionError: () => void;
}

export const useSubscriptionError = (): UseSubscriptionErrorReturn => {
  const { user } = useAuth();
  const [subscriptionError, setSubscriptionError] = useState<SubscriptionError | null>(null);

  const handleApiError = useCallback((error: unknown): boolean => {
    // Verifica se o erro é relacionado a restrições de assinatura
    if (typeof error === 'object' && error !== null && (error as any)?.response?.status === 403) {
      try {
        const errorData = (error as any).response.data;
        if (errorData?.requiresUpgrade) {
          setSubscriptionError({
            message: errorData.message || 'Esta funcionalidade requer um plano superior',
            requiresUpgrade: true,
            currentPlan: user?.subscriptionPlan || 'free',
            requiredPlan: errorData.requiredPlan || 'basic',
          });
          return true; // Foi um erro de assinatura
        }
      } catch (err) {
        // Não é um erro de assinatura ou não conseguimos analisar
        console.error('Erro ao processar erro de assinatura:', err);
      }
    }
    return false; // Não é um erro de assinatura
  }, [user?.subscriptionPlan]);

  const clearSubscriptionError = useCallback(() => {
    setSubscriptionError(null);
  }, []);

  return {
    subscriptionError,
    setSubscriptionError,
    handleApiError,
    clearSubscriptionError,
  };
};

export default useSubscriptionError;