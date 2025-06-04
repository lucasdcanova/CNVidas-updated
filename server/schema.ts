import { pgTable, serial, text, timestamp, integer, boolean, json, varchar, decimal } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('patient'),
  cpf: varchar('cpf', { length: 14 }).unique(),
  phone: varchar('phone', { length: 20 }),
  birthDate: timestamp('birth_date'),
  gender: varchar('gender', { length: 20 }),
  address: json('address'),
  profileImage: varchar('profile_image', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  serviceId: integer('service_id').references(() => services.id),
  partnerId: integer('partner_id').references(() => partners.id),
  doctorId: integer('doctor_id').references(() => doctors.id),
  type: varchar('type', { length: 50 }).notNull(),
  date: timestamp('date').notNull(),
  duration: integer('duration').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('scheduled'),
  notes: text('notes'),
  doctorName: varchar('doctor_name', { length: 255 }),
  specialization: varchar('specialization', { length: 255 }),
  telemedProvider: varchar('telemed_provider', { length: 50 }),
  telemedLink: varchar('telemed_link', { length: 255 }),
  telemedRoomName: varchar('telemed_room_name', { length: 255 }),
  isEmergency: boolean('is_emergency').notNull().default(false),
  paymentIntentId: varchar('payment_intent_id', { length: 255 }),
  paymentStatus: varchar('payment_status', { length: 50 }),
  paymentAmount: decimal('payment_amount', { precision: 10, scale: 2 }),
  paymentFee: decimal('payment_fee', { precision: 10, scale: 2 }),
  paymentCapturedAt: timestamp('payment_captured_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const partners = pgTable('partners', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  businessType: varchar('business_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const doctors = pgTable('doctors', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  specialization: varchar('specialization', { length: 255 }).notNull(),
  crm: varchar('crm', { length: 50 }).unique(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const claims = pgTable('claims', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  userId: integer('user_id').notNull().references(() => users.id),
  description: text('description').notNull(),
  occurrenceDate: timestamp('occurrence_date').notNull(),
  documents: json('documents'),
  reviewNotes: text('review_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  amountRequested: decimal('amount_requested', { precision: 10, scale: 2 }),
  amountApproved: decimal('amount_approved', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  message: text('message').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  link: varchar('link', { length: 255 }),
  relatedId: integer('related_id'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const dependents = pgTable('dependents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  cpf: varchar('cpf', { length: 14 }).unique(),
  birthDate: timestamp('birth_date'),
  gender: varchar('gender', { length: 20 }),
  relationship: varchar('relationship', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration').notNull(),
  partnerId: integer('partner_id').references(() => partners.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}); 