import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { AuditAction } from '../../security/audit-logger';
import { users } from '../../../shared/schema';

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').$type<AuditAction>().notNull(),
  ip: text('ip').notNull(),
  userAgent: text('user_agent').notNull(),
  details: jsonb('details').notNull().default({}),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
}); 