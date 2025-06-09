import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe-config';

interface StripeSetupProviderProps {
  clientSecret: string | null;
  children: React.ReactNode;
}

export function StripeSetupProvider({ clientSecret, children }: StripeSetupProviderProps) {
  if (!clientSecret || !stripePromise) {
    return null;
  }

  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0f172a',
      colorBackground: '#ffffff',
      colorText: '#0f172a',
      colorDanger: '#ef4444',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '4px',
    },
  };

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
      }}
    >
      {children}
    </Elements>
  );
} 