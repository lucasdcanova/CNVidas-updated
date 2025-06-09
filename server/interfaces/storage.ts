import session from 'express-session';
import { 
  User, 
  Dependent, 
  Partner, 
  AuditLog, 
  InsertUser, 
  InsertDependent, 
  InsertPartner, 
  InsertAuditLog,
  Doctor,
  InsertDoctor,
  PartnerService,
  InsertPartnerService,
  Appointment,
  InsertAppointment,
  Claim,
  InsertClaim,
  Notification,
  InsertNotification,
  QrToken,
  InsertQrToken,
  AvailabilitySlot,
  InsertAvailabilitySlot,
  QrAuthLog,
  InsertQrAuthLog,
  UserSettings,
  InsertUserSettings,
  DoctorPayment,
  InsertDoctorPayment,
  EmailVerification,
  InsertEmailVerification,
  PasswordReset,
  InsertPasswordReset,
  SubscriptionPlan,
  InsertSubscriptionPlan
} from '../../shared/schema';

export interface IStorage {
  // Session store
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByCPF(cpf: string): Promise<User | undefined>;
  getUserBySessionId(sessionId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  getUsersByRole(role: "patient" | "partner" | "admin" | "doctor"): Promise<User[]>;
  updateUserPassword(id: number, password: string): Promise<User>;
  
  // Password reset
  savePasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: number): Promise<void>;
  
  // Email verification
  saveVerificationToken(userId: number, token: string): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyUserEmail(userId: number): Promise<void>;
  createEmailVerification(verification: { userId: number, token: string, expiresAt: Date }): Promise<void>;
  getEmailVerificationByToken(token: string): Promise<EmailVerification | undefined>;
  deleteEmailVerification(id: number): Promise<void>;
  deleteEmailVerificationsByUserId(userId: number): Promise<void>;
  
  // Password reset
  createPasswordReset(reset: { userId: number, token: string, expiresAt: Date }): Promise<void>;
  getPasswordResetByToken(token: string): Promise<PasswordReset | undefined>;
  deletePasswordReset(id: number): Promise<void>;
  deletePasswordResetsByUserId(userId: number): Promise<void>;
  
  // QR Code authentication
  generateQrToken(userId: number): Promise<{ token: string, expiresAt: Date }>;
  validateQrToken(token: string): Promise<{ userId: number, expiresAt: Date } | undefined>;
  invalidateQrToken(token: string): Promise<void>;
  
  // Dependents
  getDependents(userId: number): Promise<Dependent[]>;
  getDependent(id: number): Promise<Dependent | null>;
  getDependentsByUserId(userId: number): Promise<Dependent[]>;
  getDependentByCpf(cpf: string): Promise<Dependent | null>;
  createDependent(dependent: InsertDependent): Promise<Dependent>;
  updateDependent(id: number, dependent: Partial<InsertDependent>): Promise<Dependent | null>;
  deleteDependent(id: number): Promise<boolean>;
  
  // Partners
  getPartners(): Promise<Partner[]>;
  getPartner(id: number): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: number, data: Partial<InsertPartner>): Promise<Partner>;
  deletePartner(id: number): Promise<void>;
  
  // Audit logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(userId: number): Promise<AuditLog[]>;
  getAuditLog(id: number): Promise<AuditLog | undefined>;
  deleteAuditLog(id: number): Promise<void>;
  deleteAuditLogsByUserId(userId: number): Promise<void>;
} 