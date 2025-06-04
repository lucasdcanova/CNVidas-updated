/**
 * Utilitário para cálculo de descontos baseados no plano de assinatura
 */

/**
 * Calcula o preço com desconto para consultas agendadas baseado no plano de assinatura do usuário
 * 
 * @param basePrice - Preço base da consulta
 * @param subscriptionPlan - Plano de assinatura do usuário
 * @returns Objeto com valor com desconto e informações sobre o desconto
 */
export function calculateConsultationPriceWithDiscount(
  basePrice: number, 
  subscriptionPlan?: string
) {
  let finalPrice = basePrice;
  let discountPercentage = 0;
  let discountAmount = 0;
  
  // Verificar planos Ultra (70% de desconto)
  if (subscriptionPlan?.includes('ultra')) {
    discountPercentage = 70;
    finalPrice = basePrice * 0.3; // 70% de desconto
  } 
  // Verificar planos Premium (50% de desconto)
  else if (subscriptionPlan?.includes('premium')) {
    discountPercentage = 50;
    finalPrice = basePrice * 0.5; // 50% de desconto
  } 
  // Verificar planos Basic (30% de desconto)
  else if (subscriptionPlan?.includes('basic')) {
    discountPercentage = 30;
    finalPrice = basePrice * 0.7; // 30% de desconto
  }
  
  // Calcular o valor do desconto
  discountAmount = basePrice - finalPrice;
  
  return {
    originalPrice: basePrice,
    finalPrice,
    discountPercentage,
    discountAmount,
    hasDiscount: discountPercentage > 0
  };
}

/**
 * Formata o nome do plano para exibição ao usuário
 * 
 * @param subscriptionPlan - Código do plano de assinatura
 * @returns Nome formatado do plano para exibição
 */
export function formatPlanName(subscriptionPlan?: string): string {
  if (!subscriptionPlan) return 'Gratuito';
  
  if (subscriptionPlan.includes('ultra')) {
    return subscriptionPlan.includes('family') ? 'Ultra Família' : 'Ultra';
  } else if (subscriptionPlan.includes('premium')) {
    return subscriptionPlan.includes('family') ? 'Premium Família' : 'Premium';
  } else if (subscriptionPlan.includes('basic')) {
    return subscriptionPlan.includes('family') ? 'Basic Família' : 'Basic';
  } else {
    return 'Gratuito';
  }
}