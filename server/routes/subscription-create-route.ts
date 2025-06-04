import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users, subscriptionPlans } from '../../shared/schema';
import stripe from '../utils/stripe-instance.js';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { User } from '../../shared/schema';
import { AppError } from '../utils/app-error';

const subscriptionCreateRouter = Router();

// Middleware para verificar autenticação (compatível com tokens e sessões)
const isAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("Verificando autenticação na rota de assinatura...");
  
  // Verificar se o usuário está autenticado por sessão
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log("Autenticado via sessão:", req.user?.id, req.user?.email);
    return next();
  }
  
  // Se não estiver autenticado por sessão, verificar se tem o campo 'user' definido pelo middleware de token
  if (req.user) {
    console.log("Autenticado via token:", req.user.id, req.user.email);
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
          req.user = user;
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
subscriptionCreateRouter.post("/create-session", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validar a entrada
    const schema = z.object({
      planId: z.number(),
      paymentMethod: z.enum(['card', 'pix', 'boleto'])
    });

    const validationResult = schema.safeParse({
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
    const user = req.user;
    
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
    } else if (paymentMethod === 'boleto') {
      try {
        // Configurações específicas para o Boleto brasileiro
        console.log("Criando pagamento com Boleto...");
        
        // Criar um método de pagamento para Boleto primeiro
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'boleto',
          billing_details: {
            name: user.fullName || user.username,
            email: user.email,
            address: {
              country: 'BR',
            }
          },
          boleto: {
            tax_id: user.cpf?.replace(/[^\d]/g, '') || '00000000000'
          }
        });
        
        console.log("Método de pagamento Boleto criado:", paymentMethod.id);
        
        // Criar o Payment Intent com o método de pagamento específico
        paymentIntent = await stripe.paymentIntents.create({
          ...baseOptions,
          payment_method: paymentMethod.id,
          payment_method_types: ['boleto'],
          description: `Assinatura plano ${plan.name} via Boleto`,
          payment_method_options: {
            boleto: {
              expires_after_days: 3
            }
          },
          confirm: true // Confirmar automaticamente para gerar o boleto
        });
        
        console.log("Payment Intent com Boleto criado e confirmado:", paymentIntent.id);
        
        // Boleto expira em 3 dias
        expiresAt.setDate(expiresAt.getDate() + 3);
        
        // Atualizar o status de assinatura como pendente
        await db.update(users)
          .set({
            subscriptionPlan: plan.name,
            subscriptionStatus: 'pending'
          })
          .where(eq(users.id, user.id));
        
        // Recuperar informações do boleto gerado
        const boletoDetails = paymentIntent.payment_method_details?.boleto;
        
        return res.json({
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          paymentMethod: 'boleto',
          boletoUrl: boletoDetails?.hosted_voucher_url,
          boletoPdf: boletoDetails?.pdf,
          boletoBarcode: boletoDetails?.barcode,
          expiresAt: expiresAt.toISOString(),
          message: "Boleto gerado com sucesso"
        });
      } catch (boletoError) {
        console.error("Erro ao criar pagamento com Boleto:", boletoError);
        
        // Tentar com cartão como método alternativo
        paymentIntent = await stripe.paymentIntents.create({
          ...baseOptions,
          payment_method_types: ['card'],
          description: `Assinatura plano ${plan.name} (fallback de Boleto)`
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
          message: "O método Boleto não está disponível. Foi selecionado cartão de crédito como alternativa."
        });
      }
    } else {
      // Pagamento com cartão
      paymentIntent = await stripe.paymentIntents.create({
        ...baseOptions,
        payment_method_types: ['card'],
        description: `Assinatura plano ${plan.name}`
      });
      
      // Atualizar o status de assinatura como pendente
      await db.update(users)
        .set({
          subscriptionPlan: plan.name,
          subscriptionStatus: 'pending'
        })
        .where(eq(users.id, user.id));
      
      return res.json({
        clientSecret: paymentIntent.client_secret,
        paymentMethod: 'card'
      });
    }
  } catch (error) {
    console.error("Erro ao criar sessão de pagamento:", error);
    res.status(500).json({ 
      message: "Erro ao processar pagamento",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Endpoint para confirmar pagamento
subscriptionCreateRouter.post("/confirm-payment", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validar a entrada
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
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    
    // Verificar status do pagamento
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Obter o plano da assinatura dos metadados
      const planId = paymentIntent.metadata?.planId;
      if (!planId) {
        return res.status(400).json({ message: "ID do plano não encontrado nos metadados do pagamento" });
      }
      
      // Buscar o plano no banco de dados
      const planIdNum = parseInt(planId, 10);
      if (isNaN(planIdNum)) return res.status(400).json({ message: "ID do plano inválido" });
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planIdNum));
      if (!plan) {
        return res.status(404).json({ message: "Plano não encontrado" });
      }
      
      // Definir o número de consultas de emergência
      let emergencyConsultations = null;
      if (plan.emergencyConsultations !== 'unlimited') {
        emergencyConsultations = parseInt(plan.emergencyConsultations);
      }
      
      // Atualizar assinatura para ativa
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
    } else {
      return res.json({
        success: false,
        message: "Pagamento ainda não confirmado",
        status: paymentIntent.status
      });
    }
  } catch (error: any) {
    console.error("Erro ao confirmar pagamento:", error);
    return res.status(500).json({ 
      message: `Erro ao confirmar pagamento: ${error.message}`
    });
  }
});

// Criar nova subscrição
subscriptionCreateRouter.post('/create', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planId, paymentMethod } = req.body;
    
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar usuário
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id)
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Buscar plano
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId)
    });

    if (!plan) {
      throw new AppError('Plano não encontrado', 404);
    }

    // Criar subscrição
    const subscription = await db.insert(subscriptionPlans).values({
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
subscriptionCreateRouter.put('/update/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { planId, status } = req.body;

    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar subscrição
    const subscription = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, parseInt(id))
    });

    if (!subscription) {
      throw new AppError('Subscrição não encontrada', 404);
    }

    // Verificar se o usuário é o dono da subscrição ou admin
    if (subscription.userId !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('Não autorizado', 403);
    }

    // Atualizar subscrição
    const updated = await db.update(subscriptionPlans)
      .set({
        planId: planId || subscription.planId,
        status: status || subscription.status,
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlans.id, parseInt(id)))
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
subscriptionCreateRouter.delete('/cancel/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar subscrição
    const subscription = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, parseInt(id))
    });

    if (!subscription) {
      throw new AppError('Subscrição não encontrada', 404);
    }

    // Verificar se o usuário é o dono da subscrição ou admin
    if (subscription.userId !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('Não autorizado', 403);
    }

    // Cancelar subscrição
    const updated = await db.update(subscriptionPlans)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlans.id, parseInt(id)))
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

export default subscriptionCreateRouter;