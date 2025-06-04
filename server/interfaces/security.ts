export interface SecurityLog {
  id: number;
  userId?: number;
  action: 'login' | 'logout' | 'password_change' | 'email_change' | 'profile_update' | 'payment' | 'api_access';
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure' | 'blocked';
  details?: string;
  createdAt: Date;
}

export type InsertSecurityLog = Omit<SecurityLog, 'id' | 'createdAt'>;

export interface SecuritySettings {
  id: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  sessionTimeout: number;
  twoFactorEnabled: boolean;
  twoFactorMethod: 'email' | 'sms' | 'authenticator';
  createdAt: Date;
  updatedAt: Date;
}

export type InsertSecuritySettings = Omit<SecuritySettings, 'id' | 'createdAt' | 'updatedAt'>;

export interface ApiKey {
  id: number;
  userId: number;
  key: string;
  name: string;
  permissions: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertApiKey = Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt'>;

export interface SecurityAlert {
  id: number;
  userId?: number;
  type: 'suspicious_login' | 'password_reset' | 'email_change' | 'payment_fraud' | 'api_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'pending' | 'investigating' | 'resolved' | 'false_positive';
  details?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertSecurityAlert = Omit<SecurityAlert, 'id' | 'createdAt' | 'updatedAt'>; 