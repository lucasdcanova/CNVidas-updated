export interface DatabaseConfig {
  url: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  compression: {
    level: number;
    threshold: number;
  };
  security: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: boolean;
    crossOriginResourcePolicy: boolean;
    dnsPrefetchControl: boolean;
    expectCt: boolean;
    frameguard: boolean;
    hidePoweredBy: boolean;
    hsts: boolean;
    ieNoOpen: boolean;
    noSniff: boolean;
    originAgentCluster: boolean;
    permittedCrossDomainPolicies: boolean;
    referrerPolicy: boolean;
    xssFilter: boolean;
  };
}

export interface SessionConfig {
  secret: string;
  resave: boolean;
  saveUninitialized: boolean;
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    domain?: string;
    path: string;
    sameSite: boolean | 'lax' | 'strict' | 'none';
  };
  store: any;
}

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

export interface PaymentConfig {
  provider: 'stripe' | 'paypal' | 'pix';
  mode: 'test' | 'live';
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  currency: string;
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  path?: string;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
  format: string;
  transports: {
    console?: boolean;
    file?: {
      filename: string;
      maxsize: number;
      maxFiles: number;
    };
  };
}

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  debug: boolean;
  database: DatabaseConfig;
  server: ServerConfig;
  session: SessionConfig;
  email: EmailConfig;
  payment: PaymentConfig;
  storage: StorageConfig;
  logging: LoggingConfig;
} 