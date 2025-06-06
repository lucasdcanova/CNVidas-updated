import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, requireDoctor, requirePatient, requirePartner, requireRole } from './middleware/auth';
import { AuthenticatedRequest } from './types/authenticated-request';
import { storage } from './storage';
import { setupSubscriptionPlans } from './migrations/plans-setup';
import { verifyEmailConnection } from './services/email';
import { setupAuth } from './auth';
import { ensureJsonResponse } from './middleware/json-response';
import { errorHandler } from './middleware/error-handler';
import authRouter from './routes/auth-routes';
import diagnosticRouter from './routes/diagnostic-routes';
import { setupVite, serveStatic, log } from './vite';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { createToken } from './utils/daily';
import { randomBytes } from 'crypto';
import { sendEmail } from './services/email';
import { AppError } from './utils/app-error';
import { chatRouter } from "./chat-routes";
import fs from 'fs';
import multer from 'multer';
import { Router } from 'express';
import { adminRouter } from './admin-routes';
import { checkEmergencyConsultationLimit, checkSubscriptionFeature } from './middleware/subscription-check';
import { requirePlan } from './middleware/plan-check';
import { dailyRouter } from './routes/telemedicine-daily';
import { telemedicineRouter as dailyRouterV2 } from './routes/telemedicine-daily-v2';
import emergencyRouter from './routes/emergency-consultation';
import appointmentJoinRouter from './routes/appointment-join';
import emergencyPatientRouter from './routes/emergency-patient';
import { doctorRouter } from './doctor-routes';
import { doctorFinanceRouter } from './doctor-finance-routes';
import { db } from './db';
import { users, subscriptionPlans, auditLogs, doctors, appointments, notifications } from '../shared/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { normalizeNull } from './utils/normalize';
import telemedicineRouter from './routes/telemedicine-routes';
import diagnosticsRouter from './telemedicine-diagnostics';
import { User } from '../shared/schema';
import { insertAppointmentSchema, insertClaimSchema } from './schemas';
import { pool } from './db';
import { UserId } from './types';
import { toUserId } from './utils/id-converter';
import { InsertUser } from '../shared/schema';

const router = Router();

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const randomName = randomBytes(16).toString("hex");
      const extension = path.extname(file.originalname);
      cb(null, `${randomName}${extension}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow certain file types
    const allowedTypes = [
      "image/jpeg", 
      "image/png", 
      "application/pdf", 
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // docx
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido"));
    }
  }
});

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Aplicar middleware de erro globalmente
router.use(errorHandler);

// Rota temporária para testar o envio de email
router.get('/api/test-email', async (req: Request, res: Response) => {
  const to = req.query.email as string || 'lucas.canova@icloud.com';
  
  try {
    await sendEmail(
      to,
      'Teste de Email - CN Vidas',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8e8e8; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e88e5;">CN Vidas</h1>
        </div>
        <div style="margin-bottom: 30px;">
          <p>Olá,</p>
          <p>Este é um email de teste para verificar se o serviço de email da CN Vidas está funcionando corretamente.</p>
          <p>Se você recebeu este email, significa que a configuração de email está funcionando!</p>
          <p>Data e hora do teste: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; font-size: 12px; color: #757575;">
          <p>Atenciosamente,<br>Equipe CN Vidas</p>
        </div>
      </div>
      `
    );
    res.status(200).json({ success: true, message: 'Email de teste enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao enviar email de teste', 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

// Registrar rotas administrativas
router.use('/api/admin', adminRouter);

// Registrar rotas do chatbot
router.use('/api/chat', chatRouter);

// Registrar rotas de autenticação
router.use('/api/auth', authRouter);

// Registrar rotas de diagnóstico
router.use('/api/diagnostics', diagnosticRouter);

// Registrar rotas de telemedicina
router.use('/api/telemedicine', telemedicineRouter);

// Registrar rotas de telemedicina daily
router.use('/api/telemedicine/daily', dailyRouter);

// Registrar rotas de telemedicina daily v2
router.use('/api/telemedicine/daily/v2', dailyRouterV2);

// Registrar rotas de emergência
router.use('/api/emergency', emergencyRouter);

// Registrar rotas de join de consulta
router.use('/api/appointment/join', appointmentJoinRouter);

// Registrar rotas de paciente de emergência
router.use('/api/emergency/patient', emergencyPatientRouter);

// Registrar rotas de médico
router.use('/api/doctor', doctorRouter);

// Registrar rotas de finanças do médico
router.use('/api/doctor/finance', doctorFinanceRouter);

// Registrar rotas de diagnóstico de telemedicina
router.use('/api/telemedicine/diagnostics', diagnosticsRouter);

// Rota para obter perfil do usuário
router.get('/api/users/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({ error: 'Erro ao obter perfil do usuário' });
  }
});

// Rota para atualizar endereço do usuário
router.put('/api/users/address', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const { street, number, complement, neighborhood, city, state, zipCode } = req.body;

    const address = `${street}, ${number}${complement ? `, ${complement}` : ''}, ${neighborhood}, ${city} - ${state}, ${zipCode}`;

    await db.update(users)
      .set({ address })
      .where(eq(users.id, userId));

    res.json({ message: 'Endereço atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar endereço:', error);
    res.status(500).json({ error: 'Erro ao atualizar endereço' });
  }
});

// Rota para listar médicos
router.get('/api/doctors', async (req: Request, res: Response) => {
  try {
    const doctorsList = await db.select().from(doctors).where(eq(doctors.status, 'approved'));
    res.json(doctorsList);
  } catch (error) {
    console.error('Erro ao listar médicos:', error);
    res.status(500).json({ error: 'Erro ao listar médicos' });
  }
});

// Rota para listar consultas
router.get('/api/appointments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    let appointmentsList;

    if (req.user.role === 'doctor') {
      const doctor = await db.select().from(doctors).where(eq(doctors.userId, userId)).limit(1);
      if (!doctor.length) {
        return res.status(404).json({ error: 'Médico não encontrado' });
      }
      appointmentsList = await db.select().from(appointments).where(eq(appointments.doctorId, doctor[0].id));
    } else {
      appointmentsList = await db.select().from(appointments).where(eq(appointments.userId, userId));
    }

    res.json(appointmentsList);
  } catch (error) {
    console.error('Erro ao listar consultas:', error);
    res.status(500).json({ error: 'Erro ao listar consultas' });
  }
});

// Rota para criar consulta
router.post('/api/appointments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const { doctorId, date, duration = 30, notes } = req.body;

    const appointment = await db.insert(appointments).values({
      userId,
      doctorId: Number(doctorId),
      date: new Date(date),
      duration,
      notes,
      status: 'scheduled',
      type: 'regular'
    }).returning();

    // Criar notificação para o usuário
    await db.insert(notifications).values({
      userId,
      title: 'Nova Consulta Agendada',
      message: `Sua consulta foi agendada para ${new Date(date).toLocaleString('pt-BR')}`,
      type: 'appointment',
      relatedId: appointment[0].id
    });

    res.status(201).json(appointment[0]);
  } catch (error) {
    console.error('Erro ao criar consulta:', error);
    res.status(500).json({ error: 'Erro ao criar consulta' });
  }
});

// Rota para listar notificações
router.get('/api/notifications', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const notificationsList = await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    res.json(notificationsList);
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro ao listar notificações' });
  }
});

// Rota para contar notificações não lidas
router.get('/api/notifications/unread-count', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const result = await db.select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    res.json({ count: Number(result[0].count) });
  } catch (error) {
    console.error('Erro ao contar notificações não lidas:', error);
    res.status(500).json({ error: 'Erro ao contar notificações não lidas' });
  }
});

// Rota para marcar notificação como lida
router.put('/api/notifications/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const notificationId = parseInt(req.params.id);

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'ID de notificação inválido' });
    }

    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    if (!result.length) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
  }
});

// Rota para marcar todas as notificações como lidas
router.put('/api/notifications/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);

    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    res.json({ message: 'Todas as notificações foram marcadas como lidas' });
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ error: 'Erro ao marcar todas as notificações como lidas' });
  }
});

// Rota para obter uma notificação específica
router.get('/api/notifications/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);
    const notificationId = parseInt(req.params.id);

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'ID de notificação inválido' });
    }

    const notification = await db.select()
      .from(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .limit(1);

    if (!notification.length) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    res.json(notification[0]);
  } catch (error) {
    console.error('Erro ao obter notificação:', error);
    res.status(500).json({ error: 'Erro ao obter notificação' });
  }
});

// Rota para listar médicos disponíveis para emergência
router.get('/api/doctors/available', async (req: Request, res: Response) => {
  try {
    const availableDoctors = await db.select()
      .from(doctors)
      .where(eq(doctors.availableForEmergency, true));

    res.json(availableDoctors);
  } catch (error) {
    console.error('Erro ao listar médicos disponíveis:', error);
    res.status(500).json({ error: 'Erro ao listar médicos disponíveis' });
  }
});

// Rota para atualizar perfil do médico
router.put('/api/doctors/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = parseInt(req.params.id);
    const userId = Number(req.user.id);

    if (isNaN(doctorId)) {
      return res.status(400).json({ error: 'ID de médico inválido' });
    }

    const doctor = await db.select()
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (!doctor.length) {
      return res.status(404).json({ error: 'Médico não encontrado' });
    }

    if (doctor[0].userId !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updatedDoctor = await db.update(doctors)
      .set(req.body)
      .where(eq(doctors.id, doctorId))
      .returning();

    res.json(updatedDoctor[0]);
  } catch (error) {
    console.error('Erro ao atualizar perfil do médico:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil do médico' });
  }
});

// Rota para criar perfil de médico
router.post('/api/doctors', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);

    const existingDoctor = await db.select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    if (existingDoctor.length) {
      return res.status(400).json({ error: 'Usuário já possui um perfil de médico' });
    }

    const newDoctor = await db.insert(doctors)
      .values({
        userId,
        ...req.body,
        status: 'pending'
      })
      .returning();

    res.status(201).json(newDoctor[0]);
  } catch (error) {
    console.error('Erro ao criar perfil de médico:', error);
    res.status(500).json({ error: 'Erro ao criar perfil de médico' });
  }
});

// Rota para obter perfil do médico
router.get('/api/doctors/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);

    const doctor = await db.select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    if (!doctor.length) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }

    res.json(doctor[0]);
  } catch (error) {
    console.error('Erro ao obter perfil do médico:', error);
    res.status(500).json({ error: 'Erro ao obter perfil do médico' });
  }
});

// Rota para listar consultas do médico
router.get('/api/doctors/appointments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);

    const doctor = await db.select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    if (!doctor.length) {
      return res.status(404).json({ error: 'Médico não encontrado' });
    }

    const doctorAppointments = await db.select()
      .from(appointments)
      .where(eq(appointments.doctorId, doctor[0].id))
      .orderBy(desc(appointments.date));

    res.json(doctorAppointments);
  } catch (error) {
    console.error('Erro ao listar consultas do médico:', error);
    res.status(500).json({ error: 'Erro ao listar consultas do médico' });
  }
});

// Rota para alternar disponibilidade do médico
router.post('/api/doctors/toggle-availability', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user.id);

    const doctor = await db.select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    if (!doctor.length) {
      return res.status(404).json({ error: 'Médico não encontrado' });
    }

    const updatedDoctor = await db.update(doctors)
      .set({ availableForEmergency: !doctor[0].availableForEmergency })
      .where(eq(doctors.id, doctor[0].id))
      .returning();

    // Notificar administradores sobre a mudança de disponibilidade
    const admins = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));

    for (const admin of admins) {
      await db.insert(notifications)
        .values({
          userId: admin.id,
          title: 'Médico Alterou Disponibilidade',
          message: `O médico ${req.user.fullName} ${updatedDoctor[0].availableForEmergency ? 'está' : 'não está'} disponível para emergências`,
          type: 'doctor_availability'
        });
    }

    res.json(updatedDoctor[0]);
  } catch (error) {
    console.error('Erro ao alternar disponibilidade do médico:', error);
    res.status(500).json({ error: 'Erro ao alternar disponibilidade do médico' });
  }
});

export default router;
