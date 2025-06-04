import Stripe from 'stripe';

/**
 * Utilitário para padronizar o acesso à API do Stripe em todo o sistema
 * Este arquivo centraliza a configuração do cliente Stripe para garantir consistência
 */

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Verificar se a chave do Stripe é uma chave secreta válida
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('AVISO: A chave STRIPE_SECRET_KEY não parece ser uma chave secreta válida (deve começar com sk_)');
}

// Criar uma única instância do cliente Stripe para todo o sistema
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion
});

// Exportar a instância do Stripe para ser usada em outros arquivos
export default stripe;