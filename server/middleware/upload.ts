import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Certifique-se de que o diretório de uploads existe
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do storage para o Multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// Filtro para permitir apenas imagens
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  console.log(`Upload tentativa: ${file.originalname}, Tipo: ${file.mimetype}, Tamanho: ${file.size ? (file.size / 1024 / 1024).toFixed(2) + 'MB' : 'desconhecido'}`);
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Formato de arquivo não suportado: ${file.mimetype}. Apenas imagens JPEG, PNG, GIF e WEBP são permitidas.`);
    console.error('Erro de tipo de arquivo:', error.message);
    cb(error);
  }
};

// Cria o middleware do multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (será comprimido no frontend)
    files: 1
  },
  fileFilter: fileFilter
});