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

export interface AuthenticatedRequest extends Request {
  user: User;
  isUserAuthenticated: () => boolean;
} 