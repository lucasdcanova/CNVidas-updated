import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { createEmergencyRoom, createEmergencyToken } from '../utils/emergency-utils';

const appointmentJoinRouter = Router();

/**
 * Endpoint para médicos entrarem em consultas específicas
 * POST /api/appointments/:id/join
 */
appointmentJoinRouter.post('/:id/join', async (req: Request, res: Response) => {
  try {
    // Verificar autenticação por vários métodos
    let userId = null;
    let userRole = null;
    let userData = null;
    
    // 1. Verificar autenticação via sessão (método padrão)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      userRole = req.user.role;
      userData = req.user;
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

export default appointmentJoinRouter;