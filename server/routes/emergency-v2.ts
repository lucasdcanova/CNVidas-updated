import { Router, Request, Response } from 'express';
import { storage } from '../storage.js';
import { createRoom, createToken } from '../utils/daily.js';
import { authenticateToken } from '../middleware/auth.js';

const emergencyV2Router = Router();

// Armazenar notificações de emergência em memória (em produção, usar Redis ou DB)
const emergencyNotifications = new Map<number, {
  patientId: number;
  patientName: string;
  roomName: string;
  roomUrl: string;
  appointmentId: number;
  timestamp: Date;
  doctorId?: number;
}>();

/**
 * POST /api/emergency/v2/start
 * Paciente inicia consulta de emergência
 */
emergencyV2Router.post('/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { doctorId } = req.body;
    
    if (!doctorId) {
      return res.status(400).json({ error: 'É necessário selecionar um médico' });
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Apenas pacientes podem iniciar consultas de emergência' });
    }

    // Verificar se o paciente tem consultas de emergência disponíveis
    if (user.emergencyConsultationsLeft <= 0) {
      return res.status(403).json({ 
        error: 'Você não possui consultas de emergência disponíveis em seu plano' 
      });
    }
    
    // Verificar se o médico existe e está disponível
    const doctor = await storage.getDoctor(doctorId);
    if (!doctor || !doctor.availableForEmergency) {
      return res.status(404).json({ error: 'Médico não disponível para emergência' });
    }

    // Criar sala Daily.co com nome único
    const roomName = `emergency-${userId}-${Date.now()}`;
    const roomData = await createRoom(roomName, {
      properties: {
        enable_recording: false,
        enable_chat: true,
        enable_screenshare: true,
        lang: 'pt',
        max_participants: 2,
        exp: Math.floor(Date.now() / 1000) + 3600 // Expira em 1 hora
      }
    });

    // Criar token para o paciente
    const patientToken = await createToken(roomName, {
      user_id: userId.toString(),
      user_name: user.fullName || user.username,
      is_owner: false
    });

    // Criar registro de consulta com médico específico
    const appointment = await storage.createAppointment({
      userId: userId,
      doctorId: doctorId,
      date: new Date(),
      duration: 30,
      type: 'telemedicine',
      status: 'scheduled',
      isEmergency: true,
      specialization: doctor.specialization || 'Emergência',
      telemedRoomName: roomName,
      notes: `Consulta de emergência com Dr. ${doctor.fullName || 'Médico'}`
    });

    // Decrementar consultas de emergência disponíveis
    await storage.updateUser(userId, {
      emergencyConsultationsLeft: user.emergencyConsultationsLeft - 1
    });

    // Adicionar notificação apenas para o médico selecionado
    emergencyNotifications.set(doctorId, {
      patientId: userId,
      patientName: user.fullName || user.username || 'Paciente',
      roomName,
      roomUrl: roomData.url,
      appointmentId: appointment.id!,
      timestamp: new Date(),
      doctorId: doctorId
    });

    console.log(`Consulta de emergência iniciada: Paciente ${user.fullName} (ID: ${userId}) com Dr. ${doctor.fullName} (ID: ${doctorId}), Sala: ${roomName}`);

    return res.json({
      success: true,
      appointmentId: appointment.id,
      roomName,
      roomUrl: roomData.url,
      token: patientToken,
      message: 'Consulta de emergência iniciada. Aguarde um médico entrar na sala.'
    });

  } catch (error) {
    console.error('Erro ao iniciar consulta de emergência:', error);
    return res.status(500).json({ 
      error: 'Erro ao iniciar consulta de emergência',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * GET /api/emergency/v2/notifications/:doctorId
 * Médico verifica notificações de emergência
 */
emergencyV2Router.get('/notifications/:doctorId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doctorId = parseInt(req.params.doctorId);
    const userId = req.user!.id;
    
    // Verificar se o usuário é médico e se o ID corresponde
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor || doctor.id !== doctorId) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    // Obter notificação para este médico
    const notification = emergencyNotifications.get(doctorId);
    
    if (!notification) {
      return res.json([]);
    }

    // Verificar se a notificação não expirou (30 minutos)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (notification.timestamp < thirtyMinutesAgo) {
      emergencyNotifications.delete(doctorId);
      return res.json([]);
    }

    // Retornar notificação formatada
    return res.json([{
      id: `emergency-${notification.appointmentId}`,
      patientId: notification.patientId,
      patientName: notification.patientName,
      timestamp: notification.timestamp,
      roomUrl: notification.roomUrl,
      appointmentId: notification.appointmentId
    }]);

  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar notificações',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * POST /api/emergency/v2/join/:appointmentId
 * Médico entra na consulta de emergência
 */
emergencyV2Router.post('/join/:appointmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    const userId = req.user!.id;
    
    // Verificar se o usuário é médico
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor) {
      return res.status(403).json({ error: 'Apenas médicos podem atender consultas de emergência' });
    }

    // Buscar a consulta
    const appointment = await storage.getAppointmentById(appointmentId);
    if (!appointment || !appointment.isEmergency) {
      return res.status(404).json({ error: 'Consulta de emergência não encontrada' });
    }

    // Verificar se a consulta já tem um médico
    if (appointment.doctorId && appointment.doctorId !== doctor.id) {
      return res.status(400).json({ error: 'Esta consulta já está sendo atendida por outro médico' });
    }

    // Atualizar consulta com o médico
    await storage.updateAppointment(appointmentId, {
      doctorId: doctor.id,
      status: 'in_progress'
    });

    // Criar token para o médico
    const doctorToken = await createToken(appointment.telemedRoomName!, {
      user_id: userId.toString(),
      user_name: doctor.fullName || 'Médico',
      is_owner: true
    });

    // Limpar notificação do médico (consulta foi aceita)
    emergencyNotifications.delete(doctor.id);

    // Registrar início do atendimento
    console.log(`Médico ${doctor.fullName} (ID: ${doctor.id}) entrou na consulta de emergência ${appointmentId}`);

    return res.json({
      success: true,
      roomName: appointment.telemedRoomName,
      roomUrl: `https://cnvidas.daily.co/${appointment.telemedRoomName}`,
      token: doctorToken,
      appointmentId,
      patientName: appointment.userId ? (await storage.getUser(appointment.userId))?.fullName : 'Paciente'
    });

  } catch (error) {
    console.error('Erro ao entrar na consulta:', error);
    return res.status(500).json({ 
      error: 'Erro ao entrar na consulta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * POST /api/emergency/v2/end/:appointmentId
 * Finalizar consulta de emergência
 */
emergencyV2Router.post('/end/:appointmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    const { notes, duration } = req.body;
    
    // Buscar a consulta
    const appointment = await storage.getAppointmentById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Consulta não encontrada' });
    }

    // Verificar se o usuário tem permissão (paciente ou médico da consulta)
    const userId = req.user!.id;
    const doctor = await storage.getDoctorByUserId(userId);
    
    if (appointment.userId !== userId && (!doctor || appointment.doctorId !== doctor.id)) {
      return res.status(403).json({ error: 'Sem permissão para finalizar esta consulta' });
    }

    // Atualizar consulta
    await storage.updateAppointment(appointmentId, {
      status: 'completed',
      notes: notes || appointment.notes,
      duration: duration || appointment.duration
    });

    // Limpar notificações se ainda existirem
    if (appointment.doctorId) {
      emergencyNotifications.delete(appointment.doctorId);
    }

    console.log(`Consulta de emergência ${appointmentId} finalizada`);

    return res.json({
      success: true,
      message: 'Consulta finalizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao finalizar consulta:', error);
    return res.status(500).json({ 
      error: 'Erro ao finalizar consulta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * GET /api/emergency/v2/status/:appointmentId
 * Verificar status da consulta
 */
emergencyV2Router.get('/status/:appointmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    
    const appointment = await storage.getAppointmentById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Consulta não encontrada' });
    }

    // Verificar se o usuário tem permissão
    const userId = req.user!.id;
    const doctor = await storage.getDoctorByUserId(userId);
    
    if (appointment.userId !== userId && (!doctor || appointment.doctorId !== doctor.id)) {
      return res.status(403).json({ error: 'Sem permissão para visualizar esta consulta' });
    }

    const doctorInfo = appointment.doctorId ? await storage.getDoctor(appointment.doctorId) : null;

    return res.json({
      id: appointment.id,
      status: appointment.status,
      doctorId: appointment.doctorId,
      doctorName: doctorInfo?.fullName,
      roomName: appointment.telemedRoomName,
      createdAt: appointment.createdAt,
      duration: appointment.duration
    });

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return res.status(500).json({ 
      error: 'Erro ao verificar status',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default emergencyV2Router;