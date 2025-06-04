import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';

// Configuração do multer para upload de imagens
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
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

const router = Router();

// Rota para upload de imagem de perfil do médico
router.post('/doctors/profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    // Verificar autenticação
    let userId = null;
    
    // Via X-Session-ID e token no header
    const sessionId = req.headers['x-session-id'] as string;
    const authHeader = req.headers['authorization'] as string;
    
    if (sessionId && authHeader) {
      const tokenParts = authHeader.split(':');
      if (tokenParts.length === 3) {
        userId = parseInt(tokenParts[1]);
        console.log('Usuário autenticado via token:', userId);
      }
    }
    
    // Se não conseguiu autenticar, retorna erro
    if (!userId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhuma imagem foi enviada' });
    }
    
    // Criar URL relativa para a imagem
    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Atualizar o profile_image no banco de dados para o usuário
    await pool.query(
      'UPDATE users SET profile_image = $1, updated_at = NOW() WHERE id = $2',
      [imageUrl, userId]
    );
    
    // Verificar se existe um registro na tabela doctors e atualizar também
    const { rows } = await pool.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );
    
    if (rows.length > 0) {
      const doctorId = rows[0].id;
      await pool.query(
        'UPDATE doctors SET profile_image = $1 WHERE id = $2',
        [imageUrl, doctorId]
      );
    }
    
    return res.json({
      success: true,
      imageUrl,
      message: 'Imagem de perfil atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao fazer upload de imagem:', error);
    return res.status(500).json({ message: 'Erro ao processar upload de imagem' });
  }
});

export default router;