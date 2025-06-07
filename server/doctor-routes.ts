// @ts-nocheck

import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { upload } from './middleware/upload';
import path from 'path';
import fs from 'fs';
import { users, doctors } from '../shared/schema';
import type { User, Doctor } from '../shared/schema';
import { DatabaseStorage } from './storage';
import type { AuthenticatedRequest } from '../types/express';

const doctorRouter = Router();

// Middleware para verificar se o usuário é um médico
const isDoctor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  if (req.user.role !== 'doctor') {
    return res.status(403).json({ message: "Apenas médicos podem acessar esta rota" });
  }

  next();
};

// Rota para verificar se o médico já completou a página de boas-vindas
doctorRouter.get('/welcome-status', isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  try {
    const [doctorRecord] = await db.select().from(doctors).where(eq(doctors.userId, req.user.id));
    if (!doctorRecord) {
      return res.status(404).json({ message: "Perfil de médico não encontrado" });
    }
    return res.json({
      isFirstLogin: !doctorRecord.welcomeCompleted
    });
  } catch (error) {
    console.error("Erro ao verificar status de boas-vindas:", error);
    return res.status(500).json({ message: "Erro ao verificar status de boas-vindas" });
  }
});

// Rota para marcar a página de boas-vindas como concluída
doctorRouter.post('/complete-welcome', isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  try {
    const [doctorRecord] = await db.select().from(doctors).where(eq(doctors.userId, req.user.id));
    if (!doctorRecord) {
      return res.status(404).json({ message: "Perfil de médico não encontrado" });
    }
    await db
      .update(doctors)
      .set({ 
        welcomeCompleted: true,
        updatedAt: new Date()
      })
      .where(eq(doctors.id, doctorRecord.id));
    return res.json({ success: true });
  } catch (error) {
    console.error("Erro ao marcar boas-vindas como concluídas:", error);
    return res.status(500).json({ message: "Erro ao atualizar perfil do médico" });
  }
});

// Rota para obter o perfil do médico
doctorRouter.get('/profile', isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  try {
    const [doctorRecord] = await db.select().from(doctors).where(eq(doctors.userId, req.user.id));
    if (!doctorRecord) {
      return res.status(404).json({ message: "Perfil de médico não encontrado" });
    }
    const [userRecord] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!userRecord) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const profile: Doctor & Pick<User, 'email' | 'fullName' | 'username' | 'profileImage'> = {
      ...doctorRecord,
      email: userRecord.email,
      fullName: userRecord.fullName,
      username: userRecord.username,
      profileImage: userRecord.profileImage || doctorRecord.profileImage,
      pixKeyType: doctorRecord.pixKeyType,
      pixKey: doctorRecord.pixKey,
      bankName: doctorRecord.bankName,
      accountType: doctorRecord.accountType
    };
    return res.json(profile);
  } catch (error) {
    console.error("Erro ao buscar perfil do médico:", error);
    return res.status(500).json({ message: "Erro ao buscar perfil do médico" });
  }
});

// Rota para upload de imagem de perfil do médico
doctorRouter.post('/profile-image', isDoctor, upload.single('profileImage'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhuma imagem enviada" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Atualizar imagem no perfil do usuário
    await db
      .update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, req.user.id));

    // Atualizar imagem no perfil do médico
    const [doctorRecord] = await db.select().from(doctors).where(eq(doctors.userId, req.user.id));
    if (doctorRecord) {
      await db
        .update(doctors)
        .set({ profileImage: imageUrl })
        .where(eq(doctors.id, doctorRecord.id));
    }

    return res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: "Imagem de perfil atualizada com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao fazer upload de imagem:", error);
    return res.status(500).json({ message: "Erro ao processar upload de imagem" });
  }
});

export { doctorRouter };