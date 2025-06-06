import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@shared/types';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';
import { DatabaseStorage } from '../storage';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError('Não autorizado', 403);
    }
    next();
  };
};

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  next();
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  if (req.user.role !== 'admin') {
    throw new AppError('Não autorizado', 403);
  }
  next();
};

export const requireDoctor = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  if (req.user.role !== 'doctor') {
    throw new AppError('Não autorizado', 403);
  }
  next();
};

export const requirePatient = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  if (req.user.role !== 'patient') {
    throw new AppError('Não autorizado', 403);
  }
  next();
};

export function requirePartner(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  if (req.user.role !== 'partner') {
    throw new AppError('Não autorizado', 403);
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

    req.user = user as User;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
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

    const partner = await storage.getPartnerByUserId(Number(req.user.id));
    
    if (!partner) {
      await storage.createPartner({
        userId: Number(req.user.id),
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