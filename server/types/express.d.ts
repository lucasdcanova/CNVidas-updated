import { User } from '@shared/schema';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      isUserAuthenticated?: () => boolean;
    }
  }

  // Tipo auxiliar para rotas já autenticadas (user garantido)
  interface AuthenticatedRequest extends Request {
    user: User;
  }
}

// (O tipo AuthenticatedRequest é definido em 'server/types/authenticated-request.ts')

export {};

// Tornar o tipo importável diretamente
export type { AuthenticatedRequest }; 