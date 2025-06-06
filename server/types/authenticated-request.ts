import { User } from '@shared/schema';
import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: User;
};

declare module 'express' {
  export interface Request {
    user?: User;
  }
} 