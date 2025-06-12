import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db';

// Configurar o diretório de uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer para upload de arquivos
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = Router();

router.post('/doctor-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    // Log para debug
    console.log("Requisição recebida em /api/doctor-profile-image");
    console.log("Headers:", req.headers);
    
    // Verificar autenticação
    let userId: number | null = null;
    
    // Verificar token no cabeçalho
    const sessionId = req.headers['x-session-id'] as string || '';
    const authHeader = req.headers['authorization'] as string || '';
    
    console.log("Session ID:", sessionId);
    console.log("Auth Header:", authHeader);
    
    // Tentativa 1: Extrair ID do usuário do token de autenticação
    if (authHeader) {
      const parts = authHeader.split(':');
      if (parts.length >= 2) {
        userId = parseInt(parts[1]);
        console.log("Usuário extraído do token:", userId);
      }
    }
    
    // Tentativa 2: Buscar usuário pelo ID da sessão
    if (!userId && sessionId) {
      try {
        const result = await pool.query(
          "SELECT sess FROM session WHERE sid = $1",
          [sessionId]
        );
        
        if (result.rows.length > 0) {
          const sessionData = result.rows[0].sess;
          console.log("Dados da sessão:", sessionData);
          
          if (sessionData.passport && sessionData.passport.user) {
            userId = parseInt(sessionData.passport.user);
            console.log("Usuário extraído da sessão:", userId);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar sessão:", error);
      }
    }
    
    // Tentativa 3: Usar req.user se disponível
    if (!userId && req.isAuthenticated && req.user) {
      userId = req.user.id;
      console.log("Usuário autenticado via session:", userId);
    }
    
    // Se não conseguimos identificar o usuário, retornar erro
    if (!userId) {
      console.log("Não foi possível identificar o usuário");
      return res.status(401).json({ message: "Não autorizado. Não foi possível identificar o usuário." });
    }
    
    // Verificar se o usuário é um médico
    try {
      const userResult = await pool.query(
        "SELECT role FROM users WHERE id = $1",
        [userId]
      );
      
      if (userResult.rows.length === 0 || userResult.rows[0].role !== 'doctor') {
        console.log("Usuário não é médico:", userResult.rows[0]?.role);
        return res.status(403).json({ message: "Apenas médicos podem fazer upload de imagem nesta rota" });
      }
    } catch (error) {
      console.error("Erro ao verificar o papel do usuário:", error);
      return res.status(500).json({ message: "Erro ao verificar permissões do usuário" });
    }
    
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      console.log("Nenhum arquivo enviado");
      return res.status(400).json({ message: "Nenhuma imagem enviada" });
    }
    
    console.log("Arquivo recebido:", req.file);
    
    // Criar URL para a imagem
    const imageUrl = `/uploads/${req.file.filename}`;
    console.log("URL da imagem:", imageUrl);
    
    // Atualizar imagem de perfil do usuário
    await pool.query(
      "UPDATE users SET profile_image = $1, updated_at = NOW() WHERE id = $2",
      [imageUrl, userId]
    );
    
    // Verificar se existe um perfil de médico e atualizá-lo também
    const doctorResult = await pool.query(
      "SELECT id FROM doctors WHERE user_id = $1",
      [userId]
    );
    
    if (doctorResult.rows.length > 0) {
      const doctorId = doctorResult.rows[0].id;
      await pool.query(
        "UPDATE doctors SET profile_image = $1 WHERE id = $2",
        [imageUrl, doctorId]
      );
    }
    
    console.log("Imagem atualizada com sucesso");
    
    return res.json({
      success: true,
      imageUrl,
      message: "Imagem de perfil atualizada com sucesso"
    });
  } catch (error) {
    console.error("Erro ao processar upload de imagem:", error);
    return res.status(500).json({ message: "Erro ao processar upload de imagem" });
  }
});

export default router;