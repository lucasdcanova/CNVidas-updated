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
  console.log('=== UPLOAD PROFILE IMAGE (DOCTOR) ===');
  console.log('User ID:', req.user?.id);
  console.log('File received:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`
  } : 'No file');

  if (!req.user) {
    console.error('Erro: Usuário não autenticado');
    return res.status(401).json({ 
      success: false,
      message: "Não autorizado",
      details: "Token de autenticação inválido ou expirado"
    });
  }

  try {
    if (!req.file) {
      console.error('Erro: Nenhum arquivo foi enviado');
      return res.status(400).json({ 
        success: false,
        message: "Nenhuma imagem enviada",
        details: "O campo profileImage é obrigatório"
      });
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    console.log('Image URL gerada:', imageUrl);
    
    // Buscar imagem atual para remover depois
    const [currentDoctor] = await db.select().from(doctors).where(eq(doctors.userId, req.user.id));
    const oldImage = currentDoctor?.profileImage;
    
    // Atualizar imagem no perfil do usuário
    const userUpdateResult = await db
      .update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, req.user.id));

    console.log('User update result:', userUpdateResult);

    // Atualizar imagem no perfil do médico
    if (currentDoctor) {
      const doctorUpdateResult = await db
        .update(doctors)
        .set({ 
          profileImage: imageUrl,
          updatedAt: new Date()
        })
        .where(eq(doctors.id, currentDoctor.id));
      
      console.log('Doctor update result:', doctorUpdateResult);
    }

    // Remover imagem antiga se existir
    if (oldImage && oldImage !== imageUrl && oldImage.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), 'public', oldImage);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log('Imagem antiga removida:', oldPath);
        } catch (error) {
          console.error('Erro ao remover imagem antiga:', error);
        }
      }
    }

    console.log('Upload de médico concluído com sucesso');
    return res.json({ 
      success: true, 
      imageUrl: imageUrl,
      profileImage: imageUrl,
      message: "Imagem de perfil atualizada com sucesso" 
    });
  } catch (error: any) {
    console.error('Erro detalhado no upload de médico:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      file: req.file?.filename
    });
    
    // Remover arquivo se houve erro
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Arquivo removido após erro:', filePath);
      }
    }

    return res.status(500).json({ 
      success: false,
      message: error.message || "Erro ao processar upload de imagem",
      details: "Erro durante o processamento do upload",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Rota para remover imagem de perfil do médico
doctorRouter.delete('/remove-profile-image', isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  try {
    // Buscar imagem atual
    const [currentDoctor] = await db.select().from(doctors).where(eq(doctors.userId, req.user.id));
    const oldImage = currentDoctor?.profileImage;

    // Remover imagem do perfil do usuário
    await db
      .update(users)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, req.user.id));

    // Remover imagem do perfil do médico
    if (currentDoctor) {
      await db
        .update(doctors)
        .set({ 
          profileImage: null,
          updatedAt: new Date()
        })
        .where(eq(doctors.id, currentDoctor.id));
    }

    // Remover arquivo físico
    if (oldImage && oldImage.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), 'public', oldImage);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log('Imagem removida:', oldPath);
        } catch (error) {
          console.error('Erro ao remover arquivo:', error);
        }
      }
    }

    return res.json({ 
      success: true,
      message: "Imagem de perfil removida com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao remover imagem:", error);
    return res.status(500).json({ message: "Erro ao remover imagem de perfil" });
  }
});

export { doctorRouter };