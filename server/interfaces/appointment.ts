export interface Appointment {
  id: number;
  userId: number;
  doctorId: number;
  partnerId?: number;
  serviceId?: number;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  type: 'regular' | 'emergency';
  notes?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertAppointment = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>;

export interface AppointmentWithPatientInfo extends Appointment {
  patientName?: string;
  patientEmail?: string;
}

export interface AppointmentWithDoctorInfo extends Appointment {
  doctorName?: string;
  doctorSpecialization?: string;
  doctorCrm?: string;
}

export interface AppointmentWithPartnerInfo extends Appointment {
  partnerName?: string;
  partnerType?: string;
  serviceName?: string;
  servicePrice?: number;
} 