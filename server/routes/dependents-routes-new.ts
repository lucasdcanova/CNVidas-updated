import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../utils/app-error';
import { dependents } from '../../shared/schema';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { DatabaseStorage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';
import { AuthenticatedRequest } from '../types/authenticated-request';

const dependentsRouter = Router();

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
  console.error('Erro:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Lista todos os dependentes do usuário
 * GET /api/dependents
 */
dependentsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    const userDependents = await db.select()
      .from(dependents)
      .where(eq(dependents.userId, authReq.user.id));
    res.json(userDependents);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Adiciona um novo dependente
 * POST /api/dependents
 */
dependentsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    const { fullName, birthDate, relationship, cpf } = req.body;
    if (!fullName || !birthDate || !relationship || !cpf) {
      throw new AppError('Nome, CPF, data de nascimento e relacionamento são obrigatórios', 400);
    }
    const newDependent = await db.insert(dependents)
      .values({
        userId: authReq.user.id,
        fullName: String(fullName),
        cpf: String(cpf),
        birthDate: new Date(birthDate).toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        relationship: String(relationship)
      })
      .returning();
    res.status(201).json(newDependent[0]);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualiza um dependente
 * PUT /api/dependents/:id
 */
dependentsRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
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
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Remove um dependente
 * DELETE /api/dependents/:id
 */
dependentsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
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
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

export default dependentsRouter;