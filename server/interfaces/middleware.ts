import { Request, Response, NextFunction } from 'express';
import { ValidationSchema } from './validation';

export interface MiddlewareFunction {
  (req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

export interface ErrorMiddlewareFunction {
  (error: Error, req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

export interface AuthenticationMiddleware extends MiddlewareFunction {
  strategy: string;
  options?: Record<string, any>;
}

export interface AuthorizationMiddleware extends MiddlewareFunction {
  permissions: string[];
  checkAll?: boolean;
}

export interface ValidationMiddleware extends MiddlewareFunction {
  schema: ValidationSchema;
  options?: Record<string, any>;
}

export interface RateLimitMiddleware extends MiddlewareFunction {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
}

export interface CorsMiddleware extends MiddlewareFunction {
  origin: string | string[] | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface LoggingMiddleware extends MiddlewareFunction {
  format?: string;
  options?: {
    skip?: (req: Request, res: Response) => boolean;
    stream?: NodeJS.WritableStream;
  };
}

export interface CompressionMiddleware extends MiddlewareFunction {
  filter?: (req: Request, res: Response) => boolean;
  threshold?: number;
  level?: number;
}

export interface SecurityMiddleware extends MiddlewareFunction {
  options?: {
    contentSecurityPolicy?: boolean | Record<string, any>;
    crossOriginEmbedderPolicy?: boolean | Record<string, any>;
    crossOriginOpenerPolicy?: boolean | Record<string, any>;
    crossOriginResourcePolicy?: boolean | Record<string, any>;
    dnsPrefetchControl?: boolean | Record<string, any>;
    expectCt?: boolean | Record<string, any>;
    frameguard?: boolean | Record<string, any>;
    hidePoweredBy?: boolean | Record<string, any>;
    hsts?: boolean | Record<string, any>;
    ieNoOpen?: boolean | Record<string, any>;
    noSniff?: boolean | Record<string, any>;
    originAgentCluster?: boolean | Record<string, any>;
    permittedCrossDomainPolicies?: boolean | Record<string, any>;
    referrerPolicy?: boolean | Record<string, any>;
    xssFilter?: boolean | Record<string, any>;
  };
}

export interface SessionMiddleware extends MiddlewareFunction {
  secret: string;
  resave?: boolean;
  saveUninitialized?: boolean;
  cookie?: {
    secure?: boolean;
    httpOnly?: boolean;
    maxAge?: number;
    domain?: string;
    path?: string;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
  };
  store?: any;
}

export interface FileUploadMiddleware extends MiddlewareFunction {
  dest?: string;
  limits?: {
    fieldNameSize?: number;
    fieldSize?: number;
    fields?: number;
    fileSize?: number;
    files?: number;
    parts?: number;
    headerPairs?: number;
  };
  fileFilter?: (req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => void;
  storage?: any;
} 