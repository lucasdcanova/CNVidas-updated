import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { AppError } from '../utils/app-error';
import { users } from '@shared/schema';
import { db } from '../db';
import { ExpressUser } from '../../shared/types';
import { storage } from '../storage';
import { eq } from 'drizzle-orm';
import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { emailVerifications, passwordResets } from '@shared/schema';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';
import passport from 'passport';

const authRouter = Router();

// Middleware de autenticação
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    throw new AppError(401, 'Não autorizado');
  }
  next();
};

// Middleware de tratamento de erros
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Registra um novo usuário
 * POST /api/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      throw new AppError(400, 'Email, senha e nome são obrigatórios');
    }

    // TODO: Implementar lógica de registro
    
    res.json({ message: 'Usuário registrado com sucesso' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Autentica um usuário
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AppError(400, 'Email e senha são obrigatórios');
    }

    // TODO: Implementar lógica de autenticação
    
    res.json({ message: 'Usuário autenticado com sucesso' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Desautentica um usuário
 * POST /api/auth/logout
 */
authRouter.post('/logout', isAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    // TODO: Implementar lógica de logout
    
    res.json({ message: 'Usuário desautenticado com sucesso' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Verificar token
authRouter.get('/verify', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new AppError(401, 'Token não fornecido');
  }

  try {
    const decoded = verify(token, process.env.JWT_SECRET || 'default-secret') as { id: number };
    const result = await db.select().from(users)
      .where(eq(users.id, decoded.id));

    const user = result[0];
    if (!user) {
      throw new AppError(401, 'Token inválido');
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Token inválido' });
    }
  }
});

/**
 * Rota para obter dados do usuário logado
 * GET /api/auth/me
 */
authRouter.get('/me', isAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (authReq.isAuthenticated()) {
      res.json({ user: authReq.user });
    } else {
      res.status(401).json({ message: 'Não autenticado' });
    }
  } catch (error) {
    console.error('Erro ao obter dados do usuário logado:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao obter dados do usuário logado' });
    }
  }
});

// Rota para verificar o email
authRouter.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new AppError(400, 'Token inválido');
    }

    // Buscar token de verificação
    const [verificationToken] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token));

    if (!verificationToken) {
      throw new AppError(404, 'Token de verificação não encontrado');
    }

    // Verificar se o token expirou
    if (new Date() > verificationToken.expiresAt) {
      throw new AppError(400, 'Token de verificação expirado');
    }

    // Atualizar o usuário para verificado
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, verificationToken.userId));

    // Remover o token usado
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.token, token));

    // Redirecionar para a página de login com mensagem de sucesso
    res.redirect('/auth?verified=true');
  } catch (error) {
    console.error('Erro ao verificar email:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao verificar email' });
    }
  }
});

// Rota para reenviar email de verificação
authRouter.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      // Por segurança, não informamos que o email não existe
      return res.status(200).json({ message: 'Se o email estiver cadastrado, enviaremos um link de verificação' });
    }

    // Verificar se o usuário já está verificado
    if (user.emailVerified) {
      return res.status(400).json({ message: 'Este email já foi verificado' });
    }

    // Remover tokens antigos
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id));

    // Gerar novo token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas

    // Salvar token de verificação no banco de dados
    await db.insert(emailVerifications).values({
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
    });

    // Enviar email de verificação
    await sendVerificationEmail(email, token);

    res.status(200).json({ message: 'Email de verificação reenviado com sucesso' });
  } catch (error) {
    console.error('Erro ao reenviar email de verificação:', error);
    res.status(500).json({ message: 'Erro ao reenviar email de verificação' });
  }
});

// Rota para solicitar redefinição de senha
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      // Por segurança, não informamos que o email não existe
      return res.status(200).json({ message: 'Se o email estiver cadastrado, enviaremos um link de redefinição de senha' });
    }

    // Remover tokens antigos
    await db
      .delete(passwordResets)
      .where(eq(passwordResets.userId, user.id));

    // Gerar novo token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

    // Salvar token de redefinição no banco de dados
    await db.insert(passwordResets).values({
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
    });

    // Enviar email de redefinição de senha
    await sendPasswordResetEmail(email, token);

    res.status(200).json({ message: 'Email de redefinição de senha enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao solicitar redefinição de senha:', error);
    res.status(500).json({ message: 'Erro ao processar a solicitação' });
  }
});

// Rota para redefinir a senha
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token e nova senha são obrigatórios' });
    }

    // Buscar token de redefinição
    const [resetToken] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token));

    if (!resetToken) {
      return res.status(404).json({ message: 'Token de redefinição não encontrado' });
    }

    // Verificar se o token expirou
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: 'Token de redefinição expirado' });
    }

    // Atualizar a senha do usuário
    const hashedPassword = await hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    // Remover o token usado
    await db
      .delete(passwordResets)
      .where(eq(passwordResets.token, token));

    res.status(200).json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ message: 'Erro ao processar redefinição de senha' });
  }
});

export default authRouter;