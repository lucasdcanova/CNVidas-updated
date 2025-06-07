import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/express";
import { storage } from "../storage";

interface PlanRequirement {
  allowedPlans: string[];
  redirectPath: string;
  message: string;
}

/**
 * Middleware que verifica se o usuário tem um plano adequado para acessar determinadas funcionalidades
 * @param requirements - Requisitos de plano para acessar a rota
 */
export const requirePlan = (requirements: PlanRequirement) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Verifica se o usuário está autenticado
      if (!req.user) {
        return res.status(401).json({ 
          message: "Usuário não autenticado",
          requiresAuth: true
        });
      }

      // Obtém o plano do usuário
      const userPlan = req.user.subscriptionPlan || 'free';
      
      // Verifica se o plano do usuário está entre os permitidos
      if (requirements.allowedPlans.includes(userPlan)) {
        return next();
      }

      // Se o plano do usuário não for permitido, retorna erro
      return res.status(403).json({
        message: requirements.message,
        requiresUpgrade: true,
        currentPlan: userPlan,
        redirectPath: requirements.redirectPath
      });
    } catch (error) {
      console.error("Erro ao verificar plano do usuário:", error);
      return res.status(500).json({ message: "Erro ao verificar permissões de plano" });
    }
  };
};

/**
 * Verifica se o usuário tem consultas de emergência disponíveis
 */
export const checkEmergencyConsultationAvailability = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const userPlan = req.user.subscriptionPlan || 'free';
    
    // Se for plano premium ou ultra, sempre tem consultas ilimitadas
    if (userPlan === 'premium' || userPlan === 'ultra' || 
        userPlan === 'premium_family' || userPlan === 'ultra_family') {
      return next();
    }
    
    // Se for plano básico, verifica a quantidade disponível
    if (userPlan === 'basic' || userPlan === 'basic_family') {
      const consultationsLeft = req.user.emergencyConsultationsLeft;
      
      // Se o usuário não tiver consultas disponíveis
      if (consultationsLeft !== null && consultationsLeft !== undefined && consultationsLeft <= 0) {
        return res.status(403).json({
          message: "Você atingiu o limite de consultas de emergência deste mês. Considere fazer um upgrade para planos superiores com consultas ilimitadas.",
          requiresUpgrade: true,
          currentPlan: userPlan,
          redirectPath: "/subscription"
        });
      }
      
      // Se tiver consultas disponíveis, continua
      return next();
    }
    
    // Se for plano gratuito, não tem direito a consultas de emergência
    return res.status(403).json({
      message: "Planos gratuitos não têm acesso a consultas de emergência. Faça upgrade para um plano pago.",
      requiresUpgrade: true,
      currentPlan: userPlan,
      redirectPath: "/subscription"
    });
    
  } catch (error) {
    console.error("Erro ao verificar disponibilidade de consultas:", error);
    return res.status(500).json({ message: "Erro ao verificar consultas disponíveis" });
  }
};

/**
 * Verifica o desconto que o usuário tem direito com base no plano
 */
export const getSpecialistDiscount = (req: AuthenticatedRequest): number => {
  if (!req.user) return 0;
  
  const userPlan = req.user.subscriptionPlan || 'free';
  
  // Retorna o desconto com base no plano
  switch (userPlan) {
    case 'ultra':
    case 'ultra_family':
      return 70;
    case 'premium':
    case 'premium_family':
      return 50;
    case 'basic':
    case 'basic_family':
      return 30;
    default:
      return 0;
  }
};