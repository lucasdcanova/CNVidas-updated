import { User } from '../shared/schema';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      isUserAuthenticated(): boolean;
    }
  }
}

// Removida a interface AuthenticatedRequest duplicada daqui 