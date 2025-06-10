import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { createEmergencyRoom, createEmergencyToken } from '../utils/emergency-utils';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';

const appointmentJoinRouter = Router();

/**
 * Endpoint para listar consultas próximas do usuário
 * GET /api/appointments/upcoming
 */
appointmentJoinRouter.get('/upcoming', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const userId = req.user.id;
    console.log(`Buscando consultas próximas para usuário ${userId}`);
    
    // Buscar consultas próximas do usuário
    const upcomingAppointments = await storage.getUpcomingAppointments(userId);
    
    console.log(`Encontradas ${upcomingAppointments.length} consultas próximas`);
    
    res.json(upcomingAppointments);
    
  } catch (error) {
    console.error('Erro ao buscar consultas próximas:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar consultas próximas',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para criar nova consulta
 * POST /api/appointments
 */
appointmentJoinRouter.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Verificar autenticação
    let userId = null;
    let userData = null;
    
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      userId = authReq.user.id;
      userData = authReq.user;
    }
    
    if (!userId || !userData) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const { doctorId, date, duration, notes, type } = req.body;
    
    if (!doctorId || !date) {
      return res.status(400).json({ message: 'doctorId e date são obrigatórios' });
    }
    
    console.log(`Criando consulta para usuário ${userId} com médico ${doctorId}`);
    
    // Criar a consulta
    const appointmentData = {
      userId: userId,
      doctorId: parseInt(doctorId),
      date: new Date(date),
      duration: duration || 30,
      status: 'scheduled',
      notes: notes || '',
      type: type || 'telemedicine',
      isEmergency: false
    };
    
    const newAppointment = await storage.createAppointment(appointmentData);
    
    console.log(`Consulta criada com sucesso: ${newAppointment.id}`);
    
    res.status(201).json(newAppointment);
    
  } catch (error) {
    console.error('Erro ao criar consulta:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar consulta',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para médicos entrarem em consultas específicas
 * POST /api/appointments/:id/join
 */
appointmentJoinRouter.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Verificar autenticação por vários métodos
    let userId = null;
    let userRole = null;
    let userData = null;
    
    // 1. Verificar autenticação via sessão (método padrão)
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      userId = authReq.user.id;
      userRole = authReq.user.role;
      userData = authReq.user;
      console.log("Join consulta - Usuário autenticado via sessão:", userId, userRole);
    } 
    // 2. Verificar autenticação via cabeçalho X-Session-ID
    else if (req.headers['x-session-id']) {
      const sessionId = req.headers['x-session-id'] as string;
      console.log("Join consulta - Tentando autenticar via X-Session-ID:", sessionId);
      
      try {
        // Buscar sessão e usuário pelo token da sessão
        userData = await storage.getUserBySessionId(sessionId);
        if (userData) {
          userId = userData.id;
          userRole = userData.role;
          console.log("Join consulta - Usuário autenticado via X-Session-ID:", userId, userRole);
        }
      } catch (err) {
        console.error("Erro ao verificar X-Session-ID:", err);
      }
    }
    
    // Se não conseguimos autenticar por nenhum método
    if (!userId || !userData) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    // Verifica se o usuário é médico
    if (userRole !== 'doctor') {
      return res.status(403).json({ message: 'Acesso permitido apenas para médicos' });
    }
    
    // Obter ID da consulta
    const appointmentId = parseInt(req.params.id);
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID de consulta inválido' });
    }
    
    console.log(`Médico ${userId} (${userData.fullName}) entrando na consulta #${appointmentId}`);
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    // Verificar se é uma consulta de telemedicina
    if (appointment.type !== 'telemedicine' && !appointment.isEmergency) {
      return res.status(400).json({ message: 'Esta não é uma consulta de telemedicina ou emergência' });
    }
    
    // Obter ou gerar o nome da sala
    let roomName = appointment.telemedRoomName;
    if (!roomName) {
      // Gerar um nome para a sala se não existir
      roomName = `appointment-${appointmentId}-${Date.now()}`;
      
      // Atualizar a consulta com o nome da sala
      await storage.updateAppointment(appointmentId, { 
        telemedRoomName: roomName,
        doctorId: userId  // Atribuir médico à consulta
      });
      
      console.log(`Criada nova sala para consulta #${appointmentId}: ${roomName}`);
    } else {
      console.log(`Usando sala existente para consulta #${appointmentId}: ${roomName}`);
      
      // Se a consulta não tiver médico atribuído, atualizar com o médico atual
      if (!appointment.doctorId) {
        await storage.updateAppointment(appointmentId, { doctorId: userId });
        console.log(`Médico ${userId} atribuído à consulta #${appointmentId}`);
      }
    }
    
    try {
      // Verificar se o nome da sala está no formato válido para Daily.co
      const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      
      // Criar/verificar a sala no Daily.co
      const room = await createEmergencyRoom(sanitizedRoomName);
      
      // Criar token para o médico
      const token = await createEmergencyToken(sanitizedRoomName, userData.fullName || 'Médico', true);
      
      console.log(`Sala e token criados com sucesso: ${sanitizedRoomName}`);
      
      // Enviar os dados da sala para o cliente
      return res.json({
        success: true,
        room: {
          name: sanitizedRoomName,
          url: room && room.url ? room.url : `https://cnvidas.daily.co/${sanitizedRoomName}`
        },
        token,
        appointmentId
      });
    } catch (roomError) {
      console.error('Erro ao criar sala ou token:', roomError);
      
      // Em caso de erro, tentar retornar um objeto mínimo
      return res.json({
        success: true,
        room: {
          name: roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
          url: `https://cnvidas.daily.co/${roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}`
        },
        appointmentId
      });
    }
    
  } catch (error) {
    console.error('Erro ao entrar na consulta:', error);
    return res.status(500).json({ 
      message: 'Erro ao acessar a sala da consulta',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para excluir consultas
 * DELETE /api/appointments/:id
 */
appointmentJoinRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Verificar autenticação por vários métodos
    let userId = null;
    let userRole = null;
    let userData = null;
    
    // 1. Verificar autenticação via sessão (método padrão)
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      userId = authReq.user.id;
      userRole = authReq.user.role;
      userData = authReq.user;
      console.log("Delete consulta - Usuário autenticado via sessão:", userId, userRole);
    } 
    // 2. Verificar autenticação via cabeçalho X-Session-ID
    else if (req.headers['x-session-id']) {
      const sessionId = req.headers['x-session-id'] as string;
      console.log("Delete consulta - Tentando autenticar via X-Session-ID:", sessionId);
      
      try {
        // Buscar sessão e usuário pelo token da sessão
        userData = await storage.getUserBySessionId(sessionId);
        if (userData) {
          userId = userData.id;
          userRole = userData.role;
          console.log("Delete consulta - Usuário autenticado via X-Session-ID:", userId, userRole);
        }
      } catch (err) {
        console.error("Erro ao verificar X-Session-ID:", err);
      }
    }
    
    // Se não conseguimos autenticar por nenhum método
    if (!userId || !userData) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    // Obter ID da consulta
    const appointmentId = req.params.id;
    
    // Verificar se é uma consulta de emergência gerada pelo frontend (formato: emergency-doctor-X)
    if (appointmentId.startsWith('emergency-doctor-')) {
      console.log(`Tentando excluir consulta de emergência fictícia: ${appointmentId}`);
      
      // Para consultas de emergência fictícias, apenas retornar sucesso
      // (elas são criadas dinamicamente no frontend)
      return res.json({ 
        success: true, 
        message: 'Consulta de emergência removida' 
      });
    }
    
    // Para consultas reais do banco de dados
    const appointmentIdNum = parseInt(appointmentId);
    if (isNaN(appointmentIdNum)) {
      return res.status(400).json({ message: 'ID de consulta inválido' });
    }
    
    console.log(`Usuário ${userId} (${userData.fullName}) excluindo consulta #${appointmentIdNum}`);
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(appointmentIdNum);
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    // Verificar permissões: médico pode excluir suas consultas, paciente pode excluir as suas
    const canDelete = (userRole === 'doctor' && appointment.doctorId === userId) ||
                     (userRole === 'patient' && appointment.userId === userId) ||
                     (userRole === 'admin');
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Sem permissão para excluir esta consulta' });
    }
    
    // Excluir a consulta
    await storage.deleteAppointment(appointmentIdNum);
    
    console.log(`Consulta #${appointmentIdNum} excluída com sucesso`);
    
    return res.json({ 
      success: true, 
      message: 'Consulta excluída com sucesso' 
    });
    
  } catch (error) {
    console.error('Erro ao excluir consulta:', error);
    return res.status(500).json({ 
      message: 'Erro ao excluir consulta',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default appointmentJoinRouter;