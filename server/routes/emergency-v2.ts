import { Router, Request, Response } from 'express';
import { storage } from '../storage.js';
import { createRoom, createToken, getRoomDetails } from '../utils/daily.js';
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
    
    // Get doctor's user info
    const doctorUser = doctor.userId ? await storage.getUser(doctor.userId) : null;
    const doctorFullName = doctorUser?.fullName || doctor.name || 'Médico';
    
    console.log(`🔍 Médico selecionado para emergência:`, {
      doctorId: doctor.id,
      doctorUserId: doctor.userId,
      doctorName: doctorFullName,
      availableForEmergency: doctor.availableForEmergency
    });

    // Criar sala Daily.co com nome único
    const roomName = `emergency-${userId}-${Date.now()}`;
    // IMPORTANTE: Passar true como terceiro parâmetro para aguardar propagação
    console.log(`🚀 Criando sala de emergência: ${roomName}`);
    const roomData = await createRoom(roomName, 60, true); // 60 minutos, aguardar propagação
    
    // Aguardar um tempo adicional para garantir propagação completa
    console.log('⏳ Aguardando propagação adicional da sala...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Criar token para o paciente
    const tokenResponse = await createToken(roomName, {
      user_id: userId.toString(),
      user_name: user.fullName || user.username,
      is_owner: false
    });
    
    // Extrair o token da resposta
    const patientToken = tokenResponse.token;

    // Criar registro de consulta com médico específico
    const appointment = await storage.createAppointment({
      userId: userId,
      doctorId: doctorId,
      date: new Date(),
      duration: 30,
      type: 'telemedicine',
      status: 'waiting',
      isEmergency: true,
      specialization: doctor.specialization || 'Emergência',
      telemedRoomName: roomName,
      notes: `Consulta de emergência com Dr. ${doctorFullName}`
    });
    
    console.log(`✅ Consulta de emergência criada:`, {
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
      userId: appointment.userId,
      status: appointment.status,
      isEmergency: appointment.isEmergency,
      type: appointment.type
    });

    // NÃO decrementar consultas aqui - será feito após 5 minutos de chamada
    // quando médico e paciente estiverem juntos

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

    console.log(`Consulta de emergência iniciada: Paciente ${user.fullName} (ID: ${userId}) com Dr. ${doctorFullName} (ID: ${doctorId}), Sala: ${roomName}`);

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

    // Atualizar consulta com o médico e marcar início do atendimento
    await storage.updateAppointment(appointmentId, {
      doctorId: doctor.id,
      status: 'in_progress',
      // Use notes field to track when doctor joined
      notes: `Médico entrou na consulta em: ${new Date().toISOString()}`
    });

    // Obter nome do médico
    const doctorUser = await storage.getUser(doctor.userId);
    const doctorName = doctorUser?.fullName || doctor.name || 'Médico';
    
    // Criar token para o médico
    const tokenResponse = await createToken(appointment.telemedRoomName!, {
      user_id: userId.toString(),
      user_name: doctorName,
      is_owner: true
    });
    
    // Extrair o token da resposta
    const doctorToken = tokenResponse.token;

    // Limpar notificação do médico (consulta foi aceita)
    emergencyNotifications.delete(doctor.id);

    // Registrar início do atendimento
    console.log(`Médico ${doctorName} (ID: ${doctor.id}) entrou na consulta de emergência ${appointmentId}`);
    console.log(`🏥 Detalhes da sala de emergência:`, {
      appointmentId: appointmentId,
      roomName: appointment.telemedRoomName,
      roomUrl: `https://cnvidas.daily.co/${appointment.telemedRoomName}`,
      doctorId: doctor.id,
      patientId: appointment.userId
    });

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
 * GET /api/emergency/v2/consultation/:appointmentId
 * Obter informações da consulta de emergência
 */
emergencyV2Router.get('/consultation/:appointmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    const userId = req.user!.id;
    
    // Buscar a consulta
    const appointment = await storage.getAppointmentById(appointmentId);
    if (!appointment || !appointment.isEmergency) {
      return res.status(404).json({ error: 'Consulta de emergência não encontrada' });
    }
    
    // Verificar se o usuário é médico
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor) {
      // Se não for médico, verificar se é o paciente
      if (appointment.userId !== userId) {
        return res.status(403).json({ error: 'Sem permissão para visualizar esta consulta' });
      }
    } else {
      // Se for médico, verificar se é o médico designado
      if (appointment.doctorId && appointment.doctorId !== doctor.id) {
        return res.status(403).json({ error: 'Esta consulta está designada para outro médico' });
      }
    }
    
    // Buscar informações do paciente
    const patient = await storage.getUser(appointment.userId);
    const patientName = patient?.fullName || patient?.username || 'Paciente';
    
    // Preparar resposta
    const response: any = {
      id: appointment.id,
      roomUrl: appointment.telemedRoomName ? `https://cnvidas.daily.co/${appointment.telemedRoomName}` : null,
      dailyRoomUrl: appointment.telemedRoomName ? `https://cnvidas.daily.co/${appointment.telemedRoomName}` : null,
      telemedRoomName: appointment.telemedRoomName,
      patientName: patientName,
      patientId: appointment.userId,
      status: appointment.status,
      notes: appointment.notes || '',
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
    };
    
    // Se for médico, incluir informações adicionais do paciente
    if (doctor) {
      const age = patient.birthDate ? 
        Math.floor((new Date().getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
        null;
      response.patientAge = age;
      response.patientPhone = patient?.phone || undefined;
      response.patientEmail = patient?.email || undefined;
      
      // Criar token para o médico se a consulta ainda estiver ativa
      if (appointment.status === 'waiting' || appointment.status === 'in_progress') {
        const doctorUser = await storage.getUser(doctor.userId);
        const doctorName = doctorUser?.fullName || doctor.name || 'Médico';
        
        const tokenResponse = await createToken(appointment.telemedRoomName!, {
          user_id: userId.toString(),
          user_name: doctorName,
          is_owner: true
        });
        
        response.token = tokenResponse.token;
      }
    }
    
    console.log(`📋 Consulta de emergência ${appointmentId} consultada por ${doctor ? 'médico' : 'paciente'} ${userId}`);
    
    return res.json(response);
    
  } catch (error) {
    console.error('Erro ao buscar informações da consulta:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar informações da consulta',
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

    // Calcular duração real da consulta
    let actualDuration = duration || appointment.duration;
    let shouldDecrementConsultation = false;
    
    // Por enquanto, sempre decrementar se a consulta foi completada
    if (appointment.isEmergency && appointment.status === 'in_progress') {
      shouldDecrementConsultation = true;
    }

    // Atualizar consulta
    await storage.updateAppointment(appointmentId, {
      status: 'completed',
      notes: notes || appointment.notes,
      duration: actualDuration
    });

    // Decrementar consultas de emergência disponíveis se necessário
    if (shouldDecrementConsultation && appointment.isEmergency) {
      const patient = await storage.getUser(appointment.userId);
      if (patient && patient.emergencyConsultationsLeft > 0) {
        await storage.updateUser(appointment.userId, {
          emergencyConsultationsLeft: patient.emergencyConsultationsLeft - 1
        });
        console.log(`Consulta de emergência decrementada para usuário ${appointment.userId}. Restantes: ${patient.emergencyConsultationsLeft - 1}`);
      }
    }

    // Limpar notificações se ainda existirem
    if (appointment.doctorId) {
      emergencyNotifications.delete(appointment.doctorId);
    }

    console.log(`Consulta de emergência ${appointmentId} finalizada. Duração: ${actualDuration} minutos. Consultação cobrada: ${shouldDecrementConsultation ? 'Sim' : 'Não'}`);

    return res.json({
      success: true,
      message: 'Consulta finalizada com sucesso',
      duration: actualDuration,
      consultationCharged: shouldDecrementConsultation
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
 * GET /api/emergency/v2/verify-room/:roomName
 * Verificar se a sala existe no Daily.co
 */
emergencyV2Router.get('/verify-room/:roomName', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roomName = req.params.roomName;
    
    try {
      const roomDetails = await getRoomDetails(roomName);
      return res.json({
        exists: true,
        room: {
          name: roomDetails.name,
          url: roomDetails.url,
          created_at: roomDetails.created_at
        }
      });
    } catch (error) {
      return res.json({
        exists: false,
        error: 'Room not found'
      });
    }
  } catch (error) {
    console.error('Error verifying room:', error);
    return res.status(500).json({ 
      error: 'Error verifying room',
      details: error instanceof Error ? error.message : 'Unknown error'
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

    // Para consultas em progresso, considerar que podem ser cobradas
    let elapsedMinutes = 0;
    let shouldCharge = false;
    
    if (appointment.status === 'in_progress') {
      // Estimate based on creation time
      const startTime = new Date(appointment.createdAt).getTime();
      const currentTime = new Date().getTime();
      elapsedMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
      shouldCharge = elapsedMinutes >= 5;
    }

    return res.json({
      id: appointment.id,
      status: appointment.status,
      doctorId: appointment.doctorId,
      doctorName: doctorInfo?.fullName,
      roomName: appointment.telemedRoomName,
      createdAt: appointment.createdAt,
      consultationStartedAt: appointment.status === 'in_progress' ? appointment.updatedAt : null,
      elapsedMinutes,
      shouldCharge,
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

/**
 * POST /api/emergency/v2/check-time/:appointmentId
 * Verificar tempo da consulta e decrementar se necessário
 */
emergencyV2Router.post('/check-time/:appointmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    
    const appointment = await storage.getAppointmentById(appointmentId);
    if (!appointment || !appointment.isEmergency) {
      return res.status(404).json({ error: 'Consulta de emergência não encontrada' });
    }

    // Verificar se a consulta está em andamento
    if (appointment.status !== 'in_progress') {
      return res.json({ 
        charged: false, 
        message: 'Consulta não está em andamento ou médico ainda não entrou' 
      });
    }

    // Calcular tempo decorrido baseado na criação da consulta
    const startTime = new Date(appointment.createdAt).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = Math.floor((currentTime - startTime) / (1000 * 60));

    // Se passou 5 minutos ou mais, decrementar
    if (elapsedMinutes >= 5) {
      const patient = await storage.getUser(appointment.userId);
      if (patient && patient.emergencyConsultationsLeft > 0) {
        await storage.updateUser(appointment.userId, {
          emergencyConsultationsLeft: patient.emergencyConsultationsLeft - 1
        });
        
        // Marcar consulta no campo notes
        await storage.updateAppointment(appointmentId, {
          notes: (appointment.notes || '') + '\nConsulta cobrada após 5 minutos'
        });

        console.log(`Consulta de emergência ${appointmentId} cobrada após ${elapsedMinutes} minutos. Restantes para usuário ${appointment.userId}: ${patient.emergencyConsultationsLeft - 1}`);

        return res.json({
          charged: true,
          elapsedMinutes,
          consultationsLeft: patient.emergencyConsultationsLeft - 1,
          message: 'Consulta cobrada após 5 minutos de atendimento'
        });
      }
    }

    return res.json({
      charged: false,
      elapsedMinutes,
      minutesRemaining: 5 - elapsedMinutes,
      message: `Faltam ${5 - elapsedMinutes} minutos para a consulta ser cobrada`
    });

  } catch (error) {
    console.error('Erro ao verificar tempo:', error);
    return res.status(500).json({ 
      error: 'Erro ao verificar tempo da consulta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * POST /api/emergency/v2/complete/:appointmentId
 * Marcar consulta de emergência como concluída
 */
emergencyV2Router.post('/complete/:appointmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    const { notes } = req.body;
    
    // Buscar a consulta
    const appointment = await storage.getAppointmentById(appointmentId);
    if (!appointment || !appointment.isEmergency) {
      return res.status(404).json({ error: 'Consulta de emergência não encontrada' });
    }
    
    // Verificar se o usuário é o médico da consulta
    const userId = req.user!.id;
    const doctor = await storage.getDoctorByUserId(userId);
    
    if (!doctor || appointment.doctorId !== doctor.id) {
      return res.status(403).json({ error: 'Apenas o médico responsável pode concluir a consulta' });
    }
    
    // Atualizar status da consulta
    await storage.updateAppointment(appointmentId, {
      status: 'completed',
      notes: notes || appointment.notes,
      completedAt: new Date()
    });
    
    // Limpar notificações se existirem
    emergencyNotifications.delete(doctor.id);
    
    console.log(`✅ Consulta de emergência ${appointmentId} marcada como concluída pelo médico ${doctor.id}`);
    
    return res.json({
      success: true,
      message: 'Consulta concluída com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao concluir consulta:', error);
    return res.status(500).json({ 
      error: 'Erro ao concluir consulta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * GET /api/emergency/v2/verify-room/:roomName
 * Verificar se uma sala existe no Daily.co
 */
emergencyV2Router.get('/verify-room/:roomName', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.params;
    
    // Tentar obter detalhes da sala
    try {
      const axios = require('axios');
      const response = await axios.get(
        `https://api.daily.co/v1/rooms/${roomName}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
          }
        }
      );
      
      if (response.status === 200) {
        return res.json({ 
          exists: true, 
          roomUrl: response.data.url || `https://cnvidas.daily.co/${roomName}`,
          message: 'Sala encontrada e pronta'
        });
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return res.json({ 
          exists: false, 
          message: 'Sala não encontrada'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro ao verificar sala:', error);
    return res.status(500).json({ 
      error: 'Erro ao verificar sala',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default emergencyV2Router;