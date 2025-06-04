import { z } from 'zod';

// Tipos de usuário
export type UserRole = 'patient' | 'partner' | 'admin' | 'doctor';
export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'ultra' | 'basic_family' | 'premium_family' | 'ultra_family';

// Schema de usuário
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  fullName: z.string(),
  role: z.enum(['patient', 'partner', 'admin', 'doctor']),
  cpf: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLogin: z.date().nullable(),
  isActive: z.boolean(),
  subscriptionStatus: z.string(),
  subscriptionPlan: z.enum(['free', 'basic', 'premium', 'ultra', 'basic_family', 'premium_family', 'ultra_family']),
  emailVerified: z.boolean(),
  profileImage: z.string().nullable(),
  emergencyConsultationsLeft: z.number().nullable(),
  birthDate: z.date().nullable(),
});

export type User = z.infer<typeof userSchema>;

// Schema de serviço
export const serviceSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  regularPrice: z.number(),
  discountPrice: z.number().nullable(),
  discountPercentage: z.number().nullable(),
  isFeatured: z.boolean(),
  duration: z.number().nullable(),
  isActive: z.boolean(),
  serviceImage: z.string().nullable(),
});

export type Service = z.infer<typeof serviceSchema>;

// Schema de agendamento
export const appointmentSchema = z.object({
  id: z.number(),
  userId: z.number(),
  serviceId: z.number().nullable(),
  partnerId: z.number().nullable(),
  doctorId: z.number().nullable(),
  type: z.string(),
  date: z.date(),
  duration: z.number(),
  status: z.string(),
  notes: z.string().nullable(),
  doctorName: z.string().nullable(),
  specialization: z.string().nullable(),
  telemedProvider: z.string().nullable(),
  telemedLink: z.string().nullable(),
  telemedRoomName: z.string().nullable(),
  isEmergency: z.boolean(),
  paymentStatus: z.string(),
  paymentAmount: z.number().nullable(),
});

export type Appointment = z.infer<typeof appointmentSchema>;

// Schema de reivindicação
export const claimSchema = z.object({
  id: z.number(),
  userId: z.number(),
  type: z.string(),
  occurrenceDate: z.date(),
  description: z.string(),
  documents: z.array(z.string()).nullable(),
  status: z.string(),
  reviewNotes: z.string().nullable(),
  amountRequested: z.number().nullable(),
  amountApproved: z.number().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  reviewedAt: z.date().optional(),
});

export type Claim = z.infer<typeof claimSchema>;

// Schema de notificação
export const notificationSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  isRead: z.boolean(),
  relatedId: z.number().nullable(),
  link: z.string().nullable(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof notificationSchema>;

// Schema de médico
export const doctorSchema = z.object({
  id: z.number(),
  userId: z.number(),
  specialization: z.string(),
  licenseNumber: z.string(),
  biography: z.string().nullable(),
  education: z.string().nullable(),
  experienceYears: z.number().nullable(),
  availableForEmergency: z.boolean(),
  consultationFee: z.number().nullable(),
  profileImage: z.string().nullable(),
  status: z.string(),
  welcomeCompleted: z.boolean(),
});

export type Doctor = z.infer<typeof doctorSchema>;

// Schema de parceiro
export const partnerSchema = z.object({
  id: z.number(),
  userId: z.number(),
  businessName: z.string(),
  businessType: z.string(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  zipcode: z.string().nullable(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  complement: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  phone: z.string().nullable(),
  cnpj: z.string().nullable(),
  status: z.string(),
});

export type Partner = z.infer<typeof partnerSchema>;

// Schema de serviço do parceiro
export const partnerServiceSchema = z.object({
  id: z.number(),
  partnerId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  regularPrice: z.number(),
  discountPrice: z.number().nullable(),
  discountPercentage: z.number().nullable(),
  isFeatured: z.boolean(),
  duration: z.number().nullable(),
  isActive: z.boolean(),
  serviceImage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartnerService = z.infer<typeof partnerServiceSchema>;

// Tipos de autenticação
export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterCredentials = {
  email: string;
  password: string;
  username: string;
  fullName: string;
  role: UserRole;
  cpf?: string;
  cnpj?: string;
};

// Tipos de mensagem
export type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status?: 'enviado' | 'recebido' | 'lido';
  agentName?: string;
  agentAvatar?: string;
  isTyping?: boolean;
}; 