import { Request, Response, NextFunction } from 'express';
import { User } from '../../shared/schema';

export type AuthenticatedRequest = Request;

export const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
  };
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isDoctor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'doctor') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPatient = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'patient') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPartner = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'partner') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}; 