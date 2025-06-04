export interface Claim {
  id: number;
  userId: number;
  type: 'medical' | 'dental' | 'pharmacy' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'in_review';
  description: string;
  amount: number;
  currency: string;
  documents: string[];
  notes?: string;
  rejectionReason?: string;
  approvedAmount?: number;
  approvedBy?: number;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertClaim = Omit<Claim, 'id' | 'createdAt' | 'updatedAt'>;

export interface ClaimDocument {
  id: number;
  claimId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertClaimDocument = Omit<ClaimDocument, 'id' | 'createdAt' | 'updatedAt'>;

export interface ClaimNote {
  id: number;
  claimId: number;
  userId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertClaimNote = Omit<ClaimNote, 'id' | 'createdAt' | 'updatedAt'>; 