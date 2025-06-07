import { Request } from 'express';
import { User as SchemaUser, Partner, Doctor } from '../shared/schema';

// Tipo auxiliar para lidar com a conversão de id
export type UserId = number;

// O tipo AuthenticatedRequest agora é global e definido em server/types/express.d.ts
// Esta definição foi removida para evitar conflitos.

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