export interface AppError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, any>;
  isOperational: boolean;
}

export interface ValidationError extends AppError {
  fields: {
    field: string;
    message: string;
    value?: any;
  }[];
}

export interface DatabaseError extends AppError {
  query?: string;
  params?: any[];
  constraint?: string;
}

export interface AuthenticationError extends AppError {
  reason: 'invalid_credentials' | 'expired_token' | 'invalid_token' | 'missing_token' | 'insufficient_permissions';
}

export interface AuthorizationError extends AppError {
  requiredPermissions: string[];
  userPermissions: string[];
}

export interface RateLimitError extends AppError {
  limit: number;
  remaining: number;
  reset: Date;
}

export interface NotFoundError extends AppError {
  resource: string;
  identifier: string | number;
}

export interface ConflictError extends AppError {
  resource: string;
  identifier: string | number;
  existingValue: any;
}

export interface ServiceUnavailableError extends AppError {
  service: string;
  retryAfter?: number;
}

export interface ErrorLog {
  id: number;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
    details?: Record<string, any>;
  };
  userId?: number;
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    query?: any;
    params?: any;
  };
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body: any;
  };
  timestamp: Date;
}

export type InsertErrorLog = Omit<ErrorLog, 'id'>; 