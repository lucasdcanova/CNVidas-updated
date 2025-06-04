import { z } from 'zod';

export const insertAppointmentSchema = z.object({
  userId: z.number(),
  serviceId: z.number().optional(),
  partnerId: z.number().optional(),
  doctorId: z.number().optional(),
  type: z.string(),
  date: z.date(),
  duration: z.number(),
  status: z.string().default('scheduled'),
  notes: z.string().optional(),
  doctorName: z.string().optional(),
  specialization: z.string().optional(),
  telemedProvider: z.string().optional(),
  telemedLink: z.string().optional(),
  telemedRoomName: z.string().optional(),
  isEmergency: z.boolean().default(false),
  paymentIntentId: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentAmount: z.number().optional(),
  paymentFee: z.number().optional(),
  paymentCapturedAt: z.date().optional()
});

export const insertClaimSchema = z.object({
  userId: z.number(),
  type: z.string(),
  occurrenceDate: z.date(),
  description: z.string(),
  documents: z.array(z.string()).optional(),
  status: z.string().default('pending'),
  reviewNotes: z.string().optional(),
  reviewedBy: z.number().optional(),
  reviewedAt: z.date().optional(),
  amountRequested: z.number().optional(),
  amountApproved: z.number().optional()
}); 