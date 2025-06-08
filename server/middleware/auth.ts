import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@shared/schema';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';
import { DatabaseStorage } from '../storage';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { validateId } from '../utils/id-converter';

export { AuthenticatedRequest };

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const requireRole = (roles: User['role'][]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  next();
}

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const requireDoctor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const requirePatient = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'patient') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const requirePartner = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.role || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
};

export const isDoctor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.role || req.user.role !== 'doctor') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
};

export const isPatient = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.role || req.user.role !== 'patient') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
};

export const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPartner = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Não autorizado', 401);
    }

    if (req.user.role !== 'partner') {
      throw new AppError('Acesso negado. Esta rota é apenas para parceiros.', 403);
    }

    const userId = validateId(req.user.id);
    const partner = await storage.getPartnerByUserId(userId);
    
    if (!partner) {
      await storage.createPartner({
        userId,
        businessName: req.user.fullName || 'Parceiro CN Vidas',
        businessType: 'Prestador de Serviços',
        status: 'approved',
        description: 'Parceiro CN Vidas'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}; 