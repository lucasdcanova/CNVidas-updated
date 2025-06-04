import { Request } from 'express';
import { User as SchemaUser, Partner, Doctor } from '../shared/schema';

declare global {
  namespace Express {
    interface User extends Omit<SchemaUser, 'emailVerified'> {
      emailVerified: boolean;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: Express.User;
  isAuthenticated(): this is AuthenticatedRequest & { user: Express.User };
  login(user: Express.User, callback: (err: any) => void): void;
  login(user: Express.User, options: { session: boolean }, callback: (err: any) => void): void;
}

export interface EmailVerification {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordReset {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Claim {
  id: number;
  userId: number;
  type: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  id: number;
  userId: number;
  theme: string;
  language: string;
  notifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
} 