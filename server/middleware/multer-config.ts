import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuração de armazenamento padrão para uploads de perfil
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Determinar prefixo baseado no tipo de usuário
    let prefix = 'profile';
    if (req.url.includes('doctor')) {
      prefix = 'doctor-profile';
    } else if (req.url.includes('partner')) {
      prefix = 'partner-profile';
    }
    
    cb(null, `${prefix}-${timestamp}-${random}${ext}`);
  }
});

// Filtro de arquivo padrão para imagens
const imageFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Use apenas imagens (JPG, PNG, GIF, WEBP).`), false);
  }
};

// Configuração padrão do multer para upload de imagens de perfil
export const profileImageUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    fieldSize: 50 * 1024 * 1024,
    fieldNameSize: 100,
    fields: 10,
    parts: 20
  },
  fileFilter: imageFileFilter
});

// Configuração para outros tipos de upload (documentos, etc)
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `document-${timestamp}-${random}${ext}`);
  }
});

// Filtro para documentos
const documentFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
};

export const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB para documentos
    files: 5 // Até 5 arquivos por vez
  },
  fileFilter: documentFileFilter
});

// Função auxiliar para remover arquivo
export const removeFile = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      resolve();
      return;
    }

    const fullPath = filePath.startsWith('/') 
      ? path.join(process.cwd(), 'public', filePath)
      : filePath;

    fs.unlink(fullPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('Erro ao remover arquivo:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Função para limpar uploads temporários
export const cleanupTempUploads = (files: Express.Multer.File[]): void => {
  if (!files || !Array.isArray(files)) return;
  
  files.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error('Erro ao limpar arquivo temporário:', error);
      }
    }
  });
};