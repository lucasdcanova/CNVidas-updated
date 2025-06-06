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
import { User, UserId } from '../types';
import { storage } from '../storage';
import { toUserId } from '../utils/id-converter';

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
  id: z.string().transform(val => {
    const num = Number(val);
    if (isNaN(num)) throw new Error('ID inválido');
    return num;
  })
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
telemedicineRouter.post('/appointments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const validatedData = createAppointmentSchema.parse({
      ...req.body,
      doctorId: parseInt(req.body.doctorId),
      duration: parseInt(req.body.duration)
    });
    const userId = req.user.id;

    // Verificar se o médico existe e está disponível
    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, validatedData.doctorId));

    if (!doctor) {
      throw new AppError('Médico não encontrado', 404);
    }

    // Criar a consulta
    const [appointment] = await db.insert(appointments).values({
      userId,
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
telemedicineRouter.get('/appointments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const userId = req.user.id;
    const userRole = req.user.role;

    let appointmentsList;
    if (userRole === 'doctor') {
      appointmentsList = await db.select().from(appointments).where(eq(appointments.doctorId, userId));
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
      appointmentsList = await db.select().from(appointments).where(eq(appointments.userId, userId));
      // Buscar informações do médico para cada consulta
      const appointmentsWithDoctor = await Promise.all(
        appointmentsList.map(async (appointment) => {
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
telemedicineRouter.post('/emergency', requireAuth, checkEmergencyConsultationLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const doctorId = Number(req.body.doctorId);
    if (!doctorId || isNaN(doctorId)) {
      throw new AppError('ID do médico inválido', 400);
    }

    const userId = req.user.id;

    // Verificar se o médico está disponível para emergência
    const [doctor] = await db.select().from(doctors).where(
      and(
        eq(doctors.id, doctorId),
        eq(doctors.availableForEmergency, true)
      )
    );

    if (!doctor) {
      throw new AppError('Médico não disponível para emergência', 404);
    }

    // Criar consulta de emergência
    const [appointment] = await db.insert(appointments).values({
      userId,
      doctorId,
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
telemedicineRouter.patch('/appointments/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
    
    const appointmentId = parseInt(req.params.id);
    if (isNaN(appointmentId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const validatedData = updateAppointmentSchema.parse(req.body);
    const userId = req.user.id;

    // Verificar se a consulta existe e pertence ao usuário
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    if (appointment.userId !== userId && appointment.doctorId !== userId) {
      throw new AppError('Não autorizado', 403);
    }

    // Atualizar a consulta
    const [updatedAppointment] = await db
      .update(appointments)
      .set({
        status: validatedData.status,
        notes: validatedData.notes,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, appointmentId))
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

// Iniciar consulta
telemedicineRouter.post('/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appointmentId = Number(req.body.appointmentId);
    if (isNaN(appointmentId)) {
      throw new AppError('ID da consulta inválido', 400);
    }

    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const userId = req.user.id;

    // Buscar consulta
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Verificar se o usuário é o paciente ou médico da consulta
    if (appointment.userId !== userId && appointment.doctorId !== userId) {
      throw new AppError('Não autorizado', 403);
    }

    // Atualizar status da consulta
    const [updated] = await db.update(appointments)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      appointment: updated
    });

  } catch (error) {
    console.error('Erro ao iniciar consulta:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao iniciar consulta'
    });
  }
});

// Finalizar consulta
telemedicineRouter.post('/end', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appointmentId = Number(req.body.appointmentId);
    if (isNaN(appointmentId)) {
      throw new AppError('ID da consulta inválido', 400);
    }

    const { notes } = req.body;

    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const userId = req.user.id;

    // Buscar consulta
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Verificar se o usuário é o médico da consulta
    if (appointment.doctorId !== userId) {
      throw new AppError('Apenas o médico pode finalizar a consulta', 403);
    }

    // Atualizar status da consulta
    const [updated] = await db.update(appointments)
      .set({
        status: 'completed',
        notes,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      appointment: updated
    });

  } catch (error) {
    console.error('Erro ao finalizar consulta:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao finalizar consulta'
    });
  }
});

// Listar consultas do paciente
telemedicineRouter.get('/patient', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const userId = req.user.id;
    const appointmentsList = await db.select().from(appointments).where(eq(appointments.userId, userId));
    // Buscar informações do médico para cada consulta
    const appointmentsWithDoctor = await Promise.all(
      appointmentsList.map(async (appointment) => {
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

    res.json(appointmentsWithDoctor);
  } catch (error) {
    console.error('Erro ao listar consultas do paciente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar consultas do médico
telemedicineRouter.get('/doctor', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const userId = Number(req.user.id);
    // Buscar ID do médico
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    if (!doctor) {
      throw new AppError('Médico não encontrado', 404);
    }

    const appointmentsList = await db.select().from(appointments).where(eq(appointments.doctorId, Number(doctor.id)));
    // Buscar informações do paciente para cada consulta
    const appointmentsWithUser = await Promise.all(
      appointmentsList.map(async (appointment) => {
        const [user] = await db.select().from(users).where(eq(users.id, Number(appointment.userId)));
        return {
          ...appointment,
          user: user ? { ...user, name: user.fullName || user.username || '' } : null
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

telemedicineRouter.get("/api/telemedicine/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    const appointmentId = Number(req.params.id);
    if (isNaN(appointmentId)) {
      throw new AppError('ID da consulta inválido', 400);
    }
    const appointment = await storage.getTelemedicineAppointment(appointmentId);
    return res.json(appointment);
  } catch (error) {
    console.error('Erro ao buscar consulta:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export { telemedicineRouter }; 