import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/app-error.js';
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

    const { fullName, username, email, phone, birthDate, address, city, state, zipcode, number, complement, neighborhood } = req.body;

    // **CORREÇÃO: Filtrar campos undefined/null para evitar "No values to set"**
    const updateData: any = {};
    
    // Incluir apenas campos que tenham valores válidos
    if (fullName !== undefined && fullName !== null) updateData.fullName = fullName;
    if (username !== undefined && username !== null) updateData.username = username;
    if (email !== undefined && email !== null) updateData.email = email;
    if (phone !== undefined && phone !== null) updateData.phone = phone;
    if (birthDate !== undefined && birthDate !== null) updateData.birthDate = birthDate;
    if (address !== undefined && address !== null) updateData.address = address;
    if (city !== undefined && city !== null) updateData.city = city;
    if (state !== undefined && state !== null) updateData.state = state;
    if (zipcode !== undefined && zipcode !== null) updateData.zipcode = zipcode;
    if (number !== undefined && number !== null) updateData.number = number;
    if (complement !== undefined && complement !== null) updateData.complement = complement;
    if (neighborhood !== undefined && neighborhood !== null) updateData.neighborhood = neighborhood;

    // Verificar se há pelo menos um campo para atualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido fornecido para atualização' });
    }

    console.log(`🔄 Atualizando perfil do usuário ${req.user.id} com campos:`, Object.keys(updateData));

    const updatedUser = await storage.updateUser(req.user.id, updateData);

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

    // Gerar um token único e simples para o QR code
    const qrToken = `CNV-${req.user.id}-${Date.now()}`;
    
    return res.json({ qrCode: qrToken });
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

/**
 * Salvar configurações do usuário
 * PUT /api/users/settings
 */
userRouter.put('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { notifications, privacy } = req.body;

    console.log(`🔧 Salvando configurações do usuário ${req.user.id}:`, { notifications, privacy });

    const settings = await storage.saveUserSettings(req.user.id, {
      notifications,
      privacy
    });

    return res.json(settings);
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Buscar configurações do usuário
 * GET /api/users/settings
 */
userRouter.get('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const settings = await storage.getUserSettings(req.user.id);
    
    if (!settings) {
      // Retornar configurações padrão se não existirem
      return res.json({
        notifications: {
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
          notificationFrequency: 'immediate',
          appointmentReminders: true,
          marketingEmails: false,
        },
        privacy: {
          shareWithDoctors: true,
          shareWithPartners: false,
          shareFullMedicalHistory: false,
          allowAnonymizedDataUse: true,
          profileVisibility: 'contacts',
        }
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default userRouter; 