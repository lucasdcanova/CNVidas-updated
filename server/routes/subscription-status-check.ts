import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '../../shared/schema';
import stripe from '../utils/stripe-instance.js';
import { AuthenticatedRequest } from '../types/authenticated-request';

const router = Router();

// Middleware para verificar e atualizar status de assinatura pendente
router.post('/check-pending-payment', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // Verificar se o usuário tem status pendente
    const [userRecord] = await db.select().from(users).where(eq(users.id, user.id));
    
    if (!userRecord || userRecord.subscriptionStatus !== 'pending') {
      return res.json({ 
        message: "Nenhuma assinatura pendente",
        status: userRecord?.subscriptionStatus || 'inactive'
      });
    }

    // Se tem customer ID do Stripe, verificar pagamentos recentes
    if (userRecord.stripeCustomerId) {
      try {
        // Buscar pagamentos recentes do cliente
        const paymentIntents = await stripe.paymentIntents.list({
          customer: userRecord.stripeCustomerId,
          limit: 5,
          expand: ['data.latest_charge']
        });

        // Verificar se há algum pagamento bem-sucedido nos últimos 30 minutos
        const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - (30 * 60);
        
        for (const paymentIntent of paymentIntents.data) {
          if (paymentIntent.status === 'succeeded' && 
              paymentIntent.created > thirtyMinutesAgo &&
              paymentIntent.metadata.planName) {
            
            console.log(`✅ Pagamento bem-sucedido encontrado para ${user.email}: ${paymentIntent.id}`);
            
            // Atualizar o status da assinatura para ativo
            await db.update(users)
              .set({
                subscriptionStatus: 'active',
                emergencyConsultationsLeft: 3, // Número padrão de consultas
                updatedAt: new Date()
              })
              .where(eq(users.id, user.id));

            return res.json({
              message: "Assinatura ativada com sucesso",
              status: 'active',
              paymentIntentId: paymentIntent.id
            });
          }
        }
      } catch (stripeError) {
        console.error('Erro ao verificar pagamentos no Stripe:', stripeError);
      }
    }

    return res.json({ 
      message: "Pagamento ainda não confirmado",
      status: 'pending'
    });

  } catch (error) {
    console.error("Erro ao verificar status de pagamento:", error);
    return res.status(500).json({
      message: "Erro ao verificar status de pagamento",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

export default router;