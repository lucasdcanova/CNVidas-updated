import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, json, date, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, InferSelectModel, InferInsertModel } from "drizzle-orm";

// 1. Enfileirar todas as declarações de enum, depois tabelas, depois relations, depois schemas, depois tipos.
// 2. Garantir que nenhuma tabela seja referenciada antes de ser declarada.
// 3. Exportar tipos apenas no final.

export const userRoleEnum = pgEnum('user_role', ['patient', 'partner', 'admin', 'doctor']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'basic', 'premium', 'ultra', 'basic_family', 'premium_family', 'ultra_family']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default('patient'),
  cpf: varchar("cpf", { length: 11 }),
  phone: varchar("phone", { length: 20 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipcode: varchar("zipcode", { length: 8 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true).notNull(),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default('inactive'),


  sellerId: varchar("seller_id", { length: 255 }),
  sellerName: varchar("seller_name", { length: 255 }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").default('free'),

  emailVerified: boolean("email_verified").default(false).notNull(),
  profileImage: text("profile_image"),
  
  // Colunas adicionais que existem no banco
  birthDate: text("birth_date"),
  emergencyConsultationsLeft: integer("emergency_consultations_left").default(0),
  lastSubscriptionCancellation: timestamp("last_subscription_cancellation"),
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  subscriptionChangedAt: timestamp("subscription_changed_at"),
  
  // Campos adicionais necessários
  gender: varchar("gender", { length: 20 }),
  status: varchar("status", { length: 50 }).default('active'),
  subscriptionPlanId: integer("subscription_plan_id").references(() => subscriptionPlans.id),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  welcomeCompleted: boolean("welcome_completed").default(false),
  pixKeyType: varchar("pix_key_type", { length: 20 }),
  pixKey: varchar("pix_key", { length: 255 }),
  bankName: varchar("bank_name", { length: 100 }),
  accountType: varchar("account_type", { length: 20 }),

});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  businessName: text("business_name").notNull(),
  tradingName: text("trading_name"),
  businessType: text("business_type").notNull(),
  description: text("description"),
  website: text("website"),
  address: text("address"),
  zipcode: text("zipcode"),
  postalCode: text("postal_code"),
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  phone: text("phone"),
  cnpj: text("cnpj"),
  nationwideService: boolean("nationwide_service").default(false).notNull(),
  status: text("status").default('pending').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  specialization: text("specialization").notNull(),
  licenseNumber: text("license_number").notNull().unique(),
  biography: text("biography"),
  education: text("education"),
  experienceYears: integer("experience_years"),
  availableForEmergency: boolean("available_for_emergency").default(false),
  consultationFee: integer("consultation_fee"),
  profileImage: text("profile_image"),
  status: text("status").default('pending').notNull(),
  welcomeCompleted: boolean("welcome_completed").default(false).notNull(),
  pixKeyType: text("pix_key_type"),
  pixKey: text("pix_key"),
  bankName: text("bank_name"),
  accountType: text("account_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const partnerServices = pgTable("partner_services", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  regularPrice: integer("regular_price").notNull(),
  discountPrice: integer("discount_price").notNull(),
  discountPercentage: integer("discount_percentage"),
  isFeatured: boolean("is_featured").default(false),
  duration: integer("duration"),
  isActive: boolean("is_active").default(true),
  serviceImage: text("service_image"),
  isNational: boolean("is_national").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  serviceId: integer("service_id").references(() => partnerServices.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  doctorId: integer("doctor_id").references(() => doctors.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  date: timestamp("date").notNull(),
  duration: integer("duration").notNull(),
  status: text("status").default('scheduled').notNull(),
  notes: text("notes"),
  doctorName: text("doctor_name"),
  specialization: text("specialization"),
  telemedProvider: text("telemed_provider"),
  telemedLink: text("telemed_link"),
  telemedRoomName: text("telemed_room_name"),
  isEmergency: boolean("is_emergency").default(false),
  paymentIntentId: text("payment_intent_id"),
  paymentStatus: text("payment_status").default('pending'),
  paymentAmount: integer("payment_amount"),
  paymentFee: integer("payment_fee"),
  paymentCapturedAt: timestamp("payment_captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  occurrenceDate: date("occurrence_date").notNull(),
  description: text("description").notNull(),
  documents: json("documents").$type<string[]>(),
  status: text("status").default('pending').notNull(),
  reviewNotes: text("review_notes"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  amountRequested: integer("amount_requested"),
  amountApproved: integer("amount_approved"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").default(false),
  relatedId: integer("related_id"),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dependents = pgTable("dependents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  fullName: text("name").notNull(),
  cpf: text("cpf").notNull().unique(),
  birthDate: date("birth_date"),
  relationship: text("relationship"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const legalAcceptances = pgTable("legal_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(), // 'terms', 'privacy', 'contract', 'partner_contract'
  documentVersion: varchar("document_version", { length: 20 }).notNull().default('1.0.0'),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 e IPv6
  userAgent: text("user_agent"),
});

export const doctorPayments = pgTable("doctor_payments", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").references(() => doctors.id, { onDelete: "cascade" }).notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  status: text("status").default('pending').notNull(),
  description: text("description").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const qrTokens = pgTable("qr_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  used: boolean("used").default(false),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: json("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const availabilitySlots = pgTable("availability_slots", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: subscriptionPlanEnum("name").notNull(),
  displayName: text("display_name").notNull(),
  price: integer("price").notNull(),
  emergencyConsultations: text("emergency_consultations").notNull(),
  specialistDiscount: integer("specialist_discount").notNull(),
  insuranceCoverage: boolean("insurance_coverage").notNull(),
  features: text("features").array(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  status: text("status").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  paymentMethod: text("payment_method"),
  price: integer("price").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const qrAuthLogs = pgTable("qr_auth_logs", {
  id: serial("id").primaryKey(),
  qrTokenId: integer("qr_token_id").references(() => qrTokens.id, { onDelete: "set null" }),
  scannerUserId: integer("scanner_user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  tokenUserId: integer("token_user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
});

export const partnerAddresses = pgTable("partner_addresses", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Nome do endereço (ex: "Filial Centro", "Sede", etc)
  cep: text("cep").notNull(),
  address: text("address").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  phone: text("phone"),
  email: text("email"),
  openingHours: text("opening_hours"), // Horário de funcionamento
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  notifications: json("notifications").default({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    notificationFrequency: 'immediate',
    appointmentReminders: true,
    marketingEmails: false,
  }),
  privacy: json("privacy").default({
    shareWithDoctors: true,
    shareWithPartners: false,
    shareFullMedicalHistory: false,
    allowAnonymizedDataUse: true,
    profileVisibility: 'contacts',
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentSchedules = pgTable("payment_schedules", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(),
  recipientType: text("recipient_type").notNull(), // 'doctor' ou 'seller'
  amount: integer("amount").notNull(),
  status: text("status").default('pending').notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'pix' ou 'ted'
  paymentDetails: json("payment_details").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  status: text("status").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sellerCommissions = pgTable("seller_commissions", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => users.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  amount: integer("amount").notNull(),
  status: text("status").default('pending').notNull(),
  paymentScheduleId: integer("payment_schedule_id").references(() => paymentSchedules.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  partners: many(partners),
  doctors: many(doctors),
  appointments: many(appointments),
  claims: many(claims),
  partnerServices: many(partnerServices),
  dependents: many(dependents),
}));

export const dependentsRelations = relations(dependents, ({ one }) => ({
  user: one(users, {
    fields: [dependents.userId],
    references: [users.id],
  }),
}));

export const partnersRelations = relations(partners, ({ one, many }) => ({
  user: one(users, { fields: [partners.userId], references: [users.id] }),
  services: many(partnerServices),
}));

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  user: one(users, { fields: [doctors.userId], references: [users.id] }),
  appointments: many(appointments),
  payments: many(doctorPayments),
}));

export const doctorPaymentsRelations = relations(doctorPayments, ({ one }) => ({
  doctor: one(doctors, { 
    fields: [doctorPayments.doctorId], 
    references: [doctors.id] 
  }),
  appointment: one(appointments, { 
    fields: [doctorPayments.appointmentId], 
    references: [appointments.id] 
  }),
}));

export const partnerServicesRelations = relations(partnerServices, ({ one, many }) => ({
  partner: one(partners, { fields: [partnerServices.partnerId], references: [partners.id] }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  user: one(users, { fields: [appointments.userId], references: [users.id] }),
  service: one(partnerServices, { fields: [appointments.serviceId], references: [partnerServices.id] }),
  partner: one(partners, { fields: [appointments.partnerId], references: [partners.id] }),
  doctor: one(doctors, { fields: [appointments.doctorId], references: [doctors.id] }),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  user: one(users, { fields: [claims.userId], references: [users.id] }),
  reviewer: one(users, { fields: [claims.reviewedBy], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const availabilitySlotsRelations = relations(availabilitySlots, ({ one }) => ({
  doctor: one(doctors, {
    fields: [availabilitySlots.doctorId],
    references: [doctors.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  users: many(users),
}));

export const qrAuthLogsRelations = relations(qrAuthLogs, ({ one }) => ({
  qrToken: one(qrTokens, {
    fields: [qrAuthLogs.qrTokenId],
    references: [qrTokens.id],
  }),
  scannerUser: one(users, {
    fields: [qrAuthLogs.scannerUserId],
    references: [users.id],
  }),
  tokenUser: one(users, {
    fields: [qrAuthLogs.tokenUserId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, { fields: [userSubscriptions.userId], references: [users.id] }),
  plan: one(subscriptionPlans, { fields: [userSubscriptions.planId], references: [subscriptionPlans.id] }),
}));

export const userSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  fullName: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['patient', 'partner', 'admin', 'doctor']),
  subscriptionPlan: z.enum(['free', 'basic', 'premium', 'ultra', 'basic_family', 'premium_family', 'ultra_family']),
  subscriptionStatus: z.string()
});

export const appointmentSchema = z.object({
  userId: z.number(),
  serviceId: z.number(),
  partnerId: z.number(),
  doctorId: z.number(),
  type: z.string(),
  date: z.date(),
  duration: z.number(),
  status: z.string(),
  notes: z.string().optional(),
  doctorName: z.string().optional(),
  specialization: z.string().optional(),
  telemedProvider: z.string().optional(),
  telemedLink: z.string().optional(),
  telemedRoomName: z.string().optional(),
  isEmergency: z.boolean(),
  paymentStatus: z.string(),
  paymentAmount: z.number()
});

export const claimSchema = z.object({
  userId: z.number(),
  type: z.string(),
  occurrenceDate: z.string(),
  description: z.string(),
  documents: z.array(z.string()).optional(),
  status: z.string(),
  reviewNotes: z.string().optional(),
  amountRequested: z.number().optional(),
  amountApproved: z.number().optional()
});

export const notificationSchema = z.object({
  userId: z.number(),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  isRead: z.boolean(),
  relatedId: z.number().optional(),
  link: z.string().optional()
});

// Tipos inferidos
export type User = InferSelectModel<typeof users>;
export type Dependent = InferSelectModel<typeof dependents>;
export type LegalAcceptance = InferSelectModel<typeof legalAcceptances>;
export type Partner = InferSelectModel<typeof partners>;
export type Doctor = InferSelectModel<typeof doctors>;
export type PartnerService = InferSelectModel<typeof partnerServices>;
export type Appointment = InferSelectModel<typeof appointments>;
export type Claim = InferSelectModel<typeof claims>;
export type Notification = InferSelectModel<typeof notifications>;
export type DoctorPayment = InferSelectModel<typeof doctorPayments>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type QrToken = InferSelectModel<typeof qrTokens>;
export type SubscriptionPlan = InferSelectModel<typeof subscriptionPlans>;
export type UserSettings = InferSelectModel<typeof userSettings>;
export type EmailVerification = InferSelectModel<typeof emailVerifications>;
export type PasswordReset = InferSelectModel<typeof passwordResets>;
export type AvailabilitySlot = InferSelectModel<typeof availabilitySlots>;
export type QrAuthLog = InferSelectModel<typeof qrAuthLogs>;
export type UserSubscription = InferSelectModel<typeof userSubscriptions>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type PaymentSchedule = InferSelectModel<typeof paymentSchedules>;
export type SellerCommission = InferSelectModel<typeof sellerCommissions>;
export type UserSchema = z.infer<typeof userSchema>;
export type AppointmentSchema = z.infer<typeof appointmentSchema>;
export type ClaimSchema = z.infer<typeof claimSchema>;
export type NotificationSchema = z.infer<typeof notificationSchema>;

// Tipos para inserção
export type InsertUser = InferInsertModel<typeof users>;
export type InsertDependent = InferInsertModel<typeof dependents>;
export type InsertLegalAcceptance = InferInsertModel<typeof legalAcceptances>;
export type InsertPartner = InferInsertModel<typeof partners>;
export type InsertDoctor = InferInsertModel<typeof doctors>;
export type InsertPartnerService = InferInsertModel<typeof partnerServices>;
export type InsertAppointment = InferInsertModel<typeof appointments>;
export type InsertClaim = InferInsertModel<typeof claims>;
export type InsertNotification = InferInsertModel<typeof notifications>;
export type InsertDoctorPayment = InferInsertModel<typeof doctorPayments>;
export type InsertAuditLog = InferInsertModel<typeof auditLogs>;
export type InsertQrToken = InferInsertModel<typeof qrTokens>;
export type InsertSubscriptionPlan = InferInsertModel<typeof subscriptionPlans>;
export type InsertUserSettings = InferInsertModel<typeof userSettings>;
export type InsertEmailVerification = InferInsertModel<typeof emailVerifications>;
export type InsertPasswordReset = InferInsertModel<typeof passwordResets>;
export type InsertAvailabilitySlot = InferInsertModel<typeof availabilitySlots>;
export type InsertQrAuthLog = InferInsertModel<typeof qrAuthLogs>;
export type InsertUserSubscription = InferInsertModel<typeof userSubscriptions>;
export type InsertSubscription = InferInsertModel<typeof subscriptions>;
export type InsertPaymentSchedule = InferInsertModel<typeof paymentSchedules>;
export type InsertSellerCommission = InferInsertModel<typeof sellerCommissions>;
