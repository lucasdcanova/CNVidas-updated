import { Request, Response } from 'express';
import { User } from '@shared/schema';

export interface Doctor {
  id: number;
  userId: number;
  specialization: string;
  crm: string;
  availableForEmergency: boolean;
  pixKeyType?: string;
  pixKey?: string;
  bankName?: string;
  accountType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Partner {
  id: number;
  userId: number;
  businessName: string;
  businessType: string;
  status: string;
  description?: string;
  zipcode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: number;
  userId: number;
  plan: string;
  status: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedResponse extends Response {
  locals: {
    user?: User;
  };
}

export type InsertUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUser = Partial<InsertUser>; 