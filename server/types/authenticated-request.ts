import { Request } from 'express';
import { User } from '@shared/schema';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface AuthRequest extends Request {
  user: User;
} 