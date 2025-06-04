export interface UserSettings {
  id: number;
  userId: number;
  theme: 'light' | 'dark' | 'system';
  language: 'pt-BR' | 'en-US' | 'es';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    appointmentReminders: boolean;
    paymentReminders: boolean;
    systemUpdates: boolean;
    emergencyAlerts: boolean;
  };
  privacy: {
    showProfile: boolean;
    showEmail: boolean;
    showPhone: boolean;
    showAddress: boolean;
    showBirthDate: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type InsertUserSettings = Omit<UserSettings, 'id' | 'createdAt' | 'updatedAt'>;

export interface SystemSettings {
  id: number;
  key: string;
  value: string;
  description: string;
  category: 'general' | 'email' | 'payment' | 'notification' | 'security';
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertSystemSettings = Omit<SystemSettings, 'id' | 'createdAt' | 'updatedAt'>;

export interface EmailSettings {
  id: number;
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertEmailSettings = Omit<EmailSettings, 'id' | 'createdAt' | 'updatedAt'>;

export interface PaymentSettings {
  id: number;
  provider: 'stripe' | 'paypal' | 'pix';
  mode: 'test' | 'live';
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPaymentSettings = Omit<PaymentSettings, 'id' | 'createdAt' | 'updatedAt'>; 