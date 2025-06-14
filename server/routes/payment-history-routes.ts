import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { userSubscriptions, appointments, subscriptionPlans, users, doctors } from '../../shared/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';

const paymentHistoryRouter = Router();

/**
 * Obter histórico de pagamentos (assinaturas + consultas)
 * GET /api/payment-history
 */
paymentHistoryRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    console.log(`📊 Buscando histórico de pagamentos para usuário ${req.user.id} - ${req.user.email}`);
    
    // Buscar histórico de assinaturas
    const subscriptionHistory = await db
      .select({
        id: sql`${userSubscriptions.id}::text`.as('id'),
        type: sql`'subscription'`.as('type'),
        description: subscriptionPlans.name,
        amount: userSubscriptions.price,
        status: userSubscriptions.status,
        date: userSubscriptions.createdAt,
        paymentMethod: userSubscriptions.paymentMethod,
        planName: subscriptionPlans.name,
        planInterval: sql`'month'`.as('planInterval')
      })
      .from(userSubscriptions)
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, req.user.id))
      .orderBy(desc(userSubscriptions.createdAt));
    
    console.log(`✅ Encontradas ${subscriptionHistory.length} assinaturas`);

    // Buscar histórico de consultas (appointments)
    const consultationHistory = await db
      .select({
        id: sql`${appointments.id}::text`.as('id'),
        type: sql`'consultation'`.as('type'),
        description: sql`CONCAT('Consulta com Dr(a). ', COALESCE(${users.fullName}, 'Médico'))`.as('description'),
        amount: appointments.paymentAmount,
        status: appointments.paymentStatus,
        date: appointments.createdAt,
        paymentMethod: sql`'credit_card'`.as('paymentMethod'),
        doctorName: users.fullName,
        consultationType: appointments.type
      })
      .from(appointments)
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(
        and(
          eq(appointments.userId, req.user.id),
          or(
            eq(appointments.paymentStatus, 'completed'),
            eq(appointments.paymentStatus, 'paid'),
            eq(appointments.paymentStatus, 'included_in_plan')
          )
        )
      )
      .orderBy(desc(appointments.createdAt));

    console.log(`✅ Encontradas ${consultationHistory.length} consultas`);

    // Combinar e ordenar por data
    const allTransactions = [
      ...subscriptionHistory.map(sub => ({
        id: sub.id,
        type: sub.type as 'subscription',
        description: sub.description || 'Assinatura',
        amount: sub.amount || 0,
        status: sub.status,
        date: sub.date,
        paymentMethod: sub.paymentMethod || 'credit_card',
        details: {
          planName: sub.planName,
          planInterval: sub.planInterval
        }
      })),
      ...consultationHistory.map(consult => ({
        id: consult.id,
        type: consult.type as 'consultation',
        description: consult.description || 'Consulta',
        amount: consult.amount || 0,
        status: mapConsultationStatus(consult.status),
        date: consult.date,
        paymentMethod: consult.paymentMethod as string,
        details: {
          doctorName: consult.doctorName,
          consultationType: consult.consultationType
        }
      }))
    ].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    // Calcular totais
    const totalSpent = allTransactions.reduce((sum, transaction) => {
      if (transaction.status === 'active' || transaction.status === 'paid' || transaction.status === 'completed') {
        return sum + (transaction.amount || 0);
      }
      return sum;
    }, 0);

    console.log(`📈 Total de transações: ${allTransactions.length}`);
    console.log(`💵 Total gasto: R$ ${(totalSpent / 100).toFixed(2)}`);
    
    res.json({
      transactions: allTransactions,
      summary: {
        totalTransactions: allTransactions.length,
        totalSpent,
        subscriptionCount: subscriptionHistory.length,
        consultationCount: consultationHistory.length
      }
    });

  } catch (error) {
    console.error('Erro ao buscar histórico de pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de pagamentos' });
  }
});

// Função auxiliar para mapear status de consulta
function mapConsultationStatus(status: string): string {
  switch (status) {
    case 'completed':
      return 'paid';
    case 'cancelled':
      return 'cancelled';
    case 'in_progress':
      return 'processing';
    default:
      return status;
  }
}

export default paymentHistoryRouter;