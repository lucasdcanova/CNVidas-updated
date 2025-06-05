import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import express from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users } from '../shared/schema';
import { rateLimiter, loginRateLimit, recordLoginAttempt } from "./security/rate-limiter";
import { auditLogger } from "./security/audit-logger";
import { AuthenticatedRequest } from './types/authenticated-request';
import { AppError } from './utils/app-error';

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: string;
      username: string;
      fullName: string;
      emailVerified: boolean;
      password: string;
      createdAt: Date;
      updatedAt: Date;
      lastLogin?: Date;
      isActive: boolean;
      subscriptionStatus?: string;
      subscriptionPlan?: string;
      subscriptionChangedAt?: Date;
      emergencyConsultationsLeft?: number;
      sellerName?: string;
      profileImage?: string | null;
      phone?: string | null;
      cpf?: string | null;
      address?: string | null;
      number?: string | null;
      complement?: string | null;
      neighborhood?: string | null;
      city?: string | null;
      state?: string | null;
      zipCode?: string | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

/**
 * Gera um hash seguro para uma senha
 * @param password - Senha em texto plano
 * @returns Hash da senha no formato "hash.salt"
 */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Compara uma senha fornecida com um hash armazenado
 * @param supplied - Senha fornecida em texto plano
 * @param stored - Hash da senha armazenada (ou texto plano durante a transição)
 */
export async function comparePasswords(supplied: string, stored: string) {
  try {
    // Validar parâmetros
    if (!supplied || !stored) {
      return false;
    }

    // 1. Verificar se é uma senha em texto plano (legado/transição)
    if (!stored.includes('.')) {
      return false; // Não permitir mais senhas em texto plano
    }
    
    // 2. Verificação com hash+salt (formato seguro)
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    return false;
  }
}

/**
 * Valida a força da senha
 * @param password - Senha a ser validada
 * @returns Objeto com resultado da validação
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: "Senha é obrigatória" };
  }

  if (password.length < 8) {
    return { isValid: false, message: "A senha deve ter pelo menos 8 caracteres" };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos uma letra maiúscula" };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos uma letra minúscula" };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos um número" };
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos um caractere especial" };
  }

  return { isValid: true };
}

export function setupAuth(app: express.Express) {
  // Adicionar middlewares de rate limiting
  app.use('/api/login', loginRateLimit);
  app.use('/api/login', recordLoginAttempt);

  passport.use(
    new LocalStrategy(
      { 
        usernameField: 'email',
        passReqToCallback: true 
      },
      async (req: AuthenticatedRequest, email, password, done) => {
        try {
          // Validar parâmetros
          if (!email || !password) {
            await auditLogger.logFailedLogin(req, email, "Parâmetros inválidos");
            return done(null, false, { message: "Email e senha são obrigatórios" });
          }

          // Buscar usuário pelo email
          const [user] = await db.select().from(users).where(eq(users.email, email));
          
          if (!user) {
            await auditLogger.logFailedLogin(req, email, "Usuário não encontrado");
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          // Verificar se o usuário está ativo
          if (!user.emailVerified) {
            await auditLogger.logFailedLogin(req, email, "Email não verificado");
            return done(null, false, { message: "Por favor, verifique seu email antes de fazer login" });
          }
          
          // Verificar a senha
          const isPasswordValid = await comparePasswords(password, user.password);
          
          if (!isPasswordValid) {
            await auditLogger.logFailedLogin(req, email, "Senha incorreta");
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          // Login bem-sucedido
          await auditLogger.logSuccessfulLogin(req, user.id);
          return done(null, user);
        } catch (error) {
          await auditLogger.logFailedLogin(req, email, "Erro interno");
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      if (!user) {
        return done(null, false);
      }
      
      done(null, user as Express.User);
    } catch (error) {
      done(error);
    }
  });
}
