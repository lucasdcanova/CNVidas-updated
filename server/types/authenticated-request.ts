// Este arquivo mantém a exportação explícita do tipo global, útil para importações direcionais.
import { Request } from 'express';
import { User } from './express';

// Definir User interface localmente para evitar dependências circulares
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

// Exportar o tipo AuthenticatedRequest
export interface AuthenticatedRequest extends Request {
  user: User;
}

export type { AuthenticatedRequest }; 