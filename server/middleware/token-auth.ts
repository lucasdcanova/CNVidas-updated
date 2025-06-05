import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { verifyToken } from '../utils/jwt';

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
    req.user = decoded;
    
    next();
  } catch (error) {
    next(new AppError('Token inválido', 401));
  }
};