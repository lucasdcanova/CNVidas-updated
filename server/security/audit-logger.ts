import { Request } from 'express';
import { storage } from '../storage';

export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  ACCOUNT_LOCK = 'ACCOUNT_LOCK',
  ACCOUNT_UNLOCK = 'ACCOUNT_UNLOCK'
}

interface AuditLogEntry {
  userId?: number;
  action: AuditAction;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: Date;
}

class AuditLogger {
  /**
   * Registra uma ação de auditoria
   */
  public async log(
    req: Request,
    action: AuditAction,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      const entry: AuditLogEntry = {
        userId: req.user?.id,
        action,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        details,
        timestamp: new Date()
      };

      await storage.createAuditLog(entry);
    } catch (error) {
      console.error('Erro ao registrar log de auditoria:', error);
    }
  }

  /**
   * Registra uma tentativa de login bem-sucedida
   */
  public async logSuccessfulLogin(req: Request, userId: number): Promise<void> {
    await this.log(req, AuditAction.LOGIN_SUCCESS, { userId });
  }

  /**
   * Registra uma tentativa de login mal-sucedida
   */
  public async logFailedLogin(req: Request, email: string, reason: string): Promise<void> {
    await this.log(req, AuditAction.LOGIN_FAILURE, { email, reason });
  }

  /**
   * Registra uma alteração de senha
   */
  public async logPasswordChange(req: Request, userId: number): Promise<void> {
    await this.log(req, AuditAction.PASSWORD_CHANGE, { userId });
  }

  /**
   * Registra uma atualização de perfil
   */
  public async logProfileUpdate(req: Request, userId: number, changes: Record<string, any>): Promise<void> {
    await this.log(req, AuditAction.PROFILE_UPDATE, { userId, changes });
  }

  /**
   * Registra uma verificação de email
   */
  public async logEmailVerification(req: Request, userId: number): Promise<void> {
    await this.log(req, AuditAction.EMAIL_VERIFICATION, { userId });
  }

  /**
   * Registra um bloqueio de conta
   */
  public async logAccountLock(req: Request, userId: number, reason: string): Promise<void> {
    await this.log(req, AuditAction.ACCOUNT_LOCK, { userId, reason });
  }

  /**
   * Registra um desbloqueio de conta
   */
  public async logAccountUnlock(req: Request, userId: number, reason: string): Promise<void> {
    await this.log(req, AuditAction.ACCOUNT_UNLOCK, { userId, reason });
  }
}

export const auditLogger = new AuditLogger(); 