import { db } from '../db';
import { subscriptionPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function setupSubscriptionPlans() {
  try {
    // Verificar se já existem planos
    const existingPlans = await db.select().from(subscriptionPlans);
    
    if (existingPlans.length > 0) {
      console.log('Planos de assinatura já existem. Pulando criação inicial.');
      return;
    }
    
    // Criar os planos de assinatura
    const premiumPlan = {
      name: 'premium' as const,
      displayName: 'Premium',
      price: 13900, // R$139,00
      emergencyConsultations: 'unlimited',
      specialistDiscount: 50, // 50%
      insuranceCoverage: true,
      features: [
        'Consultas de emergência ilimitadas',
        'Desconto de 50% com especialistas',
        'Cobertura total do seguro',
        'Prioridade no agendamento',
        'Suporte prioritário 24/7'
      ],
      isDefault: false
    };
    
    await db.insert(subscriptionPlans).values(premiumPlan);
    console.log(`Plano ${premiumPlan.displayName} criado com sucesso!`);
    
    const basicPlan = {
      name: 'basic' as const,
      displayName: 'Básico',
      price: 10000, // R$100,00
      emergencyConsultations: '2',
      specialistDiscount: 30, // 30%
      insuranceCoverage: true,
      features: [
        '2 consultas de emergência por mês',
        'Desconto de 30% com especialistas',
        'Cobertura total do seguro',
        'Suporte 24/7'
      ],
      isDefault: true
    };
    
    await db.insert(subscriptionPlans).values(basicPlan);
    console.log(`Plano ${basicPlan.displayName} criado com sucesso!`);
    
    const freePlan = {
      name: 'free' as const,
      displayName: 'Gratuito',
      price: 0, // R$0,00
      emergencyConsultations: '0',
      specialistDiscount: 0, // 0%
      insuranceCoverage: false,
      features: [
        'Acesso ao marketplace de serviços',
        'Valor integral nas consultas',
        'Sem cobertura de seguro'
      ],
      isDefault: false
    };
    
    await db.insert(subscriptionPlans).values(freePlan);
    console.log(`Plano ${freePlan.displayName} criado com sucesso!`);
    
    console.log('Todos os planos de assinatura foram criados!');
  } catch (error) {
    console.error('Erro ao configurar planos de assinatura:', error);
  }
}