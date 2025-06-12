import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Certifique-se de que o diretório de uploads existe
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do storage específica para médicos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    console.log('Salvando arquivo em:', uploadDir);
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = 'doctor-profile-' + uniqueSuffix + ext;
    console.log('Nome do arquivo gerado:', filename);
    cb(null, filename);
  }
});

// Filtro específico para imagens de médicos
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  console.log(`[DOCTOR UPLOAD] Arquivo: ${file.originalname}, Tipo: ${file.mimetype}, Tamanho: ${file.size ? (file.size / 1024 / 1024).toFixed(2) + 'MB' : 'desconhecido'}`);
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log('[DOCTOR UPLOAD] Arquivo aceito');
    cb(null, true);
  } else {
    const error = new Error(`[DOCTOR UPLOAD] Formato não suportado: ${file.mimetype}. Use apenas JPEG, PNG, GIF ou WEBP.`);
    console.error('[DOCTOR UPLOAD] Erro:', error.message);
    cb(error);
  }
};

// Middleware específico para uploads de médicos
export const doctorUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    fieldSize: 50 * 1024 * 1024, // 50MB para o campo
    fieldNameSize: 100, // Nome do campo
    fields: 10, // Número de campos
    parts: 20 // Número de partes
  },
  fileFilter: fileFilter
});

// Middleware para configurar timeout específico para uploads de médicos
export const doctorUploadTimeout = (req: Request, res: Response, next: NextFunction) => {
  console.log('[DOCTOR UPLOAD] Configurando timeout para upload de médico');
  
  // Configurar timeouts específicos
  req.setTimeout(180000); // 3 minutos
  res.setTimeout(180000); // 3 minutos
  
  // Headers para melhor compatibilidade
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=180');
  
  console.log('[DOCTOR UPLOAD] Timeout configurado para 3 minutos');
  next();
};

// Middleware combinado
export const doctorUploadMiddleware = [
  doctorUploadTimeout,
  doctorUpload.single('profileImage')
]; 