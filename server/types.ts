import { Request } from 'express';
import { User, Partner, Doctor } from '../shared/schema';

// Tipo auxiliar para lidar com a conversão de id
export interface User {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: 'patient' | 'doctor' | 'admin' | 'partner';
  cpf: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  city: string | null;
  zipCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
  isActive: boolean;
  isVerified: boolean;
  verificationToken: string | null;
  resetToken: string | null;
  resetTokenExpires: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  subscriptionChangedAt: Date | null;
}

export type UserId = number;

declare global {
  namespace Express {
    interface User extends User {
      id: UserId;
    }
  }
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

// Tipo para requests autenticadas
export interface AuthenticatedRequest extends Request {
  user?: User;
} 