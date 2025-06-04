import { Request, Response, Router, NextFunction } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { users, doctors } from '../../shared/schema';
import { AuthenticatedRequest } from '../types/authenticated-request';

// Configuração do upload com Multer
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const profileImageRouter = Router();

// Middleware para verificar autenticação
const isAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  next();
};

// Rota para upload de imagem de perfil
profileImageRouter.post('/doctor-profile-image', isAuthenticated, upload.single('profileImage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Não autorizado" });
    }
    
    // Verificar se o usuário existe e é um médico
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    if (user.role !== 'doctor') {
      return res.status(403).json({ message: "Apenas médicos podem fazer upload de imagem de perfil nesta rota" });
    }
    
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ message: "Nenhuma imagem enviada" });
    }
    
    // Criar URL relativa para a imagem
    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Atualizar o campo profileImage do usuário
    await db
      .update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    // Também atualizar o campo no perfil do médico se existir
    const [doctorRecord] = await db.select().from(doctors).where(eq(doctors.userId, userId));
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

/**
 * Rota para obter imagem de perfil
 * GET /api/profile-image/:userId
 */
profileImageRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json({ 
      imageUrl: user.profileImage || null,
      message: user.profileImage ? "Imagem encontrada" : "Usuário não possui imagem de perfil"
    });
  } catch (error) {
    console.error("Erro ao buscar imagem de perfil:", error);
    return res.status(500).json({ message: "Erro ao processar requisição" });
  }
});

export default profileImageRouter;