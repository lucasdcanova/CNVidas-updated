import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, doctors, partners } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Interface para o usuário autenticado
export interface AuthUser {
  id: number;
  email: string;
  role: string;
  fullName: string;
  username?: string;
  emailVerified?: boolean;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  profileImage?: string | null;
}

// Interface para request com usuário
export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Obter segredo JWT
const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'cnvidas-secret-key-2024';
};

// Função para extrair token de diferentes fontes
const extractToken = (req: Request): string | null => {
  // 1. Verificar header Authorization (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. Verificar header X-Auth-Token
  const xAuthToken = req.headers['x-auth-token'] as string;
  if (xAuthToken) {
    return xAuthToken;
  }

  // 3. Verificar cookie auth_token
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }

  // 4. Verificar query parameter (para downloads, etc)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
};

// Função para verificar e decodificar token
export const verifyToken = async (token: string): Promise<AuthUser | null> => {
  try {
    const decoded: any = jwt.verify(token, getJwtSecret());
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    // Buscar dados completos do usuário
    const result = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    const user = result[0];

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      username: user.username || user.email,
      emailVerified: user.emailVerified,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      profileImage: user.profileImage
    };
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return null;
  }
};

// Middleware de autenticação obrigatória
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido',
        code: 'NO_TOKEN'
      });
    }

    const user = await verifyToken(token);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Adicionar usuário ao request
    authReq.user = user;
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(401).json({
      success: false,
      message: 'Erro ao verificar autenticação',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware de autenticação opcional
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  
  try {
    const token = extractToken(req);
    
    if (token) {
      const user = await verifyToken(token);
      if (user) {
        authReq.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Em caso de erro, continuar sem autenticação
    next();
  }
};

// Middleware para verificar role específica
export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(authReq.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão insuficiente.',
        code: 'INSUFFICIENT_PERMISSION'
      });
    }

    next();
  };
};

// Middleware específico para médicos
export const requireDoctor = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  
  // Primeiro verificar autenticação
  await requireAuth(req, res, async () => {
    if (!authReq.user) {
      return;
    }

    // Verificar se é médico
    if (authReq.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas médicos podem acessar esta rota.',
        code: 'DOCTOR_ONLY'
      });
    }

    // Verificar se existe registro na tabela doctors
    const doctor = await db.select().from(doctors).where(eq(doctors.userId, authReq.user.id)).limit(1);
    
    if (!doctor.length) {
      return res.status(403).json({
        success: false,
        message: 'Registro de médico não encontrado',
        code: 'DOCTOR_NOT_FOUND'
      });
    }

    next();
  });
};

// Middleware específico para parceiros
export const requirePartner = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  
  // Primeiro verificar autenticação
  await requireAuth(req, res, async () => {
    if (!authReq.user) {
      return;
    }

    // Verificar se é parceiro
    if (authReq.user.role !== 'partner') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas parceiros podem acessar esta rota.',
        code: 'PARTNER_ONLY'
      });
    }

    // Verificar se existe registro na tabela partners
    const partner = await db.select().from(partners).where(eq(partners.userId, authReq.user.id)).limit(1);
    
    if (!partner.length) {
      return res.status(403).json({
        success: false,
        message: 'Registro de parceiro não encontrado',
        code: 'PARTNER_NOT_FOUND'
      });
    }

    next();
  });
};

// Middleware específico para admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireRole(['admin'])(req, res, next);
};

// Gerar token JWT
export const generateToken = (userId: number, additionalData?: any) => {
  const payload = {
    userId,
    ...additionalData,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '7d' // Token válido por 7 dias
  });
};