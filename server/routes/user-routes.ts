import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/app-error.js';
import { generateQRCode } from '../utils/qr-code';
import { sendEmail } from '../utils/email';
import { compare, hash } from 'bcrypt';

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
 * Alterar senha do usuário
 * PUT /api/users/password
 */
userRouter.put('/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    // Buscar o usuário completo para verificar a senha atual
    const user = await storage.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar a senha atual
    let isPasswordValid = false;
    
    // Suporte para diferentes formatos de hash
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
      // Hash bcrypt padrão
      isPasswordValid = await compare(currentPassword, user.password);
    } else {
      // Tentar comparação direta se não for um hash bcrypt válido
      isPasswordValid = await compare(currentPassword, user.password);
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Verificar se a nova senha é diferente da atual
    const isSamePassword = await compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' });
    }

    // Hash da nova senha
    const hashedPassword = await hash(newPassword, 10);

    // Atualizar a senha
    await storage.updateUserPassword(req.user.id, hashedPassword);

    console.log(`Senha alterada com sucesso para o usuário ${user.email}`);

    return res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
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

    const qrData = JSON.stringify({
      userId: req.user.id,
      scannerUserId: undefined, // Pode ser preenchido se houver um usuário logado fazendo o scan
      type: 'profile',
      data: {
        userId: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email
      }
    });
    
    const qrCode = await generateQRCode(qrData);

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