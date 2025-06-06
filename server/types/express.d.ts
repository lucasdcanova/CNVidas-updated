import { User } from '@shared/schema';
import { Request } from 'express';
import { User as DrizzleUser } from '../../shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      isUserAuthenticated(): boolean;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends DrizzleUser {}
  }
}

export {};

// Removida a interface AuthenticatedRequest duplicada daqui 