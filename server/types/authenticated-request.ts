// Este arquivo mantém a exportação explícita do tipo global, útil para importações direcionais.
import { Request } from 'express';
import { User } from '@shared/schema';

// Estender o namespace do Express
declare global {
  namespace Express {
    interface Request {
      emergencyConsultationToDecrement?: boolean;
    }
  }
}

// Usar tipo ao invés de interface para evitar conflitos
export type AuthenticatedRequest = Request & {
  user?: User;
  isAuthenticated?: () => boolean;
}; 