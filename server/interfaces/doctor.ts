export interface Doctor {
  id: number;
  userId: number;
  specialization: string;
  crm: string;
  availableForEmergency: boolean;
  pixKeyType?: string;
  pixKey?: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  accountAgency?: string;
  accountDigit?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDoctor = Omit<Doctor, 'id' | 'createdAt' | 'updatedAt'>;

export interface DoctorAvailability {
  id: number;
  doctorId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDoctorAvailability = Omit<DoctorAvailability, 'id' | 'createdAt' | 'updatedAt'>;

export interface DoctorPayment {
  id: number;
  doctorId: number;
  appointmentId: number;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paymentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDoctorPayment = Omit<DoctorPayment, 'id' | 'createdAt' | 'updatedAt'>;

export interface DoctorReview {
  id: number;
  doctorId: number;
  userId: number;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDoctorReview = Omit<DoctorReview, 'id' | 'createdAt' | 'updatedAt'>; 