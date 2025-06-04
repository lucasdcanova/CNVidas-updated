export interface AuditLog {
  id: number;
  userId?: number;
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import' | 'approve' | 'reject';
  entity: 'user' | 'profile' | 'payment' | 'subscription' | 'claim' | 'consultation' | 'emergency' | 'system';
  entityId: number;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export type InsertAuditLog = Omit<AuditLog, 'id' | 'createdAt'>;

export interface AuditTrail {
  id: number;
  auditLogId: number;
  userId: number;
  action: 'view' | 'export' | 'print';
  details?: string;
  createdAt: Date;
}

export type InsertAuditTrail = Omit<AuditTrail, 'id' | 'createdAt'>;

export interface AuditReport {
  id: number;
  name: string;
  description: string;
  filters: {
    startDate?: Date;
    endDate?: Date;
    userIds?: number[];
    actions?: string[];
    entities?: string[];
  };
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    recipients: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export type InsertAuditReport = Omit<AuditReport, 'id' | 'createdAt' | 'updatedAt'>;

export interface AuditExport {
  id: number;
  reportId: number;
  userId: number;
  format: 'csv' | 'pdf' | 'excel';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type InsertAuditExport = Omit<AuditExport, 'id' | 'createdAt' | 'completedAt'>; 