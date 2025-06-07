import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { verifyToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { toNumberOrThrow } from '../utils/id-converter';
import { getUserById } from '../storage';

/**
 * Middleware para autenticação via token
 * Este middleware verifica se existe um token de autenticação no header ou cookie
 * e autentica o usuário se o token for válido
 */
export const tokenAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AppError('Token não fornecido', 401);
    }

    const decoded = await verifyToken(token);
    if (!decoded || !decoded.id) {
      throw new AppError('Token inválido', 401);
    }

    const authReq = req as AuthenticatedRequest;
    const user = await getUserById(toNumberOrThrow(decoded.id as string | number));
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }
    authReq.user = user;
    
    next();
  } catch (error) {
    next(new AppError('Token inválido', 401));
  }
};