import express from 'express';
import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { appointments, doctors, users } from '../../shared/schema';
import { requireAuth, requireDoctor, requirePatient } from '../middleware/auth';
import { checkEmergencyConsultationLimit } from '../middleware/subscription-check';
import { AppError } from '../utils/app-error';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { UserId } from '../types';
import { storage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';

const telemedicineRouter = Router();

// Schemas de validação
const createAppointmentSchema = z.object({
  doctorId: z.number(),
  date: z.string().datetime(),
  duration: z.number().min(15).max(120),
  notes: z.string().optional(),
  type: z.enum(['telemedicine', 'emergency']),
});

const updateAppointmentSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled']),
  notes: z.string().optional(),
});

const appointmentIdSchema = z.object({
  id: z.number()
});

// Endpoint para testar conexão
telemedicineRouter.get('/connection-test', async (req: Request, res: Response) => {
  try {
    // Testar conexão com o serviço de videoconferência
    const testResult = await testVideoServiceConnection();
    
    if (!testResult.success) {
      throw new Error(testResult.error || 'Falha no teste de conexão');
    }
    
    res.json({ 
      success: true, 
      message: 'Conexão OK',
      latency: testResult.latency
    });
  } catch (error) {
    console.error('Erro no teste de conexão:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Função auxiliar para testar conexão
async function testVideoServiceConnection() {
  try {
    const startTime = Date.now();
    
    // Testar conexão com o serviço de videoconferência
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      }
    });
    
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`Erro na API do Daily.co: ${response.status}`);
    }
    
    return {
      success: true,
      latency
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Rota para criar uma nova consulta
telemedicineRouter.post('/appointments', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const validatedData = createAppointmentSchema.parse({
      ...req.body,
      doctorId: toNumberOrThrow(req.body.doctorId),
      duration: toNumberOrThrow(req.body.duration)
    });

    // Verificar se o médico existe e está disponível
    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, validatedData.doctorId));

    if (!doctor) {
      throw new AppError('Médico não encontrado', 404);
    }

    // Criar a consulta
    const [appointment] = await db.insert(appointments).values({
      userId: authReq.user.id,
      doctorId: validatedData.doctorId,
      date: new Date(validatedData.date),
      duration: validatedData.duration,
      notes: validatedData.notes,
      type: validatedData.type,
      status: 'scheduled'
    }).returning();

    res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    } else if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao criar consulta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Rota para listar consultas do usuário
telemedicineRouter.get('/appointments', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const userRole = authReq.user.role;

    let appointmentsList;
    if (userRole === 'doctor') {
      // Buscar ID do médico
      const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, authReq.user.id));
      if (!doctor) {
        throw new AppError('Médico não encontrado', 404);
      }

      appointmentsList = await db.select().from(appointments).where(eq(appointments.doctorId, doctor.id));
      // Buscar informações do usuário para cada consulta
      const appointmentsWithUser = await Promise.all(
        appointmentsList.map(async (appointment) => {
          const [user] = await db.select().from(users).where(eq(users.id, appointment.userId));
          return {
            ...appointment,
            user: user ? { 
              id: user.id,
              name: user.fullName || user.username || '',
              email: user.email
            } : null
          };
        })
      );
      appointmentsList = appointmentsWithUser;
    } else {
      appointmentsList = await db.select().from(appointments).where(eq(appointments.userId, authReq.user.id));
      // Buscar informações do médico para cada consulta
      const appointmentsWithDoctor = await Promise.all(
        appointmentsList.map(async (appointment) => {
          if (!appointment.doctorId) return appointment;
          const [doctor] = await db.select().from(doctors).where(eq(doctors.id, appointment.doctorId));
          if (doctor) {
            const [doctorUser] = await db.select().from(users).where(eq(users.id, doctor.userId));
            return {
              ...appointment,
              doctor: {
                id: doctor.id,
                specialization: doctor.specialization,
                user: doctorUser ? { 
                  id: doctorUser.id,
                  name: doctorUser.fullName || doctorUser.username || '',
                  email: doctorUser.email
                } : null
              }
            };
          }
          return appointment;
        })
      );
      appointmentsList = appointmentsWithDoctor;
    }

    res.json(appointmentsList);
  } catch (error) {
    console.error('Erro ao listar consultas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para iniciar consulta de emergência
telemedicineRouter.post('/emergency', requireAuth, checkEmergencyConsultationLimit, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const doctorId = Number(req.body.doctorId);
    if (!doctorId) {
      throw new AppError('ID do médico inválido', 400);
    }

    const userId = Number(authReq.user.id);

    // Verificar se o médico está disponível para emergência
    const [doctor] = await db.select().from(doctors).where(
      and(
        eq(doctors.id, Number(doctorId)),
        eq(doctors.availableForEmergency, true)
      )
    );

    if (!doctor) {
      throw new AppError('Médico não disponível para emergência', 404);
    }

    // Criar consulta de emergência
    const [appointment] = await db.insert(appointments).values({
      userId: Number(userId),
      doctorId: Number(doctorId),
      date: new Date(),
      duration: 30,
      type: 'emergency',
      status: 'scheduled'
    }).returning();

    res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao criar consulta de emergência:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Rota para atualizar status da consulta
telemedicineRouter.patch('/appointments/:id', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const appointmentId = Number(req.params.id);
    if (!appointmentId) {
      throw new AppError('ID da consulta inválido', 400);
    }

    const validatedData = updateAppointmentSchema.parse(req.body);
    const userId = Number(authReq.user.id);

    // Verificar se a consulta existe e pertence ao usuário
    const [appointment] = await db.select().from(appointments).where(
      and(
        eq(appointments.id, Number(appointmentId)),
        eq(appointments.userId, Number(userId))
      )
    );

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Atualizar a consulta
    const [updatedAppointment] = await db.update(appointments)
      .set({
        status: validatedData.status,
        notes: validatedData.notes,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, Number(appointmentId)))
      .returning();

    res.json(updatedAppointment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    } else if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao atualizar consulta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Rota para cancelar consulta
telemedicineRouter.delete('/appointments/:id', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const appointmentId = Number(req.params.id);
    if (!appointmentId) {
      throw new AppError('ID da consulta inválido', 400);
    }

    const userId = Number(authReq.user.id);

    // Verificar se a consulta existe e pertence ao usuário
    const [appointment] = await db.select().from(appointments).where(
      and(
        eq(appointments.id, Number(appointmentId)),
        eq(appointments.userId, Number(userId))
      )
    );

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Cancelar a consulta
    const [cancelledAppointment] = await db.update(appointments)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(appointments.id, Number(appointmentId)))
      .returning();

    res.json(cancelledAppointment);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao cancelar consulta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Rota para obter detalhes da consulta
telemedicineRouter.get('/appointments/:id', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const appointmentId = Number(req.params.id);
    if (!appointmentId) {
      throw new AppError('ID da consulta inválido', 400);
    }

    const userId = Number(authReq.user.id);

    // Buscar a consulta
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, Number(appointmentId)));

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Verificar se o usuário tem permissão para ver a consulta
    if (Number(appointment.userId) !== Number(userId)) {
      // Se não for o paciente, verificar se é o médico
      const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, Number(userId)));
      if (!doctor || doctor.id !== Number(appointment.doctorId)) {
        throw new AppError('Não autorizado', 403);
      }
    }

    // Buscar informações adicionais
    const [doctor] = appointment.doctorId ? await db.select().from(doctors).where(eq(doctors.id, Number(appointment.doctorId))) : [null];
    const doctorUserId = doctor?.userId ? Number(doctor.userId) : null;
    const [doctorUser] = doctorUserId ? await db.select().from(users).where(eq(users.id, doctorUserId)) : [null];
    const [patientUser] = await db.select().from(users).where(eq(users.id, Number(appointment.userId)));

    const appointmentDetails = {
      ...appointment,
      doctor: doctor ? {
        id: Number(doctor.id),
        specialization: doctor.specialization,
        user: doctorUser ? {
          id: Number(doctorUser.id),
          name: doctorUser.fullName || doctorUser.username || '',
          email: doctorUser.email
        } : null
      } : null,
      patient: patientUser ? {
        id: Number(patientUser.id),
        name: patientUser.fullName || patientUser.username || '',
        email: patientUser.email
      } : null
    };

    res.json(appointmentDetails);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao buscar detalhes da consulta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Rota para iniciar consulta
telemedicineRouter.post('/start', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const appointmentId = Number(req.body.appointmentId);
    if (!appointmentId) {
      throw new AppError('ID da consulta inválido', 400);
    }

    const userId = Number(authReq.user.id);

    // Verificar se a consulta existe e se o usuário tem permissão
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, Number(appointmentId)));

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Verificar se o usuário é o médico ou o paciente
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, Number(userId)));
    if (!doctor || doctor.id !== Number(appointment.doctorId)) {
      if (Number(appointment.userId) !== Number(userId)) {
        throw new AppError('Não autorizado', 403);
      }
    }

    // Atualizar status da consulta
    const [updatedAppointment] = await db.update(appointments)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(appointments.id, Number(appointmentId)))
      .returning();

    res.json(updatedAppointment);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao iniciar consulta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Rota para finalizar consulta
telemedicineRouter.post('/end', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const appointmentId = Number(req.body.appointmentId);
    if (!appointmentId) {
      throw new AppError('ID da consulta inválido', 400);
    }

    const userId = Number(authReq.user.id);

    // Verificar se a consulta existe e se o usuário é o médico
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, Number(appointmentId)));

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, Number(userId)));
    if (!doctor || doctor.id !== Number(appointment.doctorId)) {
      throw new AppError('Apenas o médico pode finalizar a consulta', 403);
    }

    // Atualizar status da consulta
    const [updatedAppointment] = await db.update(appointments)
      .set({
        status: 'completed',
        notes: req.body.notes,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, Number(appointmentId)))
      .returning();

    res.json(updatedAppointment);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Erro ao finalizar consulta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Listar consultas do paciente
telemedicineRouter.get('/patient', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const userId = Number(authReq.user.id);
    const appointmentsList = await db.select().from(appointments).where(eq(appointments.userId, userId));
    // Buscar informações do médico para cada consulta
    const appointmentsWithDoctor = await Promise.all(
      appointmentsList.map(async (appointment) => {
        const [doctor] = await db.select().from(doctors).where(eq(doctors.id, Number(appointment.doctorId)));
        if (doctor) {
          const [doctorUser] = await db.select().from(users).where(eq(users.id, Number(doctor.userId)));
          return {
            ...appointment,
            doctor: {
              id: Number(doctor.id),
              specialization: doctor.specialization,
              user: doctorUser ? { 
                id: Number(doctorUser.id),
                name: doctorUser.fullName || doctorUser.username || '',
                email: doctorUser.email
              } : null
            }
          };
        }
        return appointment;
      })
    );

    res.json(appointmentsWithDoctor);
  } catch (error) {
    console.error('Erro ao listar consultas do paciente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar consultas do médico
telemedicineRouter.get('/doctor', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const userId = Number(authReq.user.id);
    // Buscar ID do médico
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    if (!doctor) {
      throw new AppError('Médico não encontrado', 404);
    }

    const doctorId = toNumberOrThrow(doctor.id as string | number);
    const appointmentsList = await db.select().from(appointments).where(eq(appointments.doctorId, doctorId));
    // Buscar informações do paciente para cada consulta
    const appointmentsWithUser = await Promise.all(
      appointmentsList.map(async (appointment) => {
        const patientId = Number(appointment.userId);
        const [user] = await db.select().from(users).where(eq(users.id, patientId));
        return {
          ...appointment,
          user: user ? { 
            id: Number(user.id),
            name: user.fullName || user.username || '',
            email: user.email
          } : null
        };
      })
    );

    res.json({
      success: true,
      appointments: appointmentsWithUser
    });

  } catch (error) {
    console.error('Erro ao listar consultas:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao listar consultas'
    });
  }
});

telemedicineRouter.get("/api/telemedicine/:id", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    const appointmentId = Number(req.params.id);
    if (isNaN(appointmentId)) {
      throw new AppError('ID da consulta inválido', 400);
    }
    const appointment = await storage.getAppointment(Number(appointmentId));
    return res.json(appointment);
  } catch (error) {
    console.error('Erro ao buscar consulta:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default telemedicineRouter; 