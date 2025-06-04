import { storage } from '../storage';
import stripe from './stripe-instance';
import type Stripe from 'stripe';

/**
 * Configurações para os métodos de pagamento brasileiros
 */
export const brazilianPaymentOptions = {
  // Opções para pagamento via PIX
  pix: {
    expires_in: 3600, // 60 minutos (1 hora)
  },
  // Opções para pagamento via boleto
  boleto: {
    expires_in: 259200, // 3 dias (72 horas = 259200 segundos)
  }
};

interface ConsultationMetadata {
  userId: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentId: string;
  isEmergency: string;
}

/**
 * Cria uma intenção de pagamento para consulta com pré-autorização
 * O valor será reservado no cartão, mas só será capturado após a consulta
 */
export async function createConsultationPaymentIntent(
  amount: number, 
  customerId: string,
  metadata: ConsultationMetadata
): Promise<Stripe.PaymentIntent> {
  try {
    // Criar a intenção de pagamento com captura manual
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Converter para centavos
      currency: 'brl',
      customer: customerId,
      setup_future_usage: 'off_session',
      capture_method: 'manual', // Importante: habilita a captura manual (pré-autorização)
      metadata: {
        ...metadata,
        type: 'consultation_payment',
      },
      description: `Consulta com Dr. ${metadata.doctorName} em ${new Date(metadata.appointmentDate).toLocaleDateString('pt-BR')}`,
    });

    return paymentIntent;
  } catch (error) {
    console.error('Erro ao criar intenção de pagamento para consulta:', error);
    throw error;
  }
}

/**
 * Captura um pagamento pré-autorizado após a consulta ser realizada
 */
export async function captureConsultationPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  try {
    // Capturar o pagamento
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    
    return paymentIntent;
  } catch (error) {
    console.error('Erro ao capturar pagamento de consulta:', error);
    throw error;
  }
}

/**
 * Cancela um pagamento pré-autorizado caso a consulta seja cancelada
 */
export async function cancelConsultationPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  try {
    // Cancelar a intenção de pagamento
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: 'requested_by_customer'
    });
    
    return paymentIntent;
  } catch (error) {
    console.error('Erro ao cancelar pagamento de consulta:', error);
    throw error;
  }
}

/**
 * Consulta o status de um pagamento
 */
export async function checkPaymentStatus(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    throw error;
  }
}

/**
 * Aplica desconto do plano de assinatura ao preço da consulta
 */
export function calculatePriceWithSubscriptionDiscount(
  basePrice: number,
  subscriptionPlan: string | null | undefined
): { finalPrice: number, discountPercentage: number } {
  let discountPercentage = 0;
  
  if (!subscriptionPlan || subscriptionPlan === 'free') {
    discountPercentage = 0;
  } else if (subscriptionPlan === 'basic' || subscriptionPlan === 'basic_family') {
    discountPercentage = 30;
  } else if (subscriptionPlan === 'premium' || subscriptionPlan === 'premium_family') {
    discountPercentage = 50;
  } else if (subscriptionPlan === 'ultra' || subscriptionPlan === 'ultra_family') {
    discountPercentage = 70;
  }
  
  // Calcula o preço com desconto
  const discount = (basePrice * discountPercentage) / 100;
  const finalPrice = basePrice - discount;
  
  return {
    finalPrice,
    discountPercentage
  };
}

/**
 * Verifica se deve cobrar por uma consulta de emergência com base no plano do usuário
 * @param subscriptionPlan Plano de assinatura do usuário
 * @param emergencyConsultationsLeft Número de consultas de emergência restantes (para plano básico)
 * @returns true se deve cobrar, false se estiver incluído no plano
 */
export function shouldChargeForEmergencyConsultation(
  subscriptionPlan: string | null | undefined,
  emergencyConsultationsLeft: number | null | undefined
): boolean {
  // Planos premium e ultra têm consultas de emergência ilimitadas incluídas
  if (
    subscriptionPlan === 'premium' || 
    subscriptionPlan === 'premium_family' || 
    subscriptionPlan === 'ultra' || 
    subscriptionPlan === 'ultra_family'
  ) {
    return false; // Não cobrar
  }
  
  // Plano básico tem um número limitado de consultas de emergência
  if (
    (subscriptionPlan === 'basic' || subscriptionPlan === 'basic_family') && 
    emergencyConsultationsLeft !== null && 
    emergencyConsultationsLeft !== undefined && 
    emergencyConsultationsLeft > 0
  ) {
    return false; // Não cobrar se ainda tiver consultas disponíveis
  }
  
  // Para todos os outros casos (plano gratuito ou básico sem consultas disponíveis)
  return true; // Cobrar normalmente
}

/**
 * Cria uma sessão de pagamento para assinatura com suporte a métodos brasileiros
 * @param planId ID do plano de assinatura
 * @param customerId ID do cliente no Stripe
 * @param paymentMethod Método de pagamento selecionado (card, pix, boleto)
 * @returns Objeto com clientSecret e dados específicos do método de pagamento
 */
export async function createSubscriptionPaymentSession(
  planId: string,
  customerId: string,
  paymentMethod: 'card' | 'pix' | 'boleto'
): Promise<{
  clientSecret: string;
  paymentMethod: string;
  pixInfo?: any;
  boletoInfo?: any;
}> {
  try {
    // Primeiro, obter informações do plano do banco de dados
    const plan = await storage.getPlanById(Number(planId));
    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    // Configuração base para todos os métodos
    const baseOptions: Stripe.PaymentIntentCreateParams = {
      amount: plan.price,
      currency: 'brl',
      customer: customerId,
      metadata: {
        planId,
        planName: plan.name,
        planType: 'subscription',
      },
      description: `Assinatura do plano ${plan.displayName}`,
    };
    
    // Adicionar configurações específicas para cada método de pagamento
    if (paymentMethod === 'pix') {
      // Configuração específica para PIX
      const paymentIntent = await stripe.paymentIntents.create({
        ...baseOptions,
        payment_method_types: ['pix']
        // Removido payment_method_options que é incompatível com assinaturas
      });
      
      // Formatação da data de expiração
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + brazilianPaymentOptions.pix.expires_in);
      
      // Retornar dados específicos do PIX
      return {
        clientSecret: paymentIntent.client_secret as string,
        paymentMethod: 'pix',
        pixInfo: {
          qrCodeText: paymentIntent.next_action?.pix_display_qr_code?.data || '',
          qrCodeUrl: paymentIntent.next_action?.pix_display_qr_code?.image_url_png || '',
          amount: plan.price / 100,
          expiresAt: expiresAt.toISOString()
        }
      };
    } else if (paymentMethod === 'boleto') {
      // Configuração específica para boleto
      const paymentIntent = await stripe.paymentIntents.create({
        ...baseOptions,
        payment_method_types: ['boleto']
        // Removido payment_method_options que é incompatível com assinaturas
      });
      
      // Formatação da data de expiração
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + brazilianPaymentOptions.boleto.expires_in);
      
      // Retornar dados específicos do boleto
      return {
        clientSecret: paymentIntent.client_secret as string,
        paymentMethod: 'boleto',
        boletoInfo: {
          // Adaptando para os campos corretos da API atual do Stripe
          code: paymentIntent.next_action?.boleto_display_details?.number || '',
          url: paymentIntent.next_action?.boleto_display_details?.hosted_voucher_url || '',
          amount: plan.price / 100,
          expiresAt: expiresAt.toISOString()
        }
      };
    } else {
      // Configuração para cartão de crédito (padrão)
      const paymentIntent = await stripe.paymentIntents.create({
        ...baseOptions,
        payment_method_types: ['card'],
        // Removido setup_future_usage que é incompatível com assinaturas
      });
      
      return {
        clientSecret: paymentIntent.client_secret as string,
        paymentMethod: 'card'
      };
    }
  } catch (error) {
    console.error('Erro ao criar sessão de pagamento para assinatura:', error);
    throw error;
  }
}