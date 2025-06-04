import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users, subscriptionPlans } from '@shared/schema';
import { storage } from '../storage.js';
import { createSubscriptionPaymentSession } from '../utils/stripe-payment.js';
import stripe from '../utils/stripe-instance.js';
import { isAuthenticated } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { AppError } from '../utils/app-error';

const subscriptionPaymentRouter = Router();

// Middleware de autenticação compatível com Express
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Middleware de tratamento de erros
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message });
  }
};

// Rota para criar uma sessão de pagamento para assinatura com métodos brasileiros
subscriptionPaymentRouter.post("/create-session", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const schema = z.object({
      planId: z.string().min(1, "ID do plano é obrigatório"),
      paymentMethod: z.enum(['card', 'pix', 'boleto'])
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Parâmetros inválidos", 
        errors: validationResult.error.format() 
      });
    }

    const { planId, paymentMethod } = validationResult.data;
    const user = authReq.user!;
    
    // Buscar o plano de assinatura pelo ID
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, parseInt(planId)));
    
    if (!plan) {
      return res.status(404).json({ message: "Plano não encontrado" });
    }
    
    // Se o plano for gratuito, não precisamos processar o pagamento
    if (plan.price === 0) {
      // Para o plano gratuito, definimos 0 consultas de emergência
      await db.update(users)
        .set({
          subscriptionPlan: plan.name,
          subscriptionStatus: 'active',
          emergencyConsultationsLeft: 0
        })
        .where(eq(users.id, user.id));
      
      return res.json({
        message: "Plano gratuito ativado com sucesso",
        subscription: {
          planId: plan.id,
          planType: plan.name,
          status: 'active'
        }
      });
    }
    
    // Verificar se o usuário já tem um customer ID no Stripe
    let customerId = user.stripeCustomerId;
    
    // Criar customer no Stripe se ainda não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: {
          userId: user.id.toString()
        }
      });
      
      customerId = customer.id;
      
      // Atualizar o ID do cliente no banco de dados
      await db.update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }
    
    // Criar a sessão de pagamento com base no método selecionado
    const paymentSession = await createSubscriptionPaymentSession(
      planId.toString(),
      customerId,
      paymentMethod
    );
    
    // Atualizar o status de assinatura do usuário para 'pending'
    await db.update(users)
      .set({
        subscriptionPlan: plan.name,
        subscriptionStatus: 'pending'
      })
      .where(eq(users.id, user.id));
    
    // Retornar a resposta com os dados específicos do método de pagamento
    return res.json(paymentSession);
    
  } catch (error: any) {
    console.error("Erro ao criar sessão de pagamento para assinatura:", error);
    return res.status(500).json({ 
      message: `Erro ao processar pagamento: ${error.message}`,
      error: error.toString()
    });
  }
});

// Rota para verificar e confirmar pagamento de assinatura
subscriptionPaymentRouter.post("/confirm-payment", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const schema = z.object({
      paymentIntentId: z.string().min(1, "ID da intenção de pagamento é obrigatório")
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Parâmetros inválidos", 
        errors: validationResult.error.format() 
      });
    }

    const { paymentIntentId } = validationResult.data;
    const user = authReq.user!;
    
    // Verificar o status do pagamento no Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Obter o plano da assinatura dos metadados
      const planId = paymentIntent.metadata?.planId;
      if (!planId) {
        return res.status(400).json({ message: "ID do plano não encontrado nos metadados do pagamento" });
      }
      
      // Buscar o plano no banco de dados
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, parseInt(planId)));
      if (!plan) {
        return res.status(404).json({ message: "Plano não encontrado" });
      }
      
      // Definir o número de consultas de emergência com base no plano
      let emergencyConsultations = null;
      if (plan.emergencyConsultations !== 'unlimited') {
        emergencyConsultations = parseInt(plan.emergencyConsultations);
      }
      
      // Atualizar o status de assinatura do usuário para 'active'
      await db.update(users)
        .set({
          subscriptionPlan: plan.name,
          subscriptionStatus: 'active',
          emergencyConsultationsLeft: emergencyConsultations
        })
        .where(eq(users.id, user.id));
      
      return res.json({
        success: true,
        message: "Assinatura ativada com sucesso",
        subscription: {
          planId: plan.id,
          planType: plan.name,
          status: 'active'
        }
      });
    } else if (paymentIntent.status === 'processing') {
      return res.json({
        success: false,
        message: "Pagamento ainda está sendo processado",
        status: paymentIntent.status
      });
    } else {
      return res.json({
        success: false,
        message: "Pagamento não foi concluído",
        status: paymentIntent.status
      });
    }
  } catch (error: any) {
    console.error("Erro ao confirmar pagamento de assinatura:", error);
    return res.status(500).json({ 
      message: `Erro ao confirmar pagamento: ${error.message}`,
      error: error.toString()
    });
  }
});

// Rota para atualizar o método de pagamento padrão do usuário
subscriptionPaymentRouter.post("/update-payment-method", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const schema = z.object({
      paymentMethodId: z.string().min(1, "ID do método de pagamento é obrigatório")
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Parâmetros inválidos", 
        errors: validationResult.error.format() 
      });
    }

    const { paymentMethodId } = validationResult.data;
    const user = authReq.user!;

    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        message: "Usuário não possui cadastro no sistema de pagamento" 
      });
    }

    // Atualizar o método de pagamento padrão no Stripe
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Se o usuário tiver uma assinatura ativa, atualizar o método de pagamento da assinatura
    if (user.stripeSubscriptionId) {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        default_payment_method: paymentMethodId
      });
    }

    return res.json({
      success: true,
      message: "Método de pagamento atualizado com sucesso"
    });

  } catch (error: any) {
    console.error("Erro ao atualizar método de pagamento:", error);
    return res.status(500).json({ 
      message: `Erro ao atualizar método de pagamento: ${error.message}`,
      error: error.toString()
    });
  }
});

// Rota para listar os métodos de pagamento do usuário
subscriptionPaymentRouter.get("/payment-methods", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const user = authReq.user!;

    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        message: "Usuário não possui cadastro no sistema de pagamento" 
      });
    }

    // Buscar todos os métodos de pagamento do cliente no Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card'
    });

    return res.json({
      success: true,
      paymentMethods: paymentMethods.data
    });

  } catch (error: any) {
    console.error("Erro ao listar métodos de pagamento:", error);
    return res.status(500).json({ 
      message: `Erro ao listar métodos de pagamento: ${error.message}`,
      error: error.toString()
    });
  }
});

// Rota para remover um método de pagamento
subscriptionPaymentRouter.delete("/payment-methods/:id", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const { id } = req.params;
    const user = authReq.user!;

    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        message: "Usuário não possui cadastro no sistema de pagamento" 
      });
    }

    // Verificar se o método de pagamento pertence ao usuário
    const paymentMethod = await stripe.paymentMethods.retrieve(id);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      return res.status(403).json({ 
        message: "Método de pagamento não pertence ao usuário" 
      });
    }

    // Desanexar o método de pagamento do cliente
    await stripe.paymentMethods.detach(id);

    return res.json({
      success: true,
      message: "Método de pagamento removido com sucesso"
    });

  } catch (error: any) {
    console.error("Erro ao remover método de pagamento:", error);
    return res.status(500).json({ 
      message: `Erro ao remover método de pagamento: ${error.message}`,
      error: error.toString()
    });
  }
});

// Rota para criar uma intenção de configuração do Stripe
subscriptionPaymentRouter.post("/create-setup-intent", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const user = authReq.user!;

    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        message: "Usuário não possui cadastro no sistema de pagamento" 
      });
    }

    // Criar uma intenção de configuração no Stripe
    const setupIntent = await stripe.setupIntents.create({
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });

    return res.json({
      success: true,
      clientSecret: setupIntent.client_secret
    });

  } catch (error: any) {
    console.error("Erro ao criar intenção de configuração:", error);
    return res.status(500).json({ 
      message: `Erro ao criar intenção de configuração: ${error.message}`,
      error: error.toString()
    });
  }
});

export default subscriptionPaymentRouter;