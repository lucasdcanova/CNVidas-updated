export interface Diagnostic {
  id: number;
  userId: number;
  doctorId: number;
  type: 'laboratory' | 'imaging' | 'other';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  name: string;
  description: string;
  results?: string;
  notes?: string;
  scheduledDate: Date;
  completedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDiagnostic = Omit<Diagnostic, 'id' | 'createdAt' | 'updatedAt'>;

export interface DiagnosticResult {
  id: number;
  diagnosticId: number;
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDiagnosticResult = Omit<DiagnosticResult, 'id' | 'createdAt' | 'updatedAt'>;

export interface DiagnosticAttachment {
  id: number;
  diagnosticId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: 'image' | 'document' | 'video' | 'other';
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDiagnosticAttachment = Omit<DiagnosticAttachment, 'id' | 'createdAt' | 'updatedAt'>;

export interface DiagnosticRequest {
  id: number;
  diagnosticId: number;
  requesterId: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDiagnosticRequest = Omit<DiagnosticRequest, 'id' | 'createdAt' | 'updatedAt'>; 