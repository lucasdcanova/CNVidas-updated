import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/app-error';

const userRouter = express.Router();

/**
 * Obter perfil do usuário
 * GET /api/users/profile
 */
userRouter.get('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const user = await storage.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualizar perfil do usuário
 * PUT /api/users/profile
 */
userRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { fullName, username } = req.body;
    
    const updatedUser = await storage.updateUser(req.user.id, {
      fullName,
      username,
      updatedAt: new Date()
    });

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        subscriptionPlan: updatedUser.subscriptionPlan,
        emailVerified: updatedUser.emailVerified
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Gerar token QR code para o usuário
 * POST /api/users/generate-qr
 */
userRouter.post('/generate-qr', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const qrData = await storage.generateQrToken(req.user.id);
    
    res.json({
      token: qrData.token,
      expiresAt: qrData.expiresAt,
      message: 'Token QR gerado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao gerar token QR:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Verificar token QR code
 * POST /api/users/verify-qr
 */
userRouter.post('/verify-qr', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token QR não fornecido' });
    }

    const user = await storage.getUserByQrToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Token QR inválido ou expirado' });
    }

    // Log da autenticação QR
    try {
      await storage.logQrAuthentication({
        token,
        scannerUserId: null, // Pode ser preenchido se houver um usuário logado fazendo o scan
        tokenUserId: user.id,
        ipAddress: req.ip || req.connection.remoteAddress || null,
        userAgent: req.get('User-Agent') || null
      });
    } catch (logError) {
      console.error('Erro ao registrar log de autenticação QR:', logError);
      // Continue mesmo se o log falhar
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      message: 'Token QR verificado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao verificar token QR:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Listar usuários (apenas para admin)
 * GET /api/users?role=patient
 */
userRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { role } = req.query;
    const users = await storage.getAllUsers();
    
    let filteredUsers = users;
    if (role && typeof role === 'string') {
      filteredUsers = users.filter(user => user.role === role);
    }

    const safeUsers = filteredUsers.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    }));

    res.json({ users: safeUsers });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

export default userRouter; 