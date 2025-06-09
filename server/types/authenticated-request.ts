// Este arquivo mantém a exportação explícita do tipo global, útil para importações direcionais.
import { Request } from 'express';
import { User } from './express';

// Define User interface
export interface User {
  id: number;
  email: string;
  username: string;
  password: string;
  fullName: string;
  role: 'patient' | 'partner' | 'admin' | 'doctor';
  cpf: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  birthDate: string | null;
  gender: string | null;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  subscriptionPlan: 'free' | 'basic' | 'premium' | 'ultra' | 'basic_family' | 'premium_family' | 'ultra_family' | null;
  subscriptionStatus: string | null;
  subscriptionChangedAt: Date | null;
  subscriptionPlanId: number | null;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  lastSubscriptionCancellation: Date | null;
  sellerId: string | null;
  sellerName: string | null;
  emailVerified: boolean;
  emergencyConsultationsLeft: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastLogin: Date | null;
  isActive: boolean;
}

// Estender o namespace do Express
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      username: string;
      password: string;
      fullName: string;
      role: 'patient' | 'partner' | 'admin' | 'doctor';
      cpf: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipcode: string | null;
      number: string | null;
      complement: string | null;
      neighborhood: string | null;
      birthDate: Date | null;
      gender: string | null;
      profileImage: string | null;
      createdAt: Date;
      updatedAt: Date;
      status: string;
      subscriptionPlan: string | null;
      subscriptionStatus: string | null;
      subscriptionChangedAt: Date | null;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      welcomeCompleted: boolean;
      pixKeyType: string | null;
      pixKey: string | null;
      bankName: string | null;
      accountType: string | null;
    }
  }
}

// Define AuthenticatedRequest interface
export interface AuthenticatedRequest extends Request {
  user: User;
}

// Export both types
export type { AuthenticatedRequest, User }; 