import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../types/authenticated-request';

export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Erro:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Erro de validação',
      details: err.errors
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}; 