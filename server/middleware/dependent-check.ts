import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { storage } from '../storage';
import { AppError } from '../utils/app-error';

export const checkDependent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      throw new AppError(401, 'Usuário não autenticado');
    }

    const dependentId = Number(req.params.dependentId);
    if (!dependentId) {
      throw new AppError(400, 'ID do dependente não fornecido ou inválido');
    }

    const dependent = await storage.getDependent(dependentId);
    if (!dependent) {
      throw new AppError(404, 'Dependente não encontrado');
    }

    if (dependent.userId !== req.user.id) {
      throw new AppError(403, 'Acesso não autorizado a este dependente');
    }

    // Adiciona o dependente à requisição
    (req as AuthenticatedRequest & { dependent: typeof dependent }).dependent = dependent;
    next();
  } catch (error) {
    next(error);
  }
}; 