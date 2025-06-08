import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { users, subscriptionPlans, userSubscriptions } from '../../shared/schema';
import stripe from '../utils/stripe-instance.js';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';
import { AuthenticatedRequest } from '../types/authenticated-request';

const router = Router();

// Schema de validação para parâmetros de rota
const routeParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10))
});

// Schema de validação para criação de sessão
const createSessionSchema = z.object({
  planId: z.number(),
  paymentMethod: z.enum(['card', 'pix', 'boleto'])
});

// Middleware para verificar autenticação (compatível com tokens e sessões)
const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  console.log("Verificando autenticação na rota de assinatura...");
  
  // Verificar se o usuário está autenticado por sessão
  if (authReq.isAuthenticated && authReq.isAuthenticated()) {
    console.log("Autenticado via sessão:", authReq.user?.id, authReq.user?.email);
    return next();
  }
  
  // Se não estiver autenticado por sessão, verificar se tem o campo 'user' definido pelo middleware de token
  if (authReq.user) {
    console.log("Autenticado via token:", authReq.user.id, authReq.user.email);
    return next();
  }
  
  // Verificar manualmente se existe um token nos headers
  const authToken = req.headers['x-auth-token'] as string || 
                   (req.headers.authorization?.startsWith('Bearer ') 
                    ? req.headers.authorization.substring(7) 
                    : null);
  
  if (authToken) {
    console.log("Token encontrado nos headers:", authToken.substring(0, 15) + "...");
    
    try {
      const [sessionID, userId, timestamp] = authToken.split(':');
      
      if (sessionID && userId) {
        // Recuperar o usuário do banco de dados
        const [user] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
        
        if (user) {
          console.log("Usuário recuperado via token nos headers:", user.id, user.email);
          
          // Definir o usuário na requisição
          authReq.user = user;
          return next();
        }
      }
    } catch (error) {
      console.error("Erro ao processar token:", error);
    }
  }
  
  // Se chegou aqui, não está autenticado
  res.status(401).json({ message: "Não autorizado" });
};

// Rota para criar uma sessão de checkout simples
router.post("/create-session", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Validar a entrada
    const validationResult = createSessionSchema.safeParse({
      ...req.body,
      planId: Number(req.body.planId)
    });

    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Parâmetros inválidos", 
        errors: validationResult.error.format() 
      });
    }

    const { planId, paymentMethod } = validationResult.data;
    const user = authReq.user;
    
    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    
    // Buscar o plano de assinatura pelo ID
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    
    if (!plan) {
      return res.status(404).json({ message: "Plano não encontrado" });
    }
    
    // Se o plano for gratuito, ativamos sem processar pagamento
    if (plan.price === 0) {
      // Atualizar o usuário com o plano gratuito
      await db.update(users)
        .set({
          subscriptionPlan: plan.name,
          subscriptionStatus: 'active',
          emergencyConsultationsLeft: 0
        })
        .where(eq(users.id, user.id));
      
      return res.json({
        message: "Plano gratuito ativado com sucesso",
        planId: plan.id,
        planType: plan.name,
        status: 'active'
      });
    }
    
    // Verificar se o usuário já tem um customer ID no Stripe
    let customerId = user.stripeCustomerId;
    
    // Criar customer no Stripe se ainda não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || user.username,
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
    
    // Configuração básica para Payment Intent
    const baseOptions = {
      amount: plan.price, // Preço em centavos
      currency: 'brl',
      customer: customerId,
      metadata: {
        planId: plan.id.toString(),
        planName: plan.name,
        userId: user.id.toString()
      }
    };
    
    // Criar Payment Intent baseado no método de pagamento
    let paymentIntent;
    let expiresAt = new Date();
    
    if (paymentMethod === 'pix') {
      try {
        // Verificar primeiro se o método PIX está disponível
        // Alternativa: usar cartão como fallback
        paymentIntent = await stripe.paymentIntents.create({
          ...baseOptions,
          payment_method_types: ['card'], // Usar 'card' como método base que todos os países aceitam
          description: `Assinatura plano ${plan.name} (tentativa PIX)`
        });
        
        // Atualizar o status de assinatura como pendente
        await db.update(users)
          .set({
            subscriptionPlan: plan.name,
            subscriptionStatus: 'pending'
          })
          .where(eq(users.id, user.id));
        
        console.log("Usando cartão como método alternativo ao PIX devido a limitações do Stripe");
        
        // Informar o cliente que está sendo usado cartão em vez de PIX
        return res.json({
          clientSecret: paymentIntent.client_secret,
          paymentMethod: 'card',
          message: "O método PIX não está disponível no momento. Por favor, use cartão de crédito."
        });
      } catch (pixError) {
        console.error("Erro ao criar pagamento PIX, tentando alternativa:", pixError);
        
        // Tentar com cartão como método alternativo
        paymentIntent = await stripe.paymentIntents.create({
          ...baseOptions,
          payment_method_types: ['card'],
          description: `Assinatura plano ${plan.name} (fallback de PIX)`
        });
        
        // Atualizar status no banco
        await db.update(users)
          .set({
            subscriptionPlan: plan.name,
            subscriptionStatus: 'pending'
          })
          .where(eq(users.id, user.id));
        
        return res.json({
          clientSecret: paymentIntent.client_secret,
          paymentMethod: 'card',
          message: "O método PIX não está disponível. Foi selecionado cartão de crédito como alternativa."
        });
      }
    } else {
      // Para cartão e boleto
      paymentIntent = await stripe.paymentIntents.create({
        ...baseOptions,
        payment_method_types: [paymentMethod],
        description: `Assinatura plano ${plan.name}`
      });
      
      // Atualizar status no banco
      await db.update(users)
        .set({
          subscriptionPlan: plan.name,
          subscriptionStatus: 'pending'
        })
        .where(eq(users.id, user.id));
      
      return res.json({
        clientSecret: paymentIntent.client_secret,
        paymentMethod,
        message: "Sessão de pagamento criada com sucesso"
      });
    }
  } catch (error) {
    console.error("Erro ao criar sessão de pagamento:", error);
    return res.status(500).json({ 
      message: "Erro ao processar pagamento",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Rota para confirmar pagamento
router.post("/confirm-payment", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { paymentIntentId } = req.body;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    if (!paymentIntentId) {
      return res.status(400).json({ message: "ID do pagamento não fornecido" });
    }

    // Recuperar o Payment Intent do Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verificar se o pagamento foi bem sucedido
    if (paymentIntent.status === 'succeeded') {
      // Atualizar o status da assinatura
      await db.update(users)
        .set({
          subscriptionStatus: 'active',
          emergencyConsultationsLeft: 3 // Número padrão de consultas de emergência
        })
        .where(eq(users.id, user.id));

      return res.json({
        message: "Pagamento confirmado com sucesso",
        status: 'active'
      });
    } else {
      return res.status(400).json({
        message: "Pagamento ainda não foi confirmado",
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);
    return res.status(500).json({
      message: "Erro ao confirmar pagamento",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Rota para cancelar assinatura
router.post("/cancel", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // Atualizar o status da assinatura para cancelado
    await db.update(users)
      .set({
        subscriptionStatus: 'cancelled',
        subscriptionPlan: 'free'
      })
      .where(eq(users.id, user.id));

    return res.json({
      message: "Assinatura cancelada com sucesso",
      status: 'cancelled'
    });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return res.status(500).json({
      message: "Erro ao cancelar assinatura",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Rota para atualizar assinatura
router.put("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // Validar o ID da assinatura
    const validationResult = routeParamsSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "ID de assinatura inválido",
        errors: validationResult.error.format()
      });
    }

    const subscriptionId = toNumberOrThrow(validationResult.data.id);

    // Buscar a assinatura
    const [subscription] = await db.select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, subscriptionId));

    if (!subscription) {
      return res.status(404).json({ message: "Assinatura não encontrada" });
    }

    // Verificar se a assinatura pertence ao usuário
    if (subscription.userId !== user.id) {
      return res.status(403).json({ message: "Não autorizado a atualizar esta assinatura" });
    }

    // Atualizar a assinatura
    await db.update(userSubscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(userSubscriptions.id, subscriptionId));

    return res.json({
      message: "Assinatura atualizada com sucesso",
      status: 'cancelled'
    });
  } catch (error) {
    console.error("Erro ao atualizar assinatura:", error);
    return res.status(500).json({
      message: "Erro ao atualizar assinatura",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Rota para obter detalhes da assinatura
router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // Validar o ID da assinatura
    const validationResult = routeParamsSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "ID de assinatura inválido",
        errors: validationResult.error.format()
      });
    }

    const subscriptionId = Number(validationResult.data.id);

    // Buscar a assinatura com detalhes do plano
    const [subscription] = await db.select({
      subscription: userSubscriptions,
      plan: subscriptionPlans
    })
    .from(userSubscriptions)
    .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(eq(userSubscriptions.id, subscriptionId));

    if (!subscription) {
      return res.status(404).json({ message: "Assinatura não encontrada" });
    }

    // Verificar se a assinatura pertence ao usuário
    if (subscription.subscription.userId !== user.id) {
      return res.status(403).json({ message: "Não autorizado a visualizar esta assinatura" });
    }

    return res.json({
      subscription: {
        ...subscription.subscription,
        plan: subscription.plan
      }
    });
  } catch (error) {
    console.error("Erro ao obter detalhes da assinatura:", error);
    return res.status(500).json({
      message: "Erro ao obter detalhes da assinatura",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Criar nova subscrição
router.post('/create', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { planId, paymentMethod } = req.body;
    
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar usuário
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(authReq.user.id))
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Buscar plano
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, Number(planId))
    });

    if (!plan) {
      throw new AppError('Plano não encontrado', 404);
    }

    // Criar subscrição
    const subscription = await db.insert(userSubscriptions).values({
      userId: user.id,
      planId: plan.id,
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      paymentMethod,
      price: plan.price
    }).returning();

    res.json({
      success: true,
      subscription: subscription[0]
    });

  } catch (error) {
    console.error('Erro ao criar subscrição:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao criar subscrição'
    });
  }
});

// Atualizar subscrição
router.put('/update/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { planId, status } = req.body;

    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar subscrição
    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.id, Number(id))
    });

    if (!subscription) {
      throw new AppError('Subscrição não encontrada', 404);
    }

    // Verificar se o usuário é o dono da subscrição ou admin
    if (subscription.userId !== authReq.user.id && authReq.user.role !== 'admin') {
      throw new AppError('Não autorizado', 403);
    }

    // Atualizar subscrição
    const updated = await db.update(userSubscriptions)
      .set({
        planId: planId ? Number(planId) : subscription.planId,
        status: status || subscription.status,
        updatedAt: new Date()
      })
      .where(eq(userSubscriptions.id, Number(id)))
      .returning();

    res.json({
      success: true,
      subscription: updated[0]
    });

  } catch (error) {
    console.error('Erro ao atualizar subscrição:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao atualizar subscrição'
    });
  }
});

// Cancelar subscrição
router.delete('/cancel/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar subscrição
    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.id, Number(id))
    });

    if (!subscription) {
      throw new AppError('Subscrição não encontrada', 404);
    }

    // Verificar se o usuário é o dono da subscrição ou admin
    if (subscription.userId !== authReq.user.id && authReq.user.role !== 'admin') {
      throw new AppError('Não autorizado', 403);
    }

    // Cancelar subscrição
    const updated = await db.update(userSubscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(userSubscriptions.id, Number(id)))
      .returning();

    res.json({
      success: true,
      subscription: updated[0]
    });

  } catch (error) {
    console.error('Erro ao cancelar subscrição:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao cancelar subscrição'
    });
  }
});

// Rota para buscar planos de assinatura disponíveis (pública)
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plansData = await db.select().from(subscriptionPlans);
    console.log('Retornando planos de assinatura para usuário:', plansData);
    res.json(plansData);
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    res.status(500).json({ error: 'Erro ao buscar planos de assinatura' });
  }
});

// Rota removida - usar /api/subscription/current do public-subscription-routes.ts

export default router;