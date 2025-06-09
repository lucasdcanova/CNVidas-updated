import { loadStripe } from '@stripe/stripe-js';

// Chave pública do Stripe
// Utiliza a variável de ambiente ou um fallback para garantir funcionamento
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_live_51RAOnMKOsPzrrDErXaDRtMivvPi3iVD7socexHWBbvb5BEjeUuDBxhC3WTrBRC9NLJ1IASrSAI8SGQj8ZF9uZA8F002np3ZUCz';

// Validação da chave
if (!STRIPE_PUBLIC_KEY) {
  console.error('Stripe public key is not configured properly');
}

// Promise do Stripe
export const stripePromise = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null;