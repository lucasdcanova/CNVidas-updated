// Este arquivo mantém a exportação explícita do tipo global, útil para importações direcionais.
import { Request } from 'express';
import { User } from '@shared/schema';

export interface AuthenticatedRequest {
  user: User;
  isAuthenticated?: () => boolean;
  // Include all necessary Request properties manually
  body: any;
  params: any;
  query: any;
  headers: any;
  method: string;
  url: string;
  path: string;
  cookies?: any;
  signedCookies?: any;
  ip: string;
  ips: string[];
} 