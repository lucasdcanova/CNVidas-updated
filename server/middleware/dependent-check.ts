import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';

export const requireDependent = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Não autorizado', 401);
  }

  const dependentId = Number(req.params.dependentId);
  if (isNaN(dependentId)) {
    throw new AppError('ID do dependente inválido', 400);
  }

  const dependent = await storage.getDependent(dependentId);
  if (!dependent || dependent.userId !== Number(req.user.id)) {
    throw new AppError('Dependente não encontrado ou não autorizado', 404);
  }

  next();
}; 