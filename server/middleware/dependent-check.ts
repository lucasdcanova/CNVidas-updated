import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { storage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';
import { AuthenticatedRequest } from '../types/authenticated-request';

export const requireDependent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Não autorizado', 401);
  }

  if (!req.params.dependentId) {
    throw new AppError('ID do dependente não fornecido', 400);
  }

  const dependentId = toNumberOrThrow(req.params.dependentId as string);
  const userId = toNumberOrThrow(req.user.id as string | number);

  const dependent = await storage.getDependent(dependentId);
  if (!dependent || dependent.userId !== userId) {
    throw new AppError('Dependente não encontrado ou não autorizado', 404);
  }

  next();
}; 