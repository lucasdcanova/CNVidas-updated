import { Request, Response, NextFunction } from 'express';
import { User } from '../../shared/schema';
import { AuthenticatedRequest } from '../types/authenticated-request';

// Export AuthenticatedRequest for use in other files
export type { AuthenticatedRequest };

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
  };
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (typeof authReq.isAuthenticated !== 'function' || !authReq.isAuthenticated() || !authReq.user || authReq.user.role !== 'admin') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isDoctor = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (typeof authReq.isAuthenticated !== 'function' || !authReq.isAuthenticated() || !authReq.user || authReq.user.role !== 'doctor') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPatient = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (typeof authReq.isAuthenticated !== 'function' || !authReq.isAuthenticated() || !authReq.user || authReq.user.role !== 'patient') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

export const isPartner = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (typeof authReq.isAuthenticated !== 'function' || !authReq.isAuthenticated() || !authReq.user || authReq.user.role !== 'partner') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}; 