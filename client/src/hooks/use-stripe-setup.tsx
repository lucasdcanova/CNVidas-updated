import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe-config';

interface UseStripeSetupProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// Provider do Stripe
const StripeSetupProvider = ({ children, clientSecret }: { children: React.ReactNode; clientSecret: string | null }) => {
  if (!clientSecret || !stripePromise) {
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      {children}
    </Elements>
  );
};

export function useStripeSetup({ onSuccess, onError }: UseStripeSetupProps = {}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const createSetupIntent = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await apiRequest('POST', '/api/subscription/create-setup-intent');
      if (!response.ok) {
        throw new Error('Falha ao criar setup intent');
      }
      const data = await response.json();
      setClientSecret(data.clientSecret);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao criar setup intent:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!clientSecret) {
      createSetupIntent();
    }
  }, [clientSecret]);

  return {
    StripeSetupProvider: ({ children }: { children: React.ReactNode }) => (
      <StripeSetupProvider clientSecret={clientSecret}>
        {children}
      </StripeSetupProvider>
    ),
    isLoading,
    createSetupIntent
  };
} 