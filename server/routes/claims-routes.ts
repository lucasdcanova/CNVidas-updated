import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';

const claimsRouter = Router();

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
claimsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Verificar autenticação
    let userId = null;
    let userData = null;
    
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      userId = authReq.user.id;
      userData = authReq.user;
    }
    
    if (!userId || !userData) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const { title, description, amount, category } = req.body;
    
    if (!title || !description || !amount) {
      return res.status(400).json({ message: 'title, description e amount são obrigatórios' });
    }
    
    console.log(`Criando claim para usuário ${userId}`);
    
    // Criar o claim
    const claimData = {
      userId: userId,
      type: category || 'medical',
      description: description || title,
      amountRequested: parseFloat(amount),
      occurrenceDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    
    const newClaim = await storage.createClaim(claimData, []);
    
    console.log(`Claim criado com sucesso: ${newClaim.id}`);
    
    res.status(201).json(newClaim);
    
  } catch (error) {
    console.error('Erro ao criar claim:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar claim',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default claimsRouter; 