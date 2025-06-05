import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { User } from '@shared/types';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Não autorizado', 401);
  }
  next();
};

export function requireRole(roles: User['role'][]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Não autorizado' });
    }
    next();
  };
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  next();
}

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new AppError('Acesso permitido apenas para administradores', 403);
  }
  next();
};

export const requireDoctor = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'doctor') {
    throw new AppError('Acesso permitido apenas para médicos', 403);
  }
  next();
};

export const requirePatient = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'patient') {
    throw new AppError('Acesso permitido apenas para pacientes', 403);
  }
  next();
};

export function requirePartner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }
  if (req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Acesso restrito a parceiros' });
  }
  next();
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { id: number };
    const user = await storage.getUserByToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
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

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPartner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError(401, 'Não autorizado');
    }

    if (authReq.user.role !== 'partner') {
      throw new AppError(403, 'Acesso negado. Esta rota é apenas para parceiros.');
    }

    const partner = await storage.getPartnerByUserId(authReq.user.id);
    
    if (!partner) {
      await storage.createPartner({
        userId: authReq.user.id,
        businessName: authReq.user.fullName || 'Parceiro CN Vidas',
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