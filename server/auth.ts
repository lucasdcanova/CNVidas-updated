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
import { AppError } from './utils/app-error';
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../shared/schema';
import { DatabaseStorage } from './storage';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// A declaração global de Express.User agora está em server/types/express.d.ts

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

// Função helper para mapear User do Drizzle para Express.User
function mapToExpressUser(user: User): Express.User {
  return {
    ...user,
    // Garanta que campos opcionais ou nulos sejam tratados, se necessário.
    // O spread operator (...) já faz um bom trabalho aqui.
  };
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
      async (req: Request, email, password, done) => {
        try {
          // Validar parâmetros
          if (!email || !password) {
            console.log("Login falhou: Parâmetros inválidos");
            return done(null, false, { message: "Email e senha são obrigatórios" });
          }

          // Buscar usuário pelo email
          const [user] = await db.select().from(users).where(eq(users.email, email));
          
          if (!user) {
            console.log("Login falhou: Usuário não encontrado");
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          // Verificar se o usuário está ativo
          if (!user.emailVerified) {
            console.log("Login falhou: Email não verificado");
            return done(null, false, { message: "Por favor, verifique seu email antes de fazer login" });
          }
          
          // Verificar a senha
          const isPasswordValid = await comparePasswords(password, user.password);
          
          if (!isPasswordValid) {
            console.log("Login falhou: Senha incorreta");
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          // Login bem-sucedido
          console.log("Login bem-sucedido para:", user.email);
          return done(null, mapToExpressUser(user));
        } catch (error) {
          console.error("Erro interno no login:", error);
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    // O objeto 'user' aqui é o que foi retornado no 'done(null, user)' da estratégia
    // e pode não ser diretamente compatível com Express.User se os tipos forem diferentes.
    // Usamos um type assertion para garantir que o compilador saiba que `id` existe.
    const id = (user as User).id;
    done(null, id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      // Se o usuário for encontrado, passamos o objeto completo para o 'done'
      // Se não, a falha (false) é indicada no segundo argumento.
      done(null, user ? mapToExpressUser(user) : false);
    } catch (error) {
      done(error);
    }
  });
}

const authRouter = Router();
