import { Router, Request, Response } from 'express';
import { storage } from '../storage.js';
import { createRoom, createToken } from '../utils/daily.js';

const emergencyRouter = Router();

/**
 * Endpoint para verificar pacientes aguardando atendimento de emergência
 * GET /api/emergency/waiting
 */
emergencyRouter.get('/waiting', async (req: Request, res: Response) => {
  try {
    // Verificar autenticação por vários métodos
    let userId = null;
    let userRole = null;
    
    // 1. Verificar autenticação via sessão (método padrão)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user!.id;
      userRole = req.user!.role;
      console.log("Verificação de emergência - Usuário autenticado via sessão:", userId, userRole);
    } 
    // 2. Verificar autenticação via cabeçalho X-Session-ID
    else if (req.headers['x-session-id']) {
      const sessionId = req.headers['x-session-id'] as string;
      console.log("Verificação de emergência - Tentando autenticar via X-Session-ID:", sessionId);
      
      try {
        // Buscar sessão e usuário pelo token da sessão
        const session = await storage.getUserBySessionId(sessionId);
        if (session) {
          userId = session.id;
          userRole = session.role;
          console.log("Verificação de emergência - Usuário autenticado via X-Session-ID:", userId, userRole);
        }
      } catch (err) {
        console.error("Erro ao verificar X-Session-ID:", err);
      }
    } 
    
    // Se não conseguimos autenticar por nenhum método
    if (!userId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    // Verificar se o usuário é médico
    if (userRole !== 'doctor') {
      return res.status(403).json({ message: 'Acesso permitido apenas para médicos' });
    }
    
    // Buscar consulta de emergência mais recente
    const latestEmergency = await storage.getLatestEmergencyConsultation();
    
    if (!latestEmergency) {
      return res.json(null);
    }
    
    // Agora aceitamos status 'scheduled' ou 'confirmed' para emergências
    if (latestEmergency.status !== 'scheduled' && latestEmergency.status !== 'confirmed') {
      console.log(`Consulta encontrada com status inválido: ${latestEmergency.status}`);
      return res.json(null);
    }
    
    // Buscar informações do paciente
    let patientName = 'Paciente';
    if (latestEmergency.userId) {
      const patient = await storage.getUser(latestEmergency.userId);
      if (patient) {
        patientName = patient.fullName;
      }
    }
    
    return res.json({
      id: latestEmergency.id,
      patientName,
      startTime: latestEmergency.createdAt, // Usamos createdAt como startTime
      patientSymptoms: latestEmergency.notes || 'Emergência médica', // Usamos notes como sintomas
      telemedRoomName: latestEmergency.telemedRoomName
    });
    
  } catch (error) {
    console.error('Erro ao verificar pacientes em espera:', error);
    return res.status(500).json({ 
      message: 'Erro ao verificar pacientes em espera',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para médico entrar na sala de emergência
 * POST /api/emergency/join
 */
emergencyRouter.post('/join', async (req: Request, res: Response) => {
  try {
    // Verificar autenticação por vários métodos (igual ao endpoint '/waiting')
    let userId = null;
    let userRole = null;
    let userData = null;
    
    // 1. Verificar autenticação via sessão (método padrão)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user!.id;
      userRole = req.user!.role;
      userData = req.user!;
      console.log("Atendimento de emergência - Usuário autenticado via sessão:", userId, userRole);
    } 
    // 2. Verificar autenticação via cabeçalho X-Session-ID
    else if (req.headers['x-session-id']) {
      const sessionId = req.headers['x-session-id'] as string;
      console.log("Atendimento de emergência - Tentando autenticar via X-Session-ID:", sessionId);
      
      try {
        // Buscar sessão e usuário pelo token da sessão
        userData = await storage.getUserBySessionId(sessionId);
        if (userData) {
          userId = userData.id;
          userRole = userData.role;
          console.log("Atendimento de emergência - Usuário autenticado via X-Session-ID:", userId, userRole);
        }
      } catch (err) {
        console.error("Erro ao verificar X-Session-ID:", err);
      }
    }
    
    // Se não conseguimos autenticar por nenhum método
    if (!userId || !userData) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    // Verificar se o usuário é médico
    if (userRole !== 'doctor') {
      return res.status(403).json({ message: 'Acesso permitido apenas para médicos' });
    }
    
    console.log(`Médico ${userId} (${userData.fullName}) tentando entrar na sala de emergência`);
    
    // Buscar o perfil do médico
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor) {
      return res.status(404).json({ message: 'Perfil de médico não encontrado' });
    }
    
    // Verificar se há alguma consulta de emergência pendente
    let latestEmergency = await storage.getLatestEmergencyConsultation();
    
    let roomName: string;
    let appointmentId: number | null = null;
    
    // Log detalhado para depuração
    console.log("Informações da última consulta de emergência:", 
      latestEmergency ? 
        JSON.stringify({
          id: latestEmergency.id,
          telemedRoomName: latestEmergency.telemedRoomName,
          status: latestEmergency.status,
          doctorId: latestEmergency.doctorId,
          userId: latestEmergency.userId
        }) : 
        "Nenhuma encontrada"
    );
    
    if (latestEmergency && latestEmergency.telemedRoomName) {
      // Se houver uma emergência com sala já criada, use-a diretamente
      roomName = latestEmergency.telemedRoomName;
      appointmentId = latestEmergency.id;
      console.log(`Médico entrando na sala de emergência existente: ${roomName}, consulta #${appointmentId}`);
      
      // Atualizar a consulta para vincular este médico a ela
      await storage.updateAppointment(appointmentId, {
        doctorId: doctor.id,
        status: 'in_progress'
      });
      
      // Criar token para o médico na sala existente (não criamos nova sala)
      const tokenResponse = await createToken(roomName, {
        user_id: userId.toString(),
        user_name: userData.fullName,
        is_owner: true
      });
      
      // Extrair o token da resposta
      const token = tokenResponse.token;
      
      // Enviar os dados da sala para o cliente
      return res.json({
        success: true,
        room: {
          name: roomName,
          url: `https://cnvidas.daily.co/${roomName}`
        },
        token,
        appointmentId
      });
      
    } else {
      // Se não houver consulta emergencial ativa ou ela não tem sala configurada
      return res.status(404).json({ 
        message: 'Não há consultas de emergência aguardando atendimento no momento',
        error: 'no_emergency_calls'
      });
    }
    
  } catch (error) {
    console.error('Erro ao entrar na sala de emergência:', error);
    return res.status(500).json({ 
      message: 'Erro ao acessar a sala de emergência',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default emergencyRouter;