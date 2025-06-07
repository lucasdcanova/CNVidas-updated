// Este arquivo mantém a exportação explícita do tipo global, útil para importações direcionais.
import { Request } from 'express';
import { User } from '@shared/schema';

export interface AuthenticatedRequest extends Request {
  user: User;
  isAuthenticated?: () => boolean;
} 