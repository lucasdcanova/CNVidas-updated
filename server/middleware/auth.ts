import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types/authenticated-request';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';
import { DatabaseStorage } from '../storage';
import { AuthenticatedRequest } from '../types/authenticated-request';

export type { AuthenticatedRequest };
import { validateId } from '../utils/id-converter';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  console.log(`🔐 requireAuth - Verificando autenticação para ${req.method} ${req.path}`);
  console.log(`🔐 requireAuth - req.user:`, authReq.user ? `${authReq.user.id} (${authReq.user.role})` : 'undefined');
  
  if (!authReq.user) {
    console.log(`❌ requireAuth - Usuário não autenticado para ${req.method} ${req.path}`);
    return res.status(401).json({ message: 'Não autorizado' });
  }
  
  console.log(`✅ requireAuth - Usuário autenticado: ${authReq.user.id} (${authReq.user.role})`);
  next();
};

export const requireRole = (roles: User['role'][]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  next();
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || authReq.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const requireDoctor = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || authReq.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const requirePatient = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || authReq.user.role !== 'patient') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const requirePartner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.role || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
};

export const isDoctor = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.role || req.user.role !== 'doctor') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
};

export const isPatient = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.role || req.user.role !== 'patient') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
};

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPartner = async (req: Request, res: Response, next: NextFunction) => {
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