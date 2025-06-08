// Este arquivo mantém a exportação explícita do tipo global, útil para importações direcionais.
import { Request } from 'express';

// Definir User interface localmente para evitar dependências circulares
export interface User {
  id: number;
  email: string;
  fullName: string;
  role: 'admin' | 'doctor' | 'patient' | 'partner';
  emailVerified: boolean;
  username?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
}

// Estender o namespace do Express
declare global {
  namespace Express {
    interface Request {
      emergencyConsultationToDecrement?: boolean;
      user?: User;
    }
  }
}

// Usar tipo ao invés de interface para evitar conflitos
export type AuthenticatedRequest = Request & {
  user?: User;
  isAuthenticated?: () => boolean;
}; 