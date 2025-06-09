import { User } from './authenticated-request';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      isAuthenticated?(): boolean;
    }

    interface User {
      id: number;
      email: string;
      username: string;
      fullName: string;
      role: 'patient' | 'partner' | 'admin' | 'doctor';
      cpf: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipcode: string | null;
      createdAt: Date;
      updatedAt: Date;
      lastLogin: Date | null;
      isActive: boolean;
      subscriptionStatus: string | null;
      subscriptionPlan: 'free' | 'basic' | 'premium' | 'ultra' | 'basic_family' | 'premium_family' | 'ultra_family' | null;
      emailVerified: boolean;
      profileImage: string | null;
      emergencyConsultationsLeft: number | null;
      birthDate: string | null;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      password: string;
      subscriptionPlanId: number | null;
      subscriptionStartDate: Date | null;
      subscriptionEndDate: Date | null;
      lastSubscriptionCancellation: Date | null;
      sellerId: string | null;
      sellerName: string | null;
      subscriptionChangedAt: Date | null;
    }
  }

  // Tipo auxiliar para rotas já autenticadas (user garantido)
  interface AuthenticatedRequest extends Request {
    user: User;
  }
}

// (O tipo AuthenticatedRequest é definido em 'server/types/authenticated-request.ts')

export {};

// Tornar o tipo importável diretamente
export type { AuthenticatedRequest }; 