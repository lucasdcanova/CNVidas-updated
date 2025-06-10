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
      console.log('Criando setup intent...');
      
      const response = await apiRequest('POST', '/api/subscription/create-setup-intent');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Erro na resposta do setup intent:', response.status, errorData);
        throw new Error(errorData.error || `Falha ao criar setup intent: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Setup intent criado com sucesso:', data);
      
      if (!data.clientSecret) {
        throw new Error('Client secret não retornado pelo servidor');
      }
      
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
    createSetupIntent,
    clientSecret
  };
} 