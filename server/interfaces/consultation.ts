export interface Consultation {
  id: number;
  userId: number;
  doctorId: number;
  type: 'regular' | 'emergency' | 'follow_up';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  date: Date;
  startTime: string;
  endTime: string;
  notes?: string;
  symptoms?: string[];
  diagnosis?: string;
  prescription?: string;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertConsultation = Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'>;

export interface ConsultationNote {
  id: number;
  consultationId: number;
  doctorId: number;
  content: string;
  type: 'symptom' | 'diagnosis' | 'prescription' | 'recommendation';
  createdAt: Date;
  updatedAt: Date;
}

export type InsertConsultationNote = Omit<ConsultationNote, 'id' | 'createdAt' | 'updatedAt'>;

export interface ConsultationAttachment {
  id: number;
  consultationId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: 'image' | 'document' | 'video' | 'other';
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertConsultationAttachment = Omit<ConsultationAttachment, 'id' | 'createdAt' | 'updatedAt'>;

export interface ConsultationReview {
  id: number;
  consultationId: number;
  userId: number;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertConsultationReview = Omit<ConsultationReview, 'id' | 'createdAt' | 'updatedAt'>; 