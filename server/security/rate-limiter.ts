import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

interface LoginAttempt {
  timestamp: number;
  ip: string;
  email: string;
}

class RateLimiter {
  private attempts: Map<string, LoginAttempt[]> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutos
  private readonly BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutos

  /**
   * Registra uma tentativa de login
   */
  public recordAttempt(ip: string, email: string): void {
    const key = `${ip}:${email}`;
    const now = Date.now();
    
    if (!this.attempts.has(key)) {
      this.attempts.set(key, []);
    }
    
    const attempts = this.attempts.get(key)!;
    attempts.push({ timestamp: now, ip, email });
    
    // Limpar tentativas antigas
    this.cleanupAttempts(key);
  }

  /**
   * Verifica se o IP/email está bloqueado
   */
  public isBlocked(ip: string, email: string): boolean {
    const key = `${ip}:${email}`;
    const attempts = this.attempts.get(key) || [];
    
    // Verificar se há tentativas recentes suficientes para bloquear
    const recentAttempts = attempts.filter(
      attempt => Date.now() - attempt.timestamp < this.WINDOW_MS
    );
    
    if (recentAttempts.length >= this.MAX_ATTEMPTS) {
      const oldestAttempt = recentAttempts[0];
      const blockEndTime = oldestAttempt.timestamp + this.BLOCK_DURATION_MS;
      
      return Date.now() < blockEndTime;
    }
    
    return false;
  }

  /**
   * Obtém o tempo restante de bloqueio em segundos
   */
  public getBlockTimeRemaining(ip: string, email: string): number {
    const key = `${ip}:${email}`;
    const attempts = this.attempts.get(key) || [];
    
    const recentAttempts = attempts.filter(
      attempt => Date.now() - attempt.timestamp < this.WINDOW_MS
    );
    
    if (recentAttempts.length >= this.MAX_ATTEMPTS) {
      const oldestAttempt = recentAttempts[0];
      const blockEndTime = oldestAttempt.timestamp + this.BLOCK_DURATION_MS;
      const remaining = blockEndTime - Date.now();
      
      return Math.max(0, Math.floor(remaining / 1000));
    }
    
    return 0;
  }

  /**
   * Limpa tentativas antigas
   */
  private cleanupAttempts(key: string): void {
    const attempts = this.attempts.get(key) || [];
    const now = Date.now();
    
    const validAttempts = attempts.filter(
      attempt => now - attempt.timestamp < this.WINDOW_MS
    );
    
    this.attempts.set(key, validAttempts);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Middleware para rate limiting de login
 */
export const loginRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const email = req.body.email;

  if (!email) {
    return res.status(400).json({ message: "Email é obrigatório" });
  }

  if (rateLimiter.isBlocked(ip, email)) {
    const remainingTime = rateLimiter.getBlockTimeRemaining(ip, email);
    return res.status(429).json({
      message: "Muitas tentativas de login. Tente novamente mais tarde.",
      remainingTime,
      blocked: true
    });
  }

  next();
};

/**
 * Middleware para registrar tentativas de login
 */
export const recordLoginAttempt = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const email = req.body.email;

  if (email) {
    rateLimiter.recordAttempt(ip, email);
  }

  next();
}; 