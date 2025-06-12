import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { NotificationService } from '../utils/notification-service';

const claimsRouter = Router();

// Configurar multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // máximo 5 arquivos
  },
  fileFilter: (req, file, cb) => {
    // Permitir apenas tipos específicos de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use apenas JPG, PNG, GIF ou PDF.'));
    }
  },
});

/**
 * Endpoint para listar claims do usuário
 * GET /api/claims
 */
claimsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const userId = req.user.id;
    console.log(`Buscando claims para usuário ${userId}`);
    
    // Buscar claims do usuário
    const userClaims = await storage.getUserClaims(userId);
    
    console.log(`Encontrados ${userClaims.length} claims`);
    
    res.json({ data: userClaims });
    
  } catch (error) {
    console.error('Erro ao buscar claims:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar claims',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para criar novo claim
 * POST /api/claims
 */
claimsRouter.post('/', upload.array('documents'), requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const userId = req.user.id;
    const userData = req.user;
    
    console.log('📥 Dados recebidos no backend:', req.body);
    console.log('📁 Arquivos recebidos:', req.files);
    
    // Suportar tanto FormData quanto JSON
    const { type, description, occurrenceDate, title, amount, category, daysHospitalized, amountRequested } = req.body;
    
    // Determinar o tipo e descrição baseado nos dados recebidos
    const claimType = type || category || 'medical';
    const claimDescription = description || title;
    const claimDate = occurrenceDate || new Date().toISOString().split('T')[0];
    const hospitalDays = parseInt(daysHospitalized) || 0;
    const requestedAmount = parseInt(amountRequested) || parseInt(amount) || 0;
    
    if (!claimDescription) {
      return res.status(400).json({ message: 'Descrição é obrigatória' });
    }
    
    console.log(`Criando claim para usuário ${userId}:`, {
      type: claimType,
      description: claimDescription,
      date: claimDate,
      daysHospitalized: hospitalDays,
      amountRequested: requestedAmount
    });
    
    // Criar o claim
    const claimData = {
      userId: userId,
      type: claimType,
      description: claimDescription,
      amountRequested: requestedAmount,
      daysHospitalized: hospitalDays,
      occurrenceDate: claimDate,
      status: 'pending'
    };
    
    // Processar documentos se houver
    const documents: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      console.log(`📎 ${req.files.length} documentos anexados`);
      // Por enquanto, apenas salvar os nomes dos arquivos
      // Em produção, seria necessário salvar os arquivos em um storage (S3, etc.)
      documents.push(...req.files.map(file => file.originalname));
    }
    
    const newClaim = await storage.createClaim(claimData, documents);
    
    // Criar notificação de sinistro submetido
    await NotificationService.createClaimSubmittedNotification(userId, newClaim.id);
    
    console.log(`✅ Claim criado com sucesso: ${newClaim.id}`);
    
    res.status(201).json(newClaim);
    
  } catch (error) {
    console.error('❌ Erro ao criar claim:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar claim',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default claimsRouter; 