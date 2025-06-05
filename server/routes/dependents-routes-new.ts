import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../utils/app-error';
import { dependents } from '@shared/schema';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { DatabaseStorage } from '../storage';

const dependentsRouter = Router();

// Middleware de autenticação compatível com Express
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
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
    if (!req.user) {
      throw new AppError(401, 'Usuário não autenticado');
    }
    const userDependents = await db.select()
      .from(dependents)
      .where(eq(dependents.userId, req.user.id));
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
    if (!req.user) {
      throw new AppError(401, 'Usuário não autenticado');
    }
    const { name, birthDate, relationship } = req.body;
    if (!name || !birthDate || !relationship) {
      throw new AppError(400, 'Nome, data de nascimento e relacionamento são obrigatórios');
    }
    const newDependent = await db.insert(dependents)
      .values({
        userId: req.user.id,
        name,
        birthDate: String(birthDate), // Drizzle espera string
        relationship
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
    if (!req.user) {
      throw new AppError(401, 'Usuário não autenticado');
    }
    const id = Number(req.params.id);
    const { name, birthDate, relationship } = req.body;
    if (!name || !birthDate || !relationship) {
      throw new AppError(400, 'Nome, data de nascimento e relacionamento são obrigatórios');
    }
    const updatedDependent = await db.update(dependents)
      .set({
        name,
        birthDate: String(birthDate),
        relationship
      })
      .where(and(
        eq(dependents.id, id),
        eq(dependents.userId, req.user.id)
      ))
      .returning();
    if (!updatedDependent[0]) {
      throw new AppError(404, 'Dependente não encontrado');
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
    if (!req.user) {
      throw new AppError(401, 'Usuário não autenticado');
    }
    const id = Number(req.params.id);
    const deletedDependent = await db.delete(dependents)
      .where(and(
        eq(dependents.id, id),
        eq(dependents.userId, req.user.id)
      ))
      .returning();
    if (!deletedDependent[0]) {
      throw new AppError(404, 'Dependente não encontrado');
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