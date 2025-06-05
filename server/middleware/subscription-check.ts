import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptionPlans, users, User } from '@shared/schema';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { ExpressUser } from '../../shared/types';
import { storage } from '../storage';
import { AppError } from '../utils/app-error';

// Estender a interface Request para incluir a propriedade emergencyConsultationToDecrement
declare global {
  namespace Express {
    interface Request {
      emergencyConsultationToDecrement?: boolean;
    }
  }
}

// Verifica se o usuário tem acesso a uma funcionalidade com base no plano de assinatura
export const checkSubscriptionFeature = (requiredFeature: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Se não há usuário autenticado, verificar X-Session-ID
      if (!req.isAuthenticated() || !req.user) {
        // Verificar autenticação por token no header X-Session-ID
        const sessionId = req.headers['x-session-id'] as string;
        
        if (sessionId) {
          try {
            // Formato do token: sessionId:userId:timestamp
            const parts = sessionId.split(':');
            if (parts.length === 3) {
              const userId = parseInt(parts[1]);
              
              // Buscar usuário pelo ID
              const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, userId));
              
              if (user) {
                // Adicionar usuário ao request
                (req as AuthenticatedRequest).user = user;
              } else {
                return res.status(401).json({ message: 'Usuário não autenticado' });
              }
            } else {
              return res.status(401).json({ message: 'Usuário não autenticado' });
            }
          } catch (error) {
            console.error('Erro ao verificar token de autenticação:', error);
            return res.status(401).json({ message: 'Erro de autenticação' });
          }
        } else {
          return res.status(401).json({ message: 'Usuário não autenticado' });
        }
      }
      
      // Verificar se o usuário tem acesso à funcionalidade
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        return res.status(401).json({ message: 'Usuário não autenticado' });
      }
      const userPlan = user.subscriptionPlan || 'free';
      
      // Buscar o plano do usuário
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, userPlan));
      
      if (!plan) {
        return res.status(403).json({ 
          message: 'Plano de assinatura não encontrado',
          requiresUpgrade: true
        });
      }
      
      // Verificar se o plano tem acesso à funcionalidade
      if (!plan.features || !plan.features.includes(requiredFeature)) {
        return res.status(403).json({ 
          message: 'Funcionalidade não disponível no seu plano',
          requiresUpgrade: true,
          currentPlan: userPlan
        });
      }
      
      next();
    } catch (error) {
      console.error('Erro ao verificar acesso à funcionalidade:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };
};

// Verifica se o plano do usuário tem limite de consultas de emergência
export const checkEmergencyConsultationLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Log para debug
    console.log("Middleware checkEmergencyConsultationLimit - req.isAuthenticated:", req.isAuthenticated());
    console.log("Middleware checkEmergencyConsultationLimit - req.user:", req.user);
    console.log("Middleware checkEmergencyConsultationLimit - req.headers:", req.headers);
    
    if (!req.user) {
      console.log("Usuário não autenticado no middleware");
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const userPlan = req.user.subscriptionPlan || 'free';
    const userSubscriptionStatus = req.user.subscriptionStatus || 'inactive';

    // Verificar se a assinatura está ativa
    if (userSubscriptionStatus !== 'active' && userPlan !== 'free') {
      return res.status(403).json({ 
        message: 'Sua assinatura não está ativa',
        requiresUpgrade: true
      });
    }

    // Buscar informações do plano no banco de dados
    const [planInfo] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, userPlan));

    if (!planInfo) {
      return res.status(403).json({ 
        message: 'Informações do plano não encontradas',
        requiresUpgrade: true
      });
    }

    // Verificar se o plano tem consultas ilimitadas (premium)
    if (planInfo.emergencyConsultations === 'unlimited') {
      return next();
    }

    // Verificar se o plano gratuito tem acesso
    if (userPlan === 'free' && planInfo.emergencyConsultations === '0') {
      return res.status(403).json({
        message: 'Seu plano não permite consultas de emergência',
        requiresUpgrade: true,
        currentPlan: userPlan
      });
    }

    // Verificar se é uma consulta de emergência
    const isEmergency = req.body?.isEmergency === true;
    
    // Se não for uma consulta de emergência, permitir normalmente
    if (!isEmergency) {
      return next();
    }
    
    // Para planos com limite de consultas (ex: basic), verificar o contador
    if (userPlan === 'basic') {
      const emergencyConsultationsLeft = req.user.emergencyConsultationsLeft || 0;
      
      if (emergencyConsultationsLeft <= 0) {
        return res.status(403).json({
          message: 'Você já utilizou todas as suas consultas de emergência disponíveis neste mês',
          requiresUpgrade: true,
          currentPlan: userPlan
        });
      }
      
      // Decrementar o contador de consultas ao confirmar o agendamento
      try {
        // Usamos req.user.id aqui para evitar erro de undefined
        const userId = req.user.id;
        
        // Armazenar para usar no middleware após a consulta ser criada
        req.emergencyConsultationToDecrement = true;
        
        console.log(`Consulta de emergência para usuário ${userId} com plano ${userPlan}. Consultas restantes: ${emergencyConsultationsLeft-1}`);
      } catch (error) {
        console.error('Erro ao decrementar consultas de emergência:', error);
      }
    }
    
    return next();
  } catch (error) {
    console.error('Erro ao verificar limite de consultas de emergência:', error);
    return res.status(500).json({ message: 'Erro ao verificar limite de consultas' });
  }
};

export const checkSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError(401, 'Usuário não autenticado');
    }

    const userPlan = req.user.subscriptionPlan || 'free';
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, userPlan));

    if (!plan) {
      throw new AppError(400, 'Plano de assinatura inválido');
    }

    if (!plan.features) {
      throw new AppError(400, 'Plano sem recursos definidos');
    }

    // Adiciona informações do plano à requisição
    (req as AuthenticatedRequest & { subscription: typeof plan }).subscription = plan;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Não autorizado', 401);
  }

  const subscription = await storage.getActiveSubscription(req.user.id);
  if (!subscription) {
    throw new AppError('Assinatura inativa ou inexistente', 403);
  }

  next();
};