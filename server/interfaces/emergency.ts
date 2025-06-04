export interface Emergency {
  id: number;
  userId: number;
  doctorId?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  type: 'medical' | 'dental' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  symptoms: string[];
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  startedAt: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertEmergency = Omit<Emergency, 'id' | 'createdAt' | 'updatedAt'>;

export interface EmergencyResponse {
  id: number;
  emergencyId: number;
  doctorId: number;
  status: 'accepted' | 'rejected' | 'completed';
  responseTime: Date;
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertEmergencyResponse = Omit<EmergencyResponse, 'id' | 'createdAt' | 'updatedAt'>;

export interface EmergencyChat {
  id: number;
  emergencyId: number;
  userId: number;
  message: string;
  type: 'text' | 'image' | 'location';
  fileUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type InsertEmergencyChat = Omit<EmergencyChat, 'id' | 'createdAt' | 'updatedAt'>;

export interface EmergencyAttachment {
  id: number;
  emergencyId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: 'image' | 'document' | 'video' | 'other';
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertEmergencyAttachment = Omit<EmergencyAttachment, 'id' | 'createdAt' | 'updatedAt'>; 