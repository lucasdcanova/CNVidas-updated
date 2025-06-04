export interface Chat {
  id: number;
  userId: number;
  doctorId: number;
  status: 'active' | 'archived' | 'deleted';
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertChat = Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>;

export interface ChatMessage {
  id: number;
  chatId: number;
  senderId: number;
  type: 'text' | 'image' | 'file' | 'location';
  content: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertChatMessage = Omit<ChatMessage, 'id' | 'createdAt' | 'updatedAt'>;

export interface ChatParticipant {
  id: number;
  chatId: number;
  userId: number;
  role: 'user' | 'doctor' | 'admin';
  status: 'active' | 'muted' | 'blocked';
  lastReadAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertChatParticipant = Omit<ChatParticipant, 'id' | 'createdAt' | 'updatedAt'>;

export interface ChatAttachment {
  id: number;
  messageId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: 'image' | 'document' | 'video' | 'other';
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertChatAttachment = Omit<ChatAttachment, 'id' | 'createdAt' | 'updatedAt'>; 