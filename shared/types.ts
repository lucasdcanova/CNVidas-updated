import { Request } from 'express';
import type {
  User,
  Partner,
  Doctor,
  PartnerService,
  Appointment,
  Claim,
  Notification,
  DoctorPayment,
  AuditLog,
  QrToken,
  SubscriptionPlan,
  UserSettings,
  EmailVerification,
  PasswordReset,
  AvailabilitySlot,
  QrAuthLog,
  Dependent,
  InsertUser,
  InsertPartner,
  InsertDoctor,
  InsertPartnerService,
  InsertAppointment,
  InsertClaim,
  InsertNotification,
  InsertDoctorPayment,
  InsertAuditLog,
  InsertQrToken,
  InsertSubscriptionPlan,
  InsertUserSettings,
  InsertEmailVerification,
  InsertPasswordReset,
  InsertAvailabilitySlot,
  InsertQrAuthLog,
  InsertDependent
} from './schema';

export type {
  User,
  Partner,
  Doctor,
  PartnerService,
  Appointment,
  Claim,
  Notification,
  DoctorPayment,
  AuditLog,
  QrToken,
  SubscriptionPlan,
  UserSettings,
  EmailVerification,
  PasswordReset,
  AvailabilitySlot,
  QrAuthLog,
  Dependent,
  InsertUser,
  InsertPartner,
  InsertDoctor,
  InsertPartnerService,
  InsertAppointment,
  InsertClaim,
  InsertNotification,
  InsertDoctorPayment,
  InsertAuditLog,
  InsertQrToken,
  InsertSubscriptionPlan,
  InsertUserSettings,
  InsertEmailVerification,
  InsertPasswordReset,
  InsertAvailabilitySlot,
  InsertQrAuthLog,
  InsertDependent
};

export interface ExpressUser extends User {
  id: number;
  role: 'admin' | 'doctor' | 'partner' | 'patient';
}

// Interfaces para Storage
export interface IStorage {
  getUserById(id: number): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  getDependent(id: number): Promise<Dependent | null>;
  getDependentsByUserId(userId: number): Promise<Dependent[]>;
  createDependent(dependent: InsertDependent): Promise<Dependent>;
  updateDependent(id: number, dependent: Partial<Dependent>): Promise<Dependent | null>;
  deleteDependent(id: number): Promise<boolean>;
}

// Interfaces para autenticação
export interface AuthConfig {
  secret: string;
  expiresIn: string;
}

// Interfaces para pagamento
export interface PaymentConfig {
  apiKey: string;
  webhookSecret: string;
}

// Interfaces para notificações
export interface NotificationConfig {
  apiKey: string;
  senderId: string;
}

// Interfaces para armazenamento
export interface StorageConfig {
  type: 'local' | 's3';
  path?: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Interfaces para configuração geral
export interface Config {
  port: number;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  auth: AuthConfig;
  payment: PaymentConfig;
  notification: NotificationConfig;
  storage: StorageConfig;
} 