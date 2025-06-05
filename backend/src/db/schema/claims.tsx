import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { doctors } from "./doctors";
import { patients } from "./patients";
import { appointments } from "./appointments";

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  doctorId: uuid("doctor_id").references(() => doctors.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

// Schema para validação de inserção
export const insertClaimSchema = createInsertSchema(claims, {
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  metadata: z.record(z.unknown()).optional(),
});

// Schema para validação de seleção
export const selectClaimSchema = createSelectSchema(claims);

// Tipo para inserção
export type InsertClaim = z.infer<typeof insertClaimSchema>;

// Tipo para seleção
export type SelectClaim = z.infer<typeof selectClaimSchema>;

// Tipo para atualização
export type UpdateClaim = Partial<InsertClaim>; 