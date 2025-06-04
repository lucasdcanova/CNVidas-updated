import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { User } from '@shared/schema';

/**
 * Middleware para autenticação via token
 * Este middleware verifica se existe um token de autenticação no header ou cookie
 * e autentica o usuário se o token for válido
 */
export const tokenAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Se o usuário já está autenticado via sessão, passe adiante
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // Verificar se existe um token nos headers (múltiplas fontes possíveis)
  const authToken = req.headers['x-auth-token'] as string || 
                   (req.headers.authorization?.startsWith('Bearer ') 
                    ? req.headers.authorization.substring(7) 
                    : req.headers.authorization) || 
                    req.cookies?.authToken;
  
  // BLOQUEIO: Impedir qualquer acesso às rotas do Agora.io
  if (req.path.includes('/api/agora')) {
    console.log('🚫 BLOQUEADO acesso à rota Agora.io:', req.path);
    return res.status(403).json({ 
      message: 'Rota bloqueada - usando apenas Daily.co',
      redirect: '/telemedicine'
    });
  }
  
  // Se não houver token, continue para o próximo middleware
  if (!authToken) {
    return next();
  }
  
  try {
    const [sessionID, userId, timestamp] = authToken.split(':');
    
    if (!sessionID || !userId) {
      return next();
    }
    
    // Verificar se o token não expirou (24 horas)
    const tokenTime = parseInt(timestamp);
    if (isNaN(tokenTime) || Date.now() - tokenTime > 24 * 60 * 60 * 1000) {
      return next();
    }
    
    // Buscar o usuário pelo ID
    const user = await storage.getUser(parseInt(userId));
    if (!user) {
      return next();
    }
    
    // Definir o usuário na requisição
    (req as AuthenticatedRequest).user = user;
    console.log(`Usuário autenticado via X-Auth-Token: ${user.id}, ${user.email}, ${user.role}`);
    
    next();
  } catch (error) {
    console.error("Erro ao autenticar via token:", error);
    next();
  }
};