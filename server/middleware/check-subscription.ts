import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
      });
    }

    // Verificar assinatura ativa
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        endDate: {
          gt: new Date(),
        },
      },
    });

    if (!subscription) {
      return res.status(403).json({
        error: 'Assinatura inativa ou expirada',
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    res.status(500).json({
      error: 'Erro ao verificar assinatura',
    });
  }
}; 