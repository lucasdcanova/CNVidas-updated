import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/app-error.js';
import { generateQRCode } from '../utils/qr-code';
import { sendEmail } from '../utils/email';

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

    const user = await storage.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remove campos sensíveis
    const { password, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
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

    const { fullName, phone, address, city, state, zipcode, number, complement, neighborhood } = req.body;

    const updatedUser = await storage.updateUser(req.user.id, {
      fullName,
      phone,
      address,
      city,
      state,
      zipcode,
      number,
      complement,
      neighborhood
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remove campos sensíveis
    const { password, ...userWithoutPassword } = updatedUser;
    return res.json(userWithoutPassword);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
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

    const qrCode = await generateQRCode({
      userId: req.user.id,
      scannerUserId: undefined, // Pode ser preenchido se houver um usuário logado fazendo o scan
      type: 'profile',
      data: {
        userId: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email
      }
    });

    return res.json({ qrCode });
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
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

    const users = await storage.getAllUsers();
    const usersWithoutPassword = users.map(({ password, ...user }) => user);
    return res.json(usersWithoutPassword);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default userRouter; 