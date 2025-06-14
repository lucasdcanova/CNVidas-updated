import { users, partners, doctors, partnerServices, appointments, claims, notifications, doctorPayments, auditLogs, qrTokens, subscriptionPlans, userSettings, emailVerifications, passwordResets, availabilitySlots, qrAuthLogs, dependents, partnerAddresses, medicalRecords, medicalRecordEntries, medicalRecordAccess } from '../shared/schema';
import { User, Partner, Doctor, PartnerService, Appointment, Claim, Notification, DoctorPayment, AuditLog, QrToken, SubscriptionPlan, UserSettings, EmailVerification, PasswordReset, AvailabilitySlot, QrAuthLog, InsertUser, InsertPartner, InsertDoctor, InsertPartnerService, InsertAppointment, InsertClaim, InsertNotification, InsertDoctorPayment, InsertAuditLog, InsertQrToken, InsertSubscriptionPlan, InsertUserSettings, InsertEmailVerification, InsertPasswordReset, InsertAvailabilitySlot, InsertQrAuthLog, Dependent, InsertDependent, MedicalRecord, InsertMedicalRecord, MedicalRecordEntry, InsertMedicalRecordEntry, MedicalRecordAccess, InsertMedicalRecordAccess } from '@shared/types';
import { PartnerAddress, InsertPartnerAddress } from './interfaces/partner';
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, count, or, gt, asc, inArray, ne } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { randomBytes } from "crypto";
import { normalizeObjectKeys } from './utils/normalize';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ExpressUser } from '../shared/types';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AppError } from './utils/app-error';
import { toUserId } from './utils/id-converter';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from './types';
import { getDistanceBetweenCities } from './utils/location-utils';

const PostgresSessionStore = connectPg(session);

// Create session table SQL statement
const createSessionTableSQL = `
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

// Create session table if it doesn't exist
(async () => {
  try {
    await pool.query(createSessionTableSQL);
    console.log('Session table checked/created successfully');
  } catch (error) {
    console.error('Error creating session table:', error);
  }
})();

// Função utilitária para normalizar campos opcionais para null
function normalizeNull<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
  const copy = { ...obj };
  for (const field of fields) {
    if (copy[field] === undefined || copy[field] === null) {
      copy[field] = null as any;
    }
  }
  return copy;
}

// Define the storage interface
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
  getUsersWithProfileImages(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User>;
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
  getUserByQrToken(token: string): Promise<User | undefined>;
  logQrAuthentication(logData: Omit<InsertQrAuthLog, 'qrTokenId'> & { token: string }): Promise<QrAuthLog>;
  getQrAuthLogs(limit?: number, offset?: number): Promise<(QrAuthLog & { 
    scannerName: string, 
    tokenUserName: string 
  })[]>;
  
  // Availability slot methods
  getDoctorAvailabilitySlots(doctorId: number): Promise<AvailabilitySlot[]>;
  saveDoctorAvailabilitySlots(slots: InsertAvailabilitySlot[]): Promise<AvailabilitySlot[]>;
  
  // Stripe integration
  updateStripeCustomerId(userId: number, customerId: string): Promise<User>;
  updateUserStripeInfo(userId: number, data: { customerId: string, subscriptionId: string }): Promise<User>;
  
  // Partner methods
  getPartner(id: number): Promise<Partner | undefined>;
  getPartnerByUserId(userId: number): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: number, data: Partial<InsertPartner>): Promise<Partner>;
  getAllPartners(): Promise<Partner[]>;
  deletePartner(id: number): Promise<void>;
  
  // Partner Address methods
  getPartnerAddresses(partnerId: number): Promise<PartnerAddress[]>;
  getPartnerAddress(id: number): Promise<PartnerAddress | undefined>;
  createPartnerAddress(address: InsertPartnerAddress): Promise<PartnerAddress>;
  updatePartnerAddress(id: number, data: Partial<InsertPartnerAddress>): Promise<PartnerAddress>;
  deletePartnerAddress(id: number): Promise<void>;
  setPartnerAddressPrimary(partnerId: number, addressId: number): Promise<void>;
  
  // Doctor methods
  getDoctor(id: number): Promise<Doctor | undefined>;
  getDoctorByUserId(userId: number): Promise<Doctor | undefined>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  updateDoctor(id: number, data: Partial<InsertDoctor>): Promise<Doctor>;
  getAllDoctors(): Promise<Doctor[]>;
  getAvailableDoctors(): Promise<Doctor[]>;
  toggleDoctorAvailability(id: number, available: boolean): Promise<Doctor>;
  getDoctorAppointments(doctorId: number, startDate: Date, endDate: Date): Promise<Appointment[]>;
  
  // Partner Service methods
  getPartnerService(id: number): Promise<PartnerService | undefined>;
  getPartnerServicesByPartnerId(partnerId: number): Promise<PartnerService[]>;
  createPartnerService(service: InsertPartnerService): Promise<PartnerService>;
  updatePartnerService(id: number, data: Partial<InsertPartnerService>): Promise<PartnerService>;
  deletePartnerService(id: number): Promise<void>;
  getFeaturedServices(limit?: number): Promise<PartnerService[]>;
  
  // Aliases for admin routes compatibility
  getService(id: number): Promise<PartnerService | undefined>;
  updateService(id: number, data: Partial<InsertPartnerService>): Promise<PartnerService>;
  getAllServices(): Promise<PartnerService[]>;
  
  // Services with location filtering
  getServicesWithLocationFilter(userCity?: string, maxDistance?: number): Promise<PartnerService[]>;
  
  // Appointment methods
  getAppointment(id: number): Promise<Appointment | null>;
  getAppointmentById(id: number): Promise<Appointment | null>;
  getUserAppointments(userId: number): Promise<Appointment[]>;
  getUpcomingAppointments(userId: number): Promise<Appointment[]>;
  getUpcomingAppointmentsWithDoctorInfo(userId: number): Promise<any[]>;
  getPartnerAppointments(partnerId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment>;
  getLatestEmergencyConsultation(): Promise<Appointment | undefined>;
  
  // Claim methods
  getClaim(id: number): Promise<Claim | undefined>;
  getUserClaims(userId: number): Promise<Claim[]>;
  getAllClaims(): Promise<Claim[]>;
  getPendingClaims(): Promise<Claim[]>;
  createClaim(claim: InsertClaim, documents: string[]): Promise<Claim>;
  updateClaim(id: number, data: Partial<Claim>): Promise<Claim>;
  deleteClaim(id: number): Promise<boolean>;
  
  // Notification methods
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  
  // User Settings
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  saveUserSettings(userId: number, settings: Partial<{ notifications: any, privacy: any }>): Promise<UserSettings>;

  // Admin methods
  getAllUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
  getUserCountByRole(role: "patient" | "partner" | "admin" | "doctor"): Promise<number>;
  getAppointmentCount(): Promise<number>;
  getPendingClaimsCount(): Promise<number>;
  getRecentUsers(limit: number): Promise<User[]>;
  getRecentAppointments(limit: number): Promise<Appointment[]>;
  getAllPartnerServices(): Promise<PartnerService[]>;
  getAllAppointments(): Promise<Appointment[]>;
  
  // Doctor Finance methods
  updateDoctorPaymentInfo(doctorId: number, paymentInfo: { 
    pixKeyType?: string,
    pixKey?: string, 
    bankName?: string, 
    accountType?: string 
  }): Promise<Doctor>;
  
  getDoctorPayments(doctorId: number, startDate?: Date, endDate?: Date): Promise<DoctorPayment[]>;
  
  calculateDoctorEarnings(doctorId: number, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    pending: number;
    paid: number;
    paymentCount: number;
  }>;

  getAppointmentWithPatientInfo(id: number): Promise<Appointment & { patientName?: string | null, patientEmail?: string | null }>;

  getPlanById(id: number): Promise<SubscriptionPlan | undefined>;
  getPlans(): Promise<SubscriptionPlan[]>;
  createPlan(planData: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updatePlan(id: number, planData: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan>;
  deletePlan(id: number): Promise<void>;

  // Adicionar métodos faltantes para dependentes
  getDependentsByUserId(userId: number): Promise<Dependent[]>;
  getDependentByCpf(cpf: string): Promise<Dependent | null>;
  createDependent(dependent: InsertDependent): Promise<Dependent>;
  getDependent(id: number): Promise<Dependent | null>;
  updateDependent(id: number, data: Partial<InsertDependent>): Promise<Dependent | null>;
  deleteDependent(id: number): Promise<boolean>;

  // Adicionar métodos faltantes para agendamentos
  cancelAppointment(id: number, reason: string): Promise<Appointment>;
  deleteAppointment(id: number): Promise<void>;
  getUserIdByDoctorId(doctorId: number): Promise<number | undefined>;
  getAppointmentsForPaymentProcessing(startTime: Date, endTime: Date): Promise<Appointment[]>;
  getCancelledAppointmentsWithPendingPayment(): Promise<Appointment[]>;

  getUserByToken(token: string): Promise<ExpressUser | null>;
  getCurrentSubscription(userId: number): Promise<any>;
  createAuditLog(entry: {
    userId?: number;
    action: string;
    ip: string;
    userAgent: string;
    details: Record<string, any>;
    timestamp: Date;
  }): Promise<void>;
  getUserAuditLogs(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<any[]>;
}

// Implement the storage interface with a database storage
export class DatabaseStorage implements IStorage {
  private db;
  public sessionStore: session.Store;
  private prisma: PrismaClient;

  constructor() {
    this.db = db;
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session'
    });
    this.prisma = new PrismaClient();
  }

  // QR Code authentication methods
  async generateQrToken(userId: number): Promise<{ token: string, expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    await this.db.insert(qrTokens).values({ userId, token, expiresAt });
    return { token, expiresAt };
  }

  async getUserByQrToken(token: string): Promise<User | undefined> {
    const [qrToken] = await this.db.select().from(qrTokens).where(eq(qrTokens.token, token));
    if (!qrToken || new Date() > qrToken.expiresAt) {
      return undefined;
    }
    return this.getUser(qrToken.userId);
  }

  async logQrAuthentication(logData: Omit<InsertQrAuthLog, 'qrTokenId'> & { token: string }): Promise<QrAuthLog> {
    const [qrToken] = await this.db.select().from(qrTokens).where(eq(qrTokens.token, logData.token));
    if (!qrToken) {
      throw new Error('QR token not found');
    }
    const [log] = await this.db.insert(qrAuthLogs).values({
      ...logData,
      qrTokenId: qrToken.id
    }).returning();
    return log;
  }

  async getQrAuthLogs(limit?: number, offset?: number): Promise<(QrAuthLog & { scannerName: string, tokenUserName: string })[]> {
    const logs = await this.db.select({
      id: qrAuthLogs.id,
      qrTokenId: qrAuthLogs.qrTokenId,
      scannerUserId: qrAuthLogs.scannerUserId,
      tokenUserId: qrAuthLogs.tokenUserId,
      scannedAt: qrAuthLogs.scannedAt,
      ipAddress: qrAuthLogs.ipAddress,
      userAgent: qrAuthLogs.userAgent,
      success: qrAuthLogs.success,
      scannerName: users.fullName,
      tokenUserName: users.fullName
    })
    .from(qrAuthLogs)
    .leftJoin(qrTokens, eq(qrAuthLogs.qrTokenId, qrTokens.id))
    .leftJoin(users, eq(qrTokens.userId, users.id))
    .limit(limit || 50)
    .offset(offset || 0);
    return logs.map(log => ({
      ...log,
      scannerName: log.scannerName ?? '',
      tokenUserName: log.tokenUserName ?? ''
    })) as (QrAuthLog & { scannerName: string, tokenUserName: string })[];
  }

  // Availability slot methods
  async getDoctorAvailabilitySlots(doctorId: number): Promise<AvailabilitySlot[]> {
    return this.db.select().from(availabilitySlots).where(eq(availabilitySlots.doctorId, doctorId));
  }

  async saveDoctorAvailabilitySlots(slots: InsertAvailabilitySlot[]): Promise<AvailabilitySlot[]> {
    // Get the doctorId from the first slot (all should have the same doctorId)
    if (slots.length === 0) {
      return [];
    }
    
    const doctorId = slots[0].doctorId;
    
    // Delete existing slots for this doctor in a transaction
    await this.db.transaction(async (tx) => {
      await tx.delete(availabilitySlots).where(eq(availabilitySlots.doctorId, doctorId));
    });
    
    // Insert new slots
    const result = await this.db.insert(availabilitySlots).values(slots).returning();
    return Array.isArray(result) ? result : [result];
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: number): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async getUserByCPF(cpf: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.cpf, cpf));
    return user;
  }

  async getUserBySessionId(sessionId: string): Promise<User | undefined> {
    return new Promise((resolve) => {
      this.sessionStore.get(sessionId, async (err, sessionData) => {
        if (err || !sessionData || !(sessionData as any).userId) {
          resolve(undefined);
          return;
        }
        const userId = Number((sessionData as any).userId);
        const user = await this.getUserById(userId);
        resolve(user || undefined);
      });
    });
  }

  async getUsersWithProfileImages(): Promise<User[]> {
    const result = await this.db.select().from(users).where(
      and(
        sql`${users.profileImage} IS NOT NULL`,
        sql`${users.profileImage} != ''`
      )
    );
    return result;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User> {
    const [user] = await this.db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      console.log(`🗑️ Tentando excluir usuário ID: ${id}`);
      
      // Verificar se o usuário existe primeiro
      const existingUser = await this.getUser(id);
      if (!existingUser) {
        console.log(`❌ Usuário ID ${id} não encontrado`);
        return false;
      }
      
      console.log(`✅ Usuário encontrado: ${existingUser.fullName} (${existingUser.email})`);
      
      // Excluir o usuário
      const [user] = await this.db.delete(users)
        .where(eq(users.id, id))
        .returning();
      
      if (user) {
        console.log(`✅ Usuário ID ${id} excluído com sucesso`);
        return true;
      } else {
        console.log(`❌ Falha ao excluir usuário ID ${id}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Erro ao excluir usuário ID ${id}:`, error);
      throw error;
    }
  }

  async getUsersByRole(role: "patient" | "partner" | "admin" | "doctor"): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.role, role));
  }

  async updateUserPassword(id: number, password: string): Promise<User> {
    const [user] = await this.db.update(users)
      .set({ password })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return user;
  }

  // Password reset methods
  async createPasswordReset(reset: { userId: number, token: string, expiresAt: Date }): Promise<void> {
    await this.db.insert(passwordResets).values(reset);
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | undefined> {
    const [reset] = await this.db.select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token));
    return reset;
  }

  async deletePasswordReset(id: number): Promise<void> {
    await this.db.delete(passwordResets).where(eq(passwordResets.id, id));
  }

  async deletePasswordResetsByUserId(userId: number): Promise<void> {
    await this.db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  }

  async savePasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await this.createPasswordReset({ userId, token, expiresAt });
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const reset = await this.getPasswordResetByToken(token);
    if (!reset) return undefined;
    return this.getUser(reset.userId);
  }

  async clearPasswordResetToken(userId: number): Promise<void> {
    await this.deletePasswordResetsByUserId(userId);
  }

  // Email verification methods
  async createEmailVerification(verification: { userId: number, token: string, expiresAt: Date }): Promise<void> {
    await this.db.insert(emailVerifications).values(verification);
  }

  async getEmailVerificationByToken(token: string): Promise<EmailVerification | undefined> {
    const [verification] = await this.db.select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token));
    return verification;
  }

  async deleteEmailVerification(id: number): Promise<void> {
    await this.db.delete(emailVerifications).where(eq(emailVerifications.id, id));
  }

  async deleteEmailVerificationsByUserId(userId: number): Promise<void> {
    await this.db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));
  }

  async saveVerificationToken(userId: number, token: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    await this.createEmailVerification({ userId, token, expiresAt });
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const verification = await this.getEmailVerificationByToken(token);
    if (!verification) return undefined;
    return this.getUser(verification.userId);
  }

  async verifyUserEmail(userId: number): Promise<void> {
    await this.db.update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Stripe integration methods
  async updateStripeCustomerId(userId: number, customerId: string): Promise<User> {
    const [user] = await this.db.update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user as User;
  }

  async updateUserStripeInfo(userId: number, data: { customerId: string, subscriptionId: string }): Promise<User> {
    const [user] = await this.db.update(users)
      .set({ 
        stripeCustomerId: data.customerId,
        stripeSubscriptionId: data.subscriptionId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user as User;
  }

  // Partner methods
  async getPartner(id: number): Promise<Partner | undefined> {
    const [partner] = await this.db.select().from(partners).where(eq(partners.id, id));
    return partner as Partner;
  }

  async getPartnerByUserId(userId: number): Promise<Partner | undefined> {
    const [partner] = await this.db.select().from(partners).where(eq(partners.userId, userId));
    return partner as Partner;
  }

  async createPartner(partnerData: InsertPartner): Promise<Partner> {
    const [partner] = await this.db.insert(partners).values(partnerData).returning();
    return partner as Partner;
  }

  async updatePartner(id: number, data: Partial<InsertPartner>): Promise<Partner> {
    const [partner] = await this.db.update(partners)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();
    return partner as Partner;
  }

  async deletePartner(id: number): Promise<void> {
    await this.db.delete(partners).where(eq(partners.id, id));
  }

  async getAllPartners(): Promise<Partner[]> {
    return this.db.select().from(partners);
  }

  // Partner Address methods
  async getPartnerAddresses(partnerId: number): Promise<PartnerAddress[]> {
    const addresses = await this.db.select()
      .from(partnerAddresses)
      .where(eq(partnerAddresses.partnerId, partnerId))
      .orderBy(desc(partnerAddresses.isPrimary), asc(partnerAddresses.name));
    return addresses as PartnerAddress[];
  }

  async getPartnerAddress(id: number): Promise<PartnerAddress | undefined> {
    const [address] = await this.db.select()
      .from(partnerAddresses)
      .where(eq(partnerAddresses.id, id));
    return address as PartnerAddress | undefined;
  }

  async createPartnerAddress(addressData: InsertPartnerAddress): Promise<PartnerAddress> {
    // Se este for o primeiro endereço ou marcado como principal, garantir que seja o único principal
    if (addressData.isPrimary) {
      await this.db.update(partnerAddresses)
        .set({ isPrimary: false })
        .where(eq(partnerAddresses.partnerId, addressData.partnerId));
    }
    
    const [address] = await this.db.insert(partnerAddresses)
      .values(addressData)
      .returning();
    return address as PartnerAddress;
  }

  async updatePartnerAddress(id: number, data: Partial<InsertPartnerAddress>): Promise<PartnerAddress> {
    // Se estiver atualizando para principal, garantir que seja o único
    if (data.isPrimary) {
      const [existingAddress] = await this.db.select()
        .from(partnerAddresses)
        .where(eq(partnerAddresses.id, id));
      
      if (existingAddress) {
        await this.db.update(partnerAddresses)
          .set({ isPrimary: false })
          .where(and(
            eq(partnerAddresses.partnerId, existingAddress.partnerId),
            sql`${partnerAddresses.id} != ${id}`
          ));
      }
    }
    
    const [address] = await this.db.update(partnerAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnerAddresses.id, id))
      .returning();
    return address as PartnerAddress;
  }

  async deletePartnerAddress(id: number): Promise<void> {
    await this.db.delete(partnerAddresses).where(eq(partnerAddresses.id, id));
  }

  async setPartnerAddressPrimary(partnerId: number, addressId: number): Promise<void> {
    // Primeiro, desmarcar todos como principal
    await this.db.update(partnerAddresses)
      .set({ isPrimary: false })
      .where(eq(partnerAddresses.partnerId, partnerId));
    
    // Depois, marcar o específico como principal
    await this.db.update(partnerAddresses)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(partnerAddresses.id, addressId));
  }

  // Doctor methods
  async getDoctor(id: number): Promise<Doctor | undefined> {
    const [doctor] = await this.db.select().from(doctors).where(eq(doctors.id, id));
    return doctor;
  }

  async getDoctorByUserId(userId: number): Promise<Doctor | undefined> {
    const result = await this.db.select({
      id: doctors.id,
      userId: doctors.userId,
      specialization: doctors.specialization,
      licenseNumber: doctors.licenseNumber,
      biography: doctors.biography,
      education: doctors.education,
      experienceYears: doctors.experienceYears,
      availableForEmergency: doctors.availableForEmergency,
      consultationFee: doctors.consultationFee,
      profileImage: sql<string>`COALESCE(${doctors.profileImage}, ${users.profileImage})`.as('profileImage'),
      status: doctors.status,
      welcomeCompleted: doctors.welcomeCompleted,
      pixKeyType: doctors.pixKeyType,
      pixKey: doctors.pixKey,
      bankName: doctors.bankName,
      accountType: doctors.accountType,
      createdAt: doctors.createdAt,
      updatedAt: doctors.updatedAt,
      name: users.fullName
    })
    .from(doctors)
    .leftJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.userId, userId))
    .limit(1);
    
    return result[0] as Doctor | undefined;
  }

  async createDoctor(doctorData: InsertDoctor): Promise<Doctor> {
    const [doctor] = await this.db.insert(doctors).values(doctorData).returning();
    return doctor as Doctor;
  }

  async updateDoctor(id: number, data: Partial<InsertDoctor>): Promise<Doctor> {
    const [doctor] = await this.db.update(doctors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(doctors.id, id))
      .returning();
    return doctor as Doctor;
  }

  async getAllDoctors(): Promise<Doctor[]> {
    const result = await this.db.select({
      id: doctors.id,
      userId: doctors.userId,
      specialization: doctors.specialization,
      licenseNumber: doctors.licenseNumber,
      biography: doctors.biography,
      education: doctors.education,
      experienceYears: doctors.experienceYears,
      availableForEmergency: doctors.availableForEmergency,
      consultationFee: doctors.consultationFee,
      profileImage: sql<string>`COALESCE(${doctors.profileImage}, ${users.profileImage})`.as('profileImage'),
      status: doctors.status,
      createdAt: doctors.createdAt,
      updatedAt: doctors.updatedAt,
      name: users.fullName,
      username: users.username,
      email: users.email
    })
    .from(doctors)
    .leftJoin(users, eq(doctors.userId, users.id));
    
    return result as Doctor[];
  }

  async getAvailableDoctors(): Promise<Doctor[]> {
    const result = await this.db.select({
      id: doctors.id,
      userId: doctors.userId,
      specialization: doctors.specialization,
      licenseNumber: doctors.licenseNumber,
      biography: doctors.biography,
      education: doctors.education,
      experienceYears: doctors.experienceYears,
      availableForEmergency: doctors.availableForEmergency,
      consultationFee: doctors.consultationFee,
      profileImage: sql<string>`COALESCE(${doctors.profileImage}, ${users.profileImage})`.as('profileImage'),
      status: doctors.status,
      createdAt: doctors.createdAt,
      updatedAt: doctors.updatedAt,
      name: users.fullName,
      username: users.username,
      email: users.email
    })
    .from(doctors)
    .leftJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.availableForEmergency, true));
    
    return result as Doctor[];
  }

  async toggleDoctorAvailability(id: number, available: boolean): Promise<Doctor> {
    const [doctor] = await this.db.update(doctors)
      .set({ availableForEmergency: available, updatedAt: new Date() })
      .where(eq(doctors.id, id))
      .returning();
    return doctor as Doctor;
  }

  async getDoctorAppointments(doctorId: number, startDate: Date, endDate: Date): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.date, startDate),
          lte(appointments.date, endDate)
        )
      );
  }

  // Partner Service methods
  async getPartnerService(id: number): Promise<PartnerService | undefined> {
    const [service] = await this.db.select().from(partnerServices).where(eq(partnerServices.id, id));
    return service as PartnerService;
  }

  async getPartnerServicesByPartnerId(partnerId: number): Promise<PartnerService[]> {
    const results = await this.db
      .select({
        service: partnerServices,
        partner: partners,
        user: users
      })
      .from(partnerServices)
      .leftJoin(partners, eq(partnerServices.partnerId, partners.id))
      .leftJoin(users, eq(partners.userId, users.id))
      .where(eq(partnerServices.partnerId, partnerId));
    
    return results.map(result => {
      // Ensure serviceImage URL is properly formatted
      const serviceImage = result.service.serviceImage || null;
      
      return {
        ...result.service,
        serviceImage,
        partner: result.partner ? {
          ...result.partner,
          profileImage: result.user?.profileImage || null,
          phone: result.partner.phone || null,
          name: result.partner.businessName || result.partner.tradingName || null
        } : null
      };
    }) as any[];
  }

  async createPartnerService(serviceData: InsertPartnerService): Promise<PartnerService> {
    const [service] = await this.db.insert(partnerServices).values(serviceData).returning();
    return service as PartnerService;
  }

  async updatePartnerService(id: number, data: Partial<InsertPartnerService>): Promise<PartnerService> {
    const [service] = await this.db.update(partnerServices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnerServices.id, id))
      .returning();
    return service as PartnerService;
  }

  async deletePartnerService(id: number): Promise<void> {
    await this.db.delete(partnerServices).where(eq(partnerServices.id, id));
  }

  async getFeaturedServices(limit: number = 6): Promise<PartnerService[]> {
    const results = await this.db
      .select({
        service: partnerServices,
        partner: partners,
        user: users
      })
      .from(partnerServices)
      .leftJoin(partners, eq(partnerServices.partnerId, partners.id))
      .leftJoin(users, eq(partners.userId, users.id))
      .where(eq(partnerServices.isFeatured, true))
      .limit(limit);
    
    return results.map(result => {
      // Ensure serviceImage URL is properly formatted
      const serviceImage = result.service.serviceImage || null;
      
      return {
        ...result.service,
        serviceImage,
        partner: result.partner ? {
          ...result.partner,
          profileImage: result.user?.profileImage || null,
          phone: result.partner.phone || null,
          name: result.partner.businessName || result.partner.tradingName || null
        } : null
      };
    }) as any[];
  }

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | null> {
    const [appointment] = await this.db.select().from(appointments).where(eq(appointments.id, id));
    return appointment as Appointment || null;
  }
  
  // Alias para compatibilidade
  async getAppointmentById(id: number): Promise<Appointment | null> {
    return this.getAppointment(id);
  }

  async getUserAppointments(userId: number): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .where(eq(appointments.userId, userId))
      .orderBy(desc(appointments.date));
  }

  async getUpcomingAppointments(userId: number): Promise<Appointment[]> {
    const now = new Date();
    return this.db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.userId, userId),
          gte(appointments.date, now)
        )
      )
      .orderBy(asc(appointments.date));
  }

  async getUpcomingAppointmentsWithDoctorInfo(userId: number): Promise<any[]> {
    const now = new Date();
    
    // Primeiro, buscar todas as consultas do usuário para debug
    const allUserAppointments = await this.db.select({
      id: appointments.id,
      status: appointments.status,
      date: appointments.date
    })
    .from(appointments)
    .where(eq(appointments.userId, userId));
    
    console.log(`Total de consultas encontradas para usuário ${userId}: ${allUserAppointments.length}`);
    
    // Logar detalhes de cada consulta
    allUserAppointments.forEach(apt => {
      console.log(`Consulta ID: ${apt.id}, Status: ${apt.status}, Date: ${apt.date.toISOString()}`);
    });
    
    // Agora buscar com os filtros aplicados
    const result = await this.db.select({
      // Dados do appointment
      id: appointments.id,
      userId: appointments.userId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      duration: appointments.duration,
      status: appointments.status,
      notes: appointments.notes,
      type: appointments.type,
      isEmergency: appointments.isEmergency,
      telemedRoomName: appointments.telemedRoomName,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      // Dados do médico
      doctorName: users.fullName,
      doctorEmail: users.email,
      doctorProfileImage: doctors.profileImage,
      specialization: doctors.specialization,
      consultationFee: doctors.consultationFee,
      availableForEmergency: doctors.availableForEmergency
    })
    .from(appointments)
    .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(users, eq(doctors.userId, users.id))
    .where(
      and(
        eq(appointments.userId, userId),
        gte(appointments.date, now),
        ne(appointments.status, 'cancelled')
      )
    )
    .orderBy(asc(appointments.date));
    
    console.log(`Consultas após filtrar canceladas: ${result.length}`);
    
    return result;
  }

  async getPartnerAppointments(partnerId: number): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .where(eq(appointments.partnerId, partnerId))
      .orderBy(desc(appointments.date));
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [result] = await this.db.insert(appointments).values(appointment).returning();
    return result as Appointment;
  }

  async updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment> {
    const [appointment] = await this.db.update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return appointment as Appointment;
  }

  async getLatestEmergencyConsultation(): Promise<Appointment | undefined> {
    const [appointment] = await this.db.select()
      .from(appointments)
      .where(eq(appointments.isEmergency, true))
      .orderBy(desc(appointments.date))
      .limit(1);
    return appointment as Appointment || undefined;
  }

  async getAppointmentsByDoctorIdAndDateRange(doctorId: number, startDate: Date, endDate: Date): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.date, startDate),
          lte(appointments.date, endDate)
        )
      )
      .orderBy(desc(appointments.date));
  }

  // Claim methods
  async getClaim(id: number): Promise<Claim | undefined> {
    const [claim] = await this.db.select().from(claims).where(eq(claims.id, id));
    return claim as Claim || undefined;
  }

  async getUserClaims(userId: number): Promise<Claim[]> {
    return this.db.select()
      .from(claims)
      .where(eq(claims.userId, userId))
      .orderBy(desc(claims.createdAt));
  }

  async getAllClaims(): Promise<Claim[]> {
    return this.db.select().from(claims).orderBy(desc(claims.createdAt));
  }

  async getPendingClaims(): Promise<Claim[]> {
    return this.db.select()
      .from(claims)
      .where(eq(claims.status, 'pending'))
      .orderBy(desc(claims.createdAt));
  }

  async createClaim(claim: InsertClaim, documents: string[]): Promise<Claim> {
    const [result] = await this.db.insert(claims)
      .values({ ...claim, documents })
      .returning();
    return result as Claim;
  }

  async updateClaim(id: number, data: Partial<Claim>): Promise<Claim> {
    const [claim] = await this.db.update(claims)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return claim as Claim;
  }

  async deleteClaim(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(claims)
        .where(eq(claims.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting claim:', error);
      return false;
    }
  }

  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return this.db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    return result[0].count;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await this.db.insert(notifications).values(notification).returning();
    return result as Notification;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await this.db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await this.db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // User Settings methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    const [settings] = await this.db.select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings as UserSettings || undefined;
  }

  async saveUserSettings(userId: number, settings: Partial<{ notifications: any, privacy: any }>): Promise<UserSettings> {
    const existingSettings = await this.getUserSettings(userId);
    if (existingSettings) {
      // Merge existing settings with new settings to avoid overwriting fields
      const mergedSettings: any = {};
      
      if (settings.notifications) {
        mergedSettings.notifications = {
          ...(existingSettings.notifications || {}),
          ...settings.notifications
        };
      }
      
      if (settings.privacy) {
        mergedSettings.privacy = {
          ...(existingSettings.privacy || {}),
          ...settings.privacy
        };
      }
      
      const [updated] = await this.db.update(userSettings)
        .set({ ...mergedSettings, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return updated as UserSettings;
    } else {
      const [created] = await this.db.insert(userSettings)
        .values({ userId, ...settings })
        .returning();
      return created as UserSettings;
    }
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(users);
  }

  async getUserCount(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(users);
    return result[0].count;
  }

  async getUserCountByRole(role: "patient" | "partner" | "admin" | "doctor"): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, role));
    return result[0].count;
  }

  async countUsersBySeller(sellerName: string): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.sellerName, sellerName));
    return result[0].count;
  }

  async getAppointmentCount(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(appointments);
    return result[0].count;
  }

  async getPendingClaimsCount(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(eq(claims.status, 'pending'));
    return result[0].count;
  }

  async getRecentUsers(limit: number): Promise<User[]> {
    return this.db.select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
  }

  async getRecentAppointments(limit: number): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .orderBy(desc(appointments.createdAt))
      .limit(limit);
  }

  async getAllPartnerServices(): Promise<PartnerService[]> {
    const results = await this.db
      .select({
        service: partnerServices,
        partner: partners,
        user: users
      })
      .from(partnerServices)
      .leftJoin(partners, eq(partnerServices.partnerId, partners.id))
      .leftJoin(users, eq(partners.userId, users.id));
    
    return results.map(result => {
      // Ensure serviceImage URL is properly formatted
      const serviceImage = result.service.serviceImage || null;
      
      return {
        ...result.service,
        serviceImage,
        partner: result.partner ? {
          ...result.partner,
          profileImage: result.user?.profileImage || null,
          phone: result.partner.phone || null,
          name: result.partner.businessName || result.partner.tradingName || null
        } : null
      };
    }) as any[];
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return this.db.select().from(appointments);
  }

  // Doctor Finance methods
  async updateDoctorPaymentInfo(doctorId: number, paymentInfo: { 
    pixKeyType?: string,
    pixKey?: string, 
    bankName?: string, 
    accountType?: string 
  }): Promise<Doctor> {
    const [doctor] = await this.db.update(doctors)
      .set({ ...paymentInfo, updatedAt: new Date() })
      .where(eq(doctors.id, doctorId))
      .returning();
    return doctor as Doctor;
  }

  async getDoctorPayments(doctorId: number, startDate?: Date, endDate?: Date): Promise<DoctorPayment[]> {
    const conditions = [eq(doctorPayments.doctorId, doctorId)];
    if (startDate) conditions.push(gte(doctorPayments.createdAt, startDate));
    if (endDate) conditions.push(lte(doctorPayments.createdAt, endDate));
    return this.db.select()
      .from(doctorPayments)
      .where(and(...conditions))
      .orderBy(desc(doctorPayments.createdAt));
  }

  async calculateDoctorEarnings(doctorId: number, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    pending: number;
    paid: number;
    paymentCount: number;
  }> {
    const conditions = [eq(doctorPayments.doctorId, doctorId)];
    if (startDate) conditions.push(gte(doctorPayments.createdAt, startDate));
    if (endDate) conditions.push(lte(doctorPayments.createdAt, endDate));
    const [result] = await this.db.select({
      total: sql<number>`sum(${doctorPayments.amount})`,
      pending: sql<number>`sum(case when ${doctorPayments.status} = 'pending' then ${doctorPayments.amount} else 0 end)`,
      paid: sql<number>`sum(case when ${doctorPayments.status} = 'paid' then ${doctorPayments.amount} else 0 end)`,
      paymentCount: sql<number>`count(*)`
    })
    .from(doctorPayments)
    .where(and(...conditions));
    return {
      total: result.total || 0,
      pending: result.pending || 0,
      paid: result.paid || 0,
      paymentCount: result.paymentCount
    };
  }

  async getAppointmentWithPatientInfo(id: number): Promise<Appointment & { patientName?: string | null, patientEmail?: string | null }> {
    const [appointment] = await this.db.select({
      id: appointments.id,
      userId: appointments.userId,
      serviceId: appointments.serviceId,
      partnerId: appointments.partnerId,
      doctorId: appointments.doctorId,
      type: appointments.type,
      date: appointments.date,
      duration: appointments.duration,
      status: appointments.status,
      notes: appointments.notes,
      doctorName: appointments.doctorName,
      specialization: appointments.specialization,
      telemedProvider: appointments.telemedProvider,
      telemedLink: appointments.telemedLink,
      telemedRoomName: appointments.telemedRoomName,
      isEmergency: appointments.isEmergency,
      paymentIntentId: appointments.paymentIntentId,
      paymentStatus: appointments.paymentStatus,
      paymentAmount: appointments.paymentAmount,
      paymentFee: appointments.paymentFee,
      paymentCapturedAt: appointments.paymentCapturedAt,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      patientName: users.fullName,
      patientEmail: users.email
    })
    .from(appointments)
    .leftJoin(users, eq(appointments.userId, users.id))
    .where(eq(appointments.id, id));
    return appointment as Appointment & { patientName?: string | null, patientEmail?: string | null };
  }

  // Subscription Plan methods
  async getPlanById(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await this.db.select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id));
    return plan as SubscriptionPlan || undefined;
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.db.select().from(subscriptionPlans);
  }

  async createPlan(planData: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [plan] = await this.db.insert(subscriptionPlans)
      .values(planData)
      .returning();
    return plan as SubscriptionPlan;
  }

  async updatePlan(id: number, planData: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan> {
    const [plan] = await this.db.update(subscriptionPlans)
      .set({ ...planData, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return plan as SubscriptionPlan;
  }

  async deletePlan(id: number): Promise<void> {
    await this.db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  // Adicionar métodos faltantes para dependentes
  async getDependentsByUserId(userId: number): Promise<Dependent[]> {
    const result = await this.db.select().from(dependents).where(eq(dependents.userId, userId));
    return result;
  }

  async getDependentByCpf(cpf: string): Promise<Dependent | null> {
    const result = await this.db.select().from(dependents).where(eq(dependents.cpf, cpf));
    return result[0] || null;
  }

  async createDependent(dependent: InsertDependent): Promise<Dependent> {
    const result = await this.db.insert(dependents).values(dependent).returning();
    return result[0];
  }

  async getDependent(id: number): Promise<Dependent | null> {
    const result = await this.db.select().from(dependents).where(eq(dependents.id, id));
    return result[0] || null;
  }

  async updateDependent(id: number, data: Partial<InsertDependent>): Promise<Dependent | null> {
    const result = await this.db
      .update(dependents)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(dependents.id, id))
      .returning();
    return result[0] || null;
  }

  async deleteDependent(id: number): Promise<boolean> {
    try {
      await this.db.delete(dependents).where(eq(dependents.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting dependent:', error);
      return false;
    }
  }

  // Adicionar métodos faltantes para agendamentos
  async cancelAppointment(id: number, reason: string): Promise<Appointment> {
    const result = await this.db
      .update(appointments)
      .set({ status: 'cancelled', notes: reason })
      .where(eq(appointments.id, id))
      .returning();
    return result[0] as Appointment;
  }

  async deleteAppointment(id: number): Promise<void> {
    await this.db.delete(appointments).where(eq(appointments.id, id));
  }

  async getUserIdByDoctorId(doctorId: number): Promise<number | undefined> {
    const result = await this.db.select({ userId: doctors.userId }).from(doctors).where(eq(doctors.id, doctorId));
    return result[0]?.userId;
  }

  async getAppointmentsForPaymentProcessing(startTime: Date, endTime: Date): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.isEmergency, false), // Apenas consultas agendadas
          gte(appointments.date, startTime),
          lte(appointments.date, endTime),
          eq(appointments.paymentStatus, 'authorized'), // Apenas pagamentos pré-autorizados
          sql`${appointments.paymentIntentId} IS NOT NULL`
        )
      );
  }

  async getCancelledAppointmentsWithPendingPayment(): Promise<Appointment[]> {
    return this.db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'cancelled'),
          eq(appointments.paymentStatus, 'authorized'),
          sql`${appointments.paymentIntentId} IS NOT NULL`
        )
      );
  }

  async getUserByToken(token: string): Promise<ExpressUser | null> {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { id: number };
      const [user] = await this.db.select().from(users).where(eq(users.id, decoded.id));
      return user || null;
    } catch (error) {
      console.error('Erro ao buscar usuário por token:', error);
      return null;
    }
  }

  async getCurrentSubscription(userId: number): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    const subscription = await this.db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, user.subscriptionPlanId || 0));

    return subscription[0] || null;
  }

  async createAuditLog(entry: {
    userId?: number;
    action: string;
    ip: string;
    userAgent: string;
    details: Record<string, any>;
    timestamp: Date;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      ipAddress: entry.ip,
      userAgent: entry.userAgent,
      details: entry.details,
      createdAt: entry.timestamp
    });
  }

  async getUserAuditLogs(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const result = await this.db.select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    return result;
  }

  async getAllServices(): Promise<any[]> {
    const result = await this.db.select().from(partnerServices).orderBy(desc(partnerServices.createdAt));
    return result;
  }

  // Aliases for admin routes compatibility
  async getService(id: number): Promise<PartnerService | undefined> {
    return this.getPartnerService(id);
  }

  async updateService(id: number, data: Partial<InsertPartnerService>): Promise<PartnerService> {
    return this.updatePartnerService(id, data);
  }

  async getServicesWithLocationFilter(userCity?: string, maxDistance: number = 50): Promise<PartnerService[]> {
    try {
      // Buscar serviços ativos
      const services = await this.db
        .select()
        .from(partnerServices)
        .where(eq(partnerServices.isActive, true));
      
      // Buscar parceiros relacionados
      const partnerIds = [...new Set(services.map(s => s.partnerId).filter(Boolean))] as number[];
      const partnersMap = new Map();
      
      if (partnerIds.length > 0) {
        const partnersData = await this.db
          .select({
            id: partners.id,
            userId: partners.userId,
            businessName: partners.businessName,
            tradingName: partners.tradingName,
            businessType: partners.businessType,
            description: partners.description,
            website: partners.website,
            address: partners.address,
            zipcode: partners.zipcode,
            postalCode: partners.postalCode,
            street: partners.street,
            number: partners.number,
            complement: partners.complement,
            neighborhood: partners.neighborhood,
            city: partners.city,
            state: partners.state,
            phone: partners.phone,
            cnpj: partners.cnpj,
            nationwideService: partners.nationwideService,
            status: partners.status,
            createdAt: partners.createdAt,
            updatedAt: partners.updatedAt
          })
          .from(partners)
          .where(inArray(partners.id, partnerIds));
        
        partnersData.forEach(partner => {
          partnersMap.set(partner.id, partner);
        });
      }
      
      // Buscar endereços para cada parceiro
      const addressesByPartner = new Map<number, PartnerAddress[]>();
      
      for (const partnerId of partnerIds) {
        try {
          const addresses = await this.getPartnerAddresses(partnerId);
          addressesByPartner.set(partnerId, addresses);
        } catch (addressError) {
          console.error(`[getServicesWithLocationFilter] Erro ao buscar endereços do parceiro ${partnerId}:`, addressError);
          addressesByPartner.set(partnerId, []);
        }
      }
      
      const enrichedServices = services.map((service) => {
        const partner = partnersMap.get(service.partnerId);
        const partnerAddresses = partner ? addressesByPartner.get(partner.id) || [] : [];
        const primaryAddress = partnerAddresses.find(addr => addr.isPrimary) || partnerAddresses[0];
        
        return {
          ...service,
          serviceImage: service.serviceImage || null,
          partner: partner ? {
            ...partner,
            profileImage: null,
            phone: partner.phone || null,
            name: partner.businessName || partner.tradingName || null,
            city: primaryAddress?.city || partner.city || null,
            addresses: partnerAddresses
          } : null
        };
      }) as any[];

      // Se não houver cidade do usuário, retornar todos os serviços ativos
      if (!userCity) {
        return enrichedServices;
      }

      // Filtrar serviços: nacionais + locais dentro do raio
      const filteredServices = enrichedServices.filter(service => {
        try {
          // Serviços nacionais sempre aparecem
          if (service.isNational === true) {
            return true;
          }

          // Serviços locais: verificar distância de qualquer endereço ativo
          if (!service.partner?.addresses || service.partner.addresses.length === 0) {
            // Se não tem endereços cadastrados, usar cidade do parceiro como fallback
            if (!service.partner?.city) {
              return false;
            }
            
            const distance = getDistanceBetweenCities(userCity, service.partner.city);
            
            if (distance !== null && distance <= maxDistance) {
              service.distance = distance;
              return true;
            }
            return false;
          }

          // Verificar se algum endereço ativo está dentro do raio
          let minDistance: number | null = null;
          
          for (const address of service.partner.addresses) {
            // Considerar apenas endereços ativos
            if (!address.isActive) continue;
            
            const distance = getDistanceBetweenCities(userCity, address.city);
            
            if (distance !== null) {
              if (minDistance === null || distance < minDistance) {
                minDistance = distance;
              }
              
              // Se encontrou um endereço dentro do raio, incluir o serviço
              if (distance <= maxDistance) {
                service.distance = distance;
                service.closestAddressCity = address.city;
                service.closestAddressName = address.name;
                return true;
              }
            }
          }
          
          return false;
        } catch (filterError) {
          console.error(`[getServicesWithLocationFilter] Erro ao filtrar serviço:`, filterError);
          return false;
        }
      });
      
      return filteredServices;
      
    } catch (error) {
      console.error('[getServicesWithLocationFilter] Erro geral na função:', error);
      // Retornar erro mais específico
      if (error instanceof Error) {
        throw new Error(`Erro ao buscar serviços: ${error.message}`);
      }
      throw new Error('Erro desconhecido ao buscar serviços');
    }
  }

  // ==================== PRONTUÁRIOS MÉDICOS ====================
  
  // Criar prontuário para novo paciente
  async createMedicalRecord(patientId: number): Promise<MedicalRecord> {
    // Gerar número único do prontuário
    const recordNumber = await this.generateRecordNumber(patientId);
    
    const [record] = await this.db.insert(medicalRecords).values({
      patientId,
      recordNumber,
    }).returning();
    
    return record;
  }
  
  // Gerar número único do prontuário
  async generateRecordNumber(patientId: number): Promise<string> {
    const year = new Date().getFullYear();
    
    // Buscar o último número sequencial do ano
    const lastRecord = await this.db.select({
      recordNumber: medicalRecords.recordNumber
    })
    .from(medicalRecords)
    .where(sql`${medicalRecords.recordNumber} LIKE ${year + '-%'}`)
    .orderBy(desc(medicalRecords.recordNumber))
    .limit(1);
    
    let sequential = 1;
    if (lastRecord.length > 0) {
      const parts = lastRecord[0].recordNumber.split('-');
      if (parts.length >= 2) {
        sequential = parseInt(parts[1]) + 1;
      }
    }
    
    return `${year}-${sequential.toString().padStart(6, '0')}-${patientId.toString().padStart(6, '0')}`;
  }
  
  // Buscar prontuário por ID do paciente
  async getMedicalRecordByPatientId(patientId: number): Promise<MedicalRecord | null> {
    const [record] = await this.db.select()
      .from(medicalRecords)
      .where(eq(medicalRecords.patientId, patientId))
      .limit(1);
    
    return record || null;
  }
  
  // Buscar prontuário por ID
  async getMedicalRecord(recordId: number): Promise<MedicalRecord | null> {
    const [record] = await this.db.select()
      .from(medicalRecords)
      .where(eq(medicalRecords.id, recordId))
      .limit(1);
    
    return record || null;
  }
  
  // Registrar acesso ao prontuário
  async logMedicalRecordAccess(data: InsertMedicalRecordAccess): Promise<void> {
    await this.db.insert(medicalRecordAccess).values(data);
  }
  
  // Adicionar entrada no prontuário
  async addMedicalRecordEntry(data: InsertMedicalRecordEntry): Promise<MedicalRecordEntry> {
    const [entry] = await this.db.insert(medicalRecordEntries).values(data).returning();
    
    // Atualizar último acesso
    await this.db.update(medicalRecords)
      .set({
        lastAccessedAt: new Date(),
        lastAccessedBy: data.authorId
      })
      .where(eq(medicalRecords.id, data.recordId));
    
    return entry;
  }
  
  // Buscar entradas do prontuário
  async getMedicalRecordEntries(recordId: number): Promise<MedicalRecordEntry[]> {
    return await this.db.select({
      entry: medicalRecordEntries,
      author: users
    })
    .from(medicalRecordEntries)
    .leftJoin(users, eq(medicalRecordEntries.authorId, users.id))
    .where(eq(medicalRecordEntries.recordId, recordId))
    .orderBy(desc(medicalRecordEntries.createdAt))
    .then(results => results.map(r => ({
      ...r.entry,
      author: r.author
    })));
  }
  
  // Buscar pacientes do médico (que já tiveram consulta ou têm consulta marcada)
  async getDoctorPatients(doctorId: number): Promise<User[]> {
    try {
      const doctor = await this.getDoctorByUserId(doctorId);
      if (!doctor) {
        console.log(`Médico não encontrado para user ID: ${doctorId}`);
        return [];
      }
      
      console.log(`Buscando pacientes para médico Doctor ID: ${doctor.id}, User ID: ${doctorId}`);
      
      // Buscar todas as consultas do médico (excluindo canceladas)
      const validAppointments = await this.db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.doctorId, doctor.id),
            ne(appointments.status, 'cancelled')
          )
        );
      
      console.log(`Encontradas ${validAppointments.length} consultas válidas`);
      
      // Agrupar manualmente por userId
      const patientMap = new Map<number, { userId: number; lastAppointmentDate: Date; totalAppointments: number }>();
      
      for (const apt of validAppointments) {
        const existing = patientMap.get(apt.userId);
        if (existing) {
          existing.totalAppointments++;
          if (apt.appointmentDate && new Date(apt.appointmentDate) > existing.lastAppointmentDate) {
            existing.lastAppointmentDate = new Date(apt.appointmentDate);
          }
        } else {
          patientMap.set(apt.userId, {
            userId: apt.userId,
            lastAppointmentDate: apt.appointmentDate ? new Date(apt.appointmentDate) : new Date(),
            totalAppointments: 1
          });
        }
      }
      
      const patientData = Array.from(patientMap.values());
      
      console.log(`Encontrados ${patientData.length} pacientes com consultas não canceladas`);
      
      if (patientData.length === 0) return [];
      
      // Buscar dados completos dos pacientes
      const patients = await this.db.select()
        .from(users)
        .where(inArray(users.id, patientData.map(p => p.userId)))
        .orderBy(asc(users.fullName));
      
      // Adicionar informações de consulta aos pacientes
      return patients.map(patient => {
        const appointmentInfo = patientData.find(p => p.userId === patient.id);
        return {
          ...patient,
          lastAppointmentDate: appointmentInfo?.lastAppointmentDate?.toISOString(),
          totalAppointments: appointmentInfo?.totalAppointments || 0
        };
      });
    } catch (error) {
      console.error('Erro em getDoctorPatients:', error);
      throw error;
    }
  }
  
  // Verificar se médico pode acessar prontuário
  async canDoctorAccessMedicalRecord(doctorUserId: number, patientId: number): Promise<boolean> {
    const doctor = await this.getDoctorByUserId(doctorUserId);
    if (!doctor) return false;
    
    // Verificar se há consultas entre médico e paciente (excluindo canceladas)
    const appointment = await this.db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctor.id),
          eq(appointments.userId, patientId),
          ne(appointments.status, 'cancelled')
        )
      )
      .limit(1);
    
    return appointment.length > 0;
  }
  
  // Buscar prontuários (para admin)
  async searchMedicalRecords(query: string): Promise<Array<MedicalRecord & { patient: User }>> {
    const searchPattern = `%${query}%`;
    
    return await this.db.select({
      record: medicalRecords,
      patient: users
    })
    .from(medicalRecords)
    .innerJoin(users, eq(medicalRecords.patientId, users.id))
    .where(
      or(
        sql`LOWER(${users.fullName}) LIKE LOWER(${searchPattern})`,
        sql`LOWER(${users.username}) LIKE LOWER(${searchPattern})`,
        sql`${medicalRecords.recordNumber} LIKE ${searchPattern}`
      )
    )
    .limit(50)
    .then(results => results.map(r => ({
      ...r.record,
      patient: r.patient
    })));
  }
  
  // Buscar histórico de acesso
  async getMedicalRecordAccessHistory(recordId: number): Promise<MedicalRecordAccess[]> {
    return await this.db.select({
      access: medicalRecordAccess,
      user: users
    })
    .from(medicalRecordAccess)
    .leftJoin(users, eq(medicalRecordAccess.userId, users.id))
    .where(eq(medicalRecordAccess.recordId, recordId))
    .orderBy(desc(medicalRecordAccess.accessedAt))
    .limit(100)
    .then(results => results.map(r => ({
      ...r.access,
      user: r.user
    })));
  }
}

export const storage = new DatabaseStorage();
