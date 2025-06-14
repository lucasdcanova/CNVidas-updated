import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { users, doctors, partners } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireDoctor, requirePartner, AuthRequest } from '../middleware/auth-unified';
import { profileImageUpload, removeFile } from '../middleware/multer-config';

const router = Router();

// Usar a configuração centralizada do multer
const upload = profileImageUpload;

// Função para remover arquivo antigo
const removeOldImage = async (imagePath: string) => {
  if (imagePath && imagePath.startsWith('/uploads/')) {
    try {
      await removeFile(imagePath);
      console.log('Imagem antiga removida:', imagePath);
    } catch (error) {
      console.error('Erro ao remover imagem antiga:', error);
    }
  }
};

// Upload de imagem de perfil geral (paciente)
router.post('/upload-image', requireAuth, upload.single('profileImage'), async (req: AuthRequest, res) => {
  try {
    console.log('=== UPLOAD PROFILE IMAGE (PATIENT) ===');
    console.log('User ID:', req.user?.id);
    console.log('File received:', req.file ? {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`
    } : 'No file');

    if (!req.file) {
      console.error('Erro: Nenhum arquivo foi enviado');
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo foi enviado',
        details: 'O campo profileImage é obrigatório'
      });
    }

    const userId = req.user!.id;
    if (!userId) {
      console.error('Erro: Usuário não autenticado');
      return res.status(401).json({ 
        success: false,
        message: 'Usuário não autenticado',
        details: 'Token de autenticação inválido ou expirado'
      });
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    console.log('Image URL gerada:', imageUrl);

    // Buscar imagem atual do usuário
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const oldImage = currentUser[0]?.profileImage;

    // Atualizar usuário com nova imagem
    const updateResult = await db.update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    console.log('Update result:', updateResult);

    // Remover imagem antiga se existir
    if (oldImage && oldImage !== imageUrl) {
      await removeOldImage(oldImage);
    }

    console.log('Upload de paciente concluído com sucesso');
    res.json({
      success: true,
      message: 'Foto de perfil atualizada com sucesso',
      imageUrl,
      profileImage: imageUrl
    });

  } catch (error: any) {
    console.error('Erro detalhado no upload de paciente:', {
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

    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor',
      details: 'Erro durante o processamento do upload',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Upload de imagem para médicos
router.post('/doctors/profile-image', requireDoctor, upload.single('profileImage'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo foi enviado' 
      });
    }

    const userId = req.user!.id;
    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    // Buscar dados do médico
    const doctor = await db.select().from(doctors).where(eq(doctors.userId, userId)).limit(1);
    const oldImage = doctor[0]?.profileImage;

    // Atualizar tabela de médicos
    await db.update(doctors)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(doctors.userId, userId));

    // Também atualizar tabela de usuários
    await db.update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Remover imagem antiga se existir
    if (oldImage) {
      await removeOldImage(oldImage);
    }

    res.json({
      success: true,
      message: 'Foto de perfil do médico atualizada com sucesso',
      imageUrl,
      profileImage: imageUrl
    });

  } catch (error: any) {
    console.error('Erro ao fazer upload de imagem do médico:', error);
    
    // Remover arquivo se houve erro
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// Upload de imagem para parceiros
router.post('/partners/profile-image', requirePartner, upload.single('profileImage'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo foi enviado' 
      });
    }

    const userId = req.user!.id;
    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    // Buscar dados do parceiro
    const partner = await db.select().from(partners).where(eq(partners.userId, userId)).limit(1);
    const oldImage = partner[0]?.profileImage;

    // Atualizar tabela de parceiros
    await db.update(partners)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(partners.userId, userId));

    // Também atualizar tabela de usuários
    await db.update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Remover imagem antiga se existir
    if (oldImage) {
      await removeOldImage(oldImage);
    }

    res.json({
      success: true,
      message: 'Foto de perfil do parceiro atualizada com sucesso',
      imageUrl,
      profileImage: imageUrl
    });

  } catch (error: any) {
    console.error('Erro ao fazer upload de imagem do parceiro:', error);
    
    // Remover arquivo se houve erro
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// Remover imagem de perfil geral
router.delete('/remove-image', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Buscar imagem atual
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const oldImage = currentUser[0]?.profileImage;

    // Remover imagem do usuário
    await db.update(users)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Remover arquivo físico
    if (oldImage) {
      await removeOldImage(oldImage);
    }

    res.json({
      success: true,
      message: 'Foto de perfil removida com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao remover imagem:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// Remover imagem de médico
router.delete('/doctors/remove-profile-image', requireDoctor, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Buscar dados do médico
    const doctor = await db.select().from(doctors).where(eq(doctors.userId, userId)).limit(1);
    const oldImage = doctor[0]?.profileImage;

    // Remover de ambas as tabelas
    await db.update(doctors)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(doctors.userId, userId));

    await db.update(users)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Remover arquivo físico
    if (oldImage) {
      await removeOldImage(oldImage);
    }

    res.json({
      success: true,
      message: 'Foto de perfil do médico removida com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao remover imagem do médico:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// Remover imagem de parceiro
router.delete('/partners/remove-profile-image', requirePartner, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Buscar dados do parceiro
    const partner = await db.select().from(partners).where(eq(partners.userId, userId)).limit(1);
    const oldImage = partner[0]?.profileImage;

    // Remover de ambas as tabelas
    await db.update(partners)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(partners.userId, userId));

    await db.update(users)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Remover arquivo físico
    if (oldImage) {
      await removeOldImage(oldImage);
    }

    res.json({
      success: true,
      message: 'Foto de perfil do parceiro removida com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao remover imagem do parceiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

export default router; 