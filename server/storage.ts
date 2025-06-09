import { users, partners, doctors, partnerServices, appointments, claims, notifications, doctorPayments, auditLogs, qrTokens, subscriptionPlans, userSettings, emailVerifications, passwordResets, availabilitySlots, qrAuthLogs, dependents } from '../shared/schema';
import { User, Partner, Doctor, PartnerService, Appointment, Claim, Notification, DoctorPayment, AuditLog, QrToken, SubscriptionPlan, UserSettings, EmailVerification, PasswordReset, AvailabilitySlot, QrAuthLog, InsertUser, InsertPartner, InsertDoctor, InsertPartnerService, InsertAppointment, InsertClaim, InsertNotification, InsertDoctorPayment, InsertAuditLog, InsertQrToken, InsertSubscriptionPlan, InsertUserSettings, InsertEmailVerification, InsertPasswordReset, InsertAvailabilitySlot, InsertQrAuthLog, Dependent, InsertDependent } from '@shared/types';
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, count, or, gt, asc } from "drizzle-orm";
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
  
  // Appointment methods
  getAppointment(id: number): Promise<Appointment | null>;
  getUserAppointments(userId: number): Promise<Appointment[]>;
  getUpcomingAppointments(userId: number): Promise<Appointment[]>;
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

  // Doctor methods
  async getDoctor(id: number): Promise<Doctor | undefined> {
    const [doctor] = await this.db.select().from(doctors).where(eq(doctors.id, id));
    return doctor;
  }

  async getDoctorByUserId(userId: number): Promise<Doctor | undefined> {
    const [doctor] = await this.db.select().from(doctors).where(eq(doctors.userId, userId));
    return doctor as Doctor;
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
      profileImage: doctors.profileImage,
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
      profileImage: doctors.profileImage,
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
    return this.db.select()
      .from(partnerServices)
      .where(eq(partnerServices.partnerId, partnerId));
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
    return this.db.select()
      .from(partnerServices)
      .where(eq(partnerServices.isFeatured, true))
      .limit(limit);
  }

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | null> {
    const [appointment] = await this.db.select().from(appointments).where(eq(appointments.id, id));
    return appointment as Appointment || null;
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
      const [updated] = await this.db.update(userSettings)
        .set({ ...settings, updatedAt: new Date() })
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
    return this.db.select().from(partnerServices);
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
}

// Export a singleton instance
export const storage = new DatabaseStorage();
