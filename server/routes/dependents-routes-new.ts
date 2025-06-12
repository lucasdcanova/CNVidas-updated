import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { dependents } from '../../shared/schema.js';
import { db } from '../db.js';
import { eq, and } from 'drizzle-orm';
import { DatabaseStorage } from '../storage.js';
import { toNumberOrThrow } from '../utils/id-converter.js';
import { AuthenticatedRequest } from '../types/authenticated-request.js';
import { NotificationService } from '../utils/notification-service';

const dependentsRouter = Router();

// Middleware CORS para desenvolvimento
dependentsRouter.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Test endpoint
dependentsRouter.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Dependents router is working', timestamp: new Date().toISOString() });
});

// Middleware de autenticação compatível com Express
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Middleware de tratamento de erros
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro em dependents route:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    url: req.url,
    method: req.method,
    body: req.body,
    user: (req as AuthenticatedRequest).user
  });
  
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ 
      error: err.message,
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  } else {
    res.status(500).json({ 
      error: err.message || 'Erro interno do servidor',
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
};

/**
 * Lista todos os dependentes do usuário
 * GET /api/dependents
 */
dependentsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    console.log('GET /api/dependents - Request received:', {
      user: authReq.user,
      url: req.url,
      headers: req.headers
    });
    
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    
    console.log('Buscando dependentes para usuário ID:', authReq.user.id);
    const userDependents = await db.select()
      .from(dependents)
      .where(eq(dependents.userId, authReq.user.id));
      
    console.log('Dependentes encontrados:', userDependents.length);
    res.json(userDependents);
  } catch (error) {
    console.error('Erro ao buscar dependentes:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Pass error to the error handler middleware
    next(error);
  }
});

/**
 * Adiciona um novo dependente
 * POST /api/dependents
 */
dependentsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    console.log('POST /api/dependents - Request received:', {
      user: authReq.user,
      body: req.body,
      headers: req.headers
    });
    
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    
    const { fullName, birthDate, relationship, cpf } = req.body;
    console.log('Dados recebidos:', { fullName, birthDate, relationship, cpf });
    
    if (!fullName || !birthDate || !relationship || !cpf) {
      throw new AppError('Nome, CPF, data de nascimento e relacionamento são obrigatórios', 400);
    }
    
    // Validate and format the birth date
    const formattedBirthDate = new Date(birthDate).toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    console.log('Data formatada:', formattedBirthDate);
    
    const dependentData = {
      userId: authReq.user.id,
      fullName: String(fullName),
      cpf: String(cpf),
      birthDate: formattedBirthDate,
      relationship: String(relationship)
    };
    
    console.log('Inserindo dependente com dados:', dependentData);
    
    const newDependent = await db.insert(dependents)
      .values(dependentData)
      .returning();
      
    // Criar notificação de dependente adicionado
    await NotificationService.createDependentAddedNotification(
      authReq.user.id,
      dependentData.fullName
    );
      
    console.log('Dependente criado com sucesso:', newDependent[0]);
    res.status(201).json(newDependent[0]);
  } catch (error) {
    console.error('Erro ao criar dependente:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      detail: error.detail
    });
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      // Verificar se é erro de banco de dados
      if (error.code === '23505') {
        res.status(409).json({ error: 'CPF já cadastrado para este usuário' });
      } else if (error.code === '23503') {
        res.status(400).json({ error: 'Usuário inválido' });
      } else if (error.code === '22001') {
        res.status(400).json({ error: 'Um ou mais campos excedem o tamanho máximo permitido' });
      } else {
        res.status(500).json({ 
          error: 'Erro interno do servidor',
          details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
      }
    }
  }
});

/**
 * Atualiza um dependente
 * PUT /api/dependents/:id
 */
dependentsRouter.put('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    const id = toNumberOrThrow(req.params.id);
    const { fullName, birthDate, relationship } = req.body;
    if (!fullName || !birthDate || !relationship) {
      throw new AppError('Nome, data de nascimento e relacionamento são obrigatórios', 400);
    }
    const updatedDependent = await db.update(dependents)
      .set({
        fullName: String(fullName),
        birthDate: new Date(birthDate).toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        relationship: String(relationship)
      })
      .where(and(
        eq(dependents.id, id),
        eq(dependents.userId, authReq.user.id)
      ))
      .returning();
    if (!updatedDependent[0]) {
      throw new AppError('Dependente não encontrado', 404);
    }
    res.json(updatedDependent[0]);
  } catch (error) {
    console.error('Erro ao atualizar dependente:', error);
    next(error);
  }
});

/**
 * Remove um dependente
 * DELETE /api/dependents/:id
 */
dependentsRouter.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    const id = toNumberOrThrow(req.params.id);
    const deletedDependent = await db.delete(dependents)
      .where(and(
        eq(dependents.id, id),
        eq(dependents.userId, authReq.user.id)
      ))
      .returning();
    if (!deletedDependent[0]) {
      throw new AppError('Dependente não encontrado', 404);
    }
    res.json({ message: 'Dependente removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover dependente:', error);
    next(error);
  }
});

// Aplicar o middleware de tratamento de erros ao final
dependentsRouter.use(errorHandler);

export default dependentsRouter;