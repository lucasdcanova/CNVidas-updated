import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { createRoom, createToken } from '../utils/daily';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { cancelConsultationPayment } from '../utils/stripe-payment';

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
    
    // Buscar consultas próximas do usuário com dados completos do médico
    const upcomingAppointments = await storage.getUpcomingAppointmentsWithDoctorInfo(userId);
    
    console.log(`Encontradas ${upcomingAppointments.length} consultas próximas`);
    
    // Log de debug temporário
    console.log('Consultas retornadas:', upcomingAppointments.map(apt => ({
      id: apt.id,
      status: apt.status,
      date: apt.date,
      doctorName: apt.doctorName
    })));
    
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
appointmentJoinRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar autenticação
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const userId = req.user.id;
    const userData = req.user;
    
    const { doctorId, date, duration, notes, type, paymentIntentId, paymentAmount, isEmergency } = req.body;
    
    if (!doctorId || !date) {
      return res.status(400).json({ message: 'doctorId e date são obrigatórios' });
    }
    
    // Para consultas não emergenciais, verificar se o pagamento foi pré-autorizado
    if (!isEmergency && (!paymentIntentId || !paymentAmount)) {
      return res.status(400).json({ message: 'Pagamento pré-autorizado é obrigatório para consultas não emergenciais' });
    }
    
    console.log(`Criando consulta para usuário ${userId} com médico ${doctorId}`);
    
    // Criar a consulta com informações de pagamento
    const appointmentData: any = {
      userId: userId,
      doctorId: parseInt(doctorId),
      date: new Date(date),
      duration: duration || 30,
      status: 'scheduled',
      notes: notes || '',
      type: type || 'telemedicine',
      isEmergency: isEmergency || false
    };
    
    // Adicionar informações de pagamento se fornecidas
    if (paymentIntentId && paymentAmount) {
      appointmentData.paymentIntentId = paymentIntentId;
      appointmentData.paymentAmount = paymentAmount;
      appointmentData.paymentStatus = 'authorized'; // Pagamento pré-autorizado
    }
    
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
appointmentJoinRouter.post('/:id/join', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Como usamos requireAuth, req.user já está garantido
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const userData = req.user!;
    
    console.log(`Join consulta - Usuário ${userId} (${userData.fullName}, role: ${userRole}) tentando entrar na consulta`);
    
    // Permitir acesso para médicos e pacientes
    if (userRole !== 'doctor' && userRole !== 'patient') {
      return res.status(403).json({ message: 'Acesso permitido apenas para médicos e pacientes' });
    }
    
    // Obter ID da consulta
    const appointmentId = parseInt(req.params.id);
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID de consulta inválido' });
    }
    
    console.log(`Usuário ${userId} (${userData.fullName}, role: ${userRole}) entrando na consulta #${appointmentId}`);
    
    // Buscar a consulta
    console.log(`Buscando consulta #${appointmentId} no banco de dados...`);
    const appointment = await storage.getAppointment(appointmentId);
    
    if (!appointment) {
      console.error(`Consulta #${appointmentId} não encontrada no banco de dados`);
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    console.log(`Consulta encontrada:`, {
      id: appointment.id,
      type: appointment.type,
      isEmergency: appointment.isEmergency,
      status: appointment.status,
      userId: appointment.userId,
      doctorId: appointment.doctorId,
      telemedRoomName: appointment.telemedRoomName
    });
    
    // Verificar permissões de acesso
    const isPatientOwner = userRole === 'patient' && appointment.userId === userId;
    let isDoctorAssigned = false;
    
    if (userRole === 'doctor') {
      // Se for médico, buscar o doctorId baseado no userId
      const doctor = await storage.getDoctorByUserId(userId);
      isDoctorAssigned = doctor ? (appointment.doctorId === doctor.id || !appointment.doctorId) : false;
    }
    
    const hasAccess = isPatientOwner || isDoctorAssigned || userRole === 'admin';
    
    if (!hasAccess) {
      console.error(`Usuário ${userId} não tem permissão para acessar consulta #${appointmentId}`);
      return res.status(403).json({ message: 'Você não tem permissão para acessar esta consulta' });
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
      const updateData: any = { telemedRoomName: roomName };
      
      // Só atribuir médico se o usuário for médico
      if (userRole === 'doctor') {
        const doctor = await storage.getDoctorByUserId(userId);
        if (doctor) {
          updateData.doctorId = doctor.id;
        }
      }
      
      await storage.updateAppointment(appointmentId, updateData);
      
      console.log(`Criada nova sala para consulta #${appointmentId}: ${roomName}`);
    } else {
      console.log(`Usando sala existente para consulta #${appointmentId}: ${roomName}`);
      
      // Se a consulta não tiver médico atribuído e o usuário atual for médico, atualizar
      if (!appointment.doctorId && userRole === 'doctor') {
        const doctor = await storage.getDoctorByUserId(userId);
        if (doctor) {
          await storage.updateAppointment(appointmentId, { doctorId: doctor.id });
          console.log(`Médico ${doctor.id} (userId: ${userId}) atribuído à consulta #${appointmentId}`);
        }
      }
    }
    
    try {
      // Verificar se o nome da sala está no formato válido para Daily.co
      const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      
      // Criar/verificar a sala no Daily.co com delay de propagação
      const room = await createRoom(sanitizedRoomName, 60, true); // 60 minutos, waitForPropagation = true
      
      // Criar token para o usuário (médico ou paciente)
      const isOwner = userRole === 'doctor';
      const displayName = userData.fullName || (userRole === 'doctor' ? 'Médico' : 'Paciente');
      const tokenResponse = await createToken(sanitizedRoomName, {
        user_id: userId.toString(),
        user_name: displayName,
        is_owner: isOwner
      });
      const token = tokenResponse.token;
      
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
 * Endpoint para registrar início da consulta
 * POST /api/appointments/:id/start
 */
appointmentJoinRouter.post('/:id/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const appointmentId = parseInt(req.params.id);
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID de consulta inválido' });
    }

    console.log(`Iniciando consulta #${appointmentId}`);

    // Buscar a consulta
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }

    // Verificar se o usuário é o médico da consulta
    const isDoctor = req.user.role === 'doctor';
    if (!isDoctor) {
      return res.status(403).json({ message: 'Apenas médicos podem iniciar consultas' });
    }

    // Atualizar o status da consulta para "in_progress" e registrar o horário de início
    await storage.updateAppointment(appointmentId, {
      status: 'in_progress',
      updatedAt: new Date()
    });

    console.log(`Consulta #${appointmentId} iniciada com sucesso`);

    return res.json({
      success: true,
      message: 'Consulta iniciada com sucesso',
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao iniciar consulta:', error);
    return res.status(500).json({
      message: 'Erro ao iniciar consulta',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para registrar fim da consulta e processar pagamento
 * POST /api/appointments/:id/end
 */
appointmentJoinRouter.post('/:id/end', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const appointmentId = parseInt(req.params.id);
    const { duration } = req.body; // Duração em minutos

    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID de consulta inválido' });
    }

    console.log(`Finalizando consulta #${appointmentId}, duração: ${duration} minutos`);

    // Buscar a consulta
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }

    // Verificar se o usuário é o médico da consulta
    const isDoctor = req.user.role === 'doctor';
    if (!isDoctor) {
      return res.status(403).json({ message: 'Apenas médicos podem finalizar consultas' });
    }

    // Atualizar o status da consulta
    const updateData: any = {
      status: 'completed',
      updatedAt: new Date()
    };

    // Lógica diferente para consultas de emergência vs agendadas
    if (appointment.isEmergency) {
      // CONSULTAS DE EMERGÊNCIA: Cobrar após 5 minutos
      if (duration >= 5) {
        // Buscar informações do usuário para verificar plano e consultas restantes
        const user = await storage.getUser(appointment.userId);
        if (!user) {
          throw new Error('Usuário não encontrado');
        }

        // Verificar se o usuário tem consultas de emergência disponíveis no plano
        const hasEmergencyConsultations = user.emergencyConsultationsLeft && user.emergencyConsultationsLeft > 0;
        const isPremiumOrUltra = user.subscriptionPlan && (user.subscriptionPlan.includes('premium') || user.subscriptionPlan.includes('ultra'));
        
        if (isPremiumOrUltra) {
          // Planos premium/ultra têm consultas ilimitadas, não precisa cobrar
          console.log(`Usuário com plano ${user.subscriptionPlan} - consulta de emergência gratuita`);
          updateData.paymentStatus = 'free';
          updateData.notes = 'Consulta de emergência gratuita (plano premium/ultra)';
        } else if (hasEmergencyConsultations) {
          // Descontar uma consulta de emergência do plano
          await storage.updateUser(appointment.userId, {
            emergencyConsultationsLeft: user.emergencyConsultationsLeft! - 1
          });
          console.log(`Descontada 1 consulta de emergência. Restantes: ${user.emergencyConsultationsLeft! - 1}`);
          updateData.paymentStatus = 'free';
          updateData.notes = 'Consulta de emergência descontada do plano';
        } else {
          // Plano gratuito/básico sem consultas restantes - cobrar valor integral
          if (appointment.paymentIntentId && appointment.paymentStatus === 'authorized') {
            try {
              // Importar a função de captura
              const { captureConsultationPayment: capture } = await import('../utils/stripe-payment');
              
              // Capturar o pagamento integral
              const paymentIntent = await capture(appointment.paymentIntentId);
              
              updateData.paymentStatus = 'completed';
              updateData.paymentCapturedAt = new Date();
              
              console.log(`Pagamento integral capturado para consulta de emergência #${appointmentId}`);
            } catch (paymentError) {
              console.error(`Erro ao capturar pagamento:`, paymentError);
              updateData.notes = appointment.notes 
                ? `${appointment.notes}\n\nErro ao capturar pagamento: ${paymentError}`
                : `Erro ao capturar pagamento: ${paymentError}`;
            }
          }
        }
      } else {
        // Consulta de emergência com menos de 5 minutos - não cobrar
        if (appointment.paymentIntentId && appointment.paymentStatus === 'authorized') {
          try {
            await cancelConsultationPayment(appointment.paymentIntentId);
            updateData.paymentStatus = 'cancelled';
            console.log(`Pré-autorização cancelada para consulta de emergência #${appointmentId} (duração < 5 min)`);
          } catch (paymentError) {
            console.error(`Erro ao cancelar pré-autorização:`, paymentError);
          }
        }
      }
    } else {
      // CONSULTAS AGENDADAS: A cobrança já foi feita 12h antes (implementar posteriormente)
      // Por enquanto, apenas marcar como concluída
      console.log(`Consulta agendada #${appointmentId} concluída. Pagamento já processado anteriormente.`);
      updateData.paymentStatus = appointment.paymentStatus || 'completed';
    }

    await storage.updateAppointment(appointmentId, updateData);

    console.log(`Consulta #${appointmentId} finalizada com sucesso`);

    return res.json({
      success: true,
      message: 'Consulta finalizada com sucesso',
      endedAt: new Date().toISOString(),
      duration: duration,
      paymentCaptured: duration >= 5 && appointment.paymentIntentId
    });

  } catch (error) {
    console.error('Erro ao finalizar consulta:', error);
    return res.status(500).json({
      message: 'Erro ao finalizar consulta',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para excluir consultas
 * DELETE /api/appointments/:id
 */
appointmentJoinRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Como usamos requireAuth, req.user já está garantido
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const userData = req.user!;
    
    console.log(`Delete consulta - Usuário ${userId} (${userData.fullName}, role: ${userRole}) tentando excluir consulta`);
    
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
      console.log(`Consulta #${appointmentIdNum} não encontrada`);
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    console.log(`Consulta encontrada:`, {
      id: appointment.id,
      userId: appointment.userId,
      doctorId: appointment.doctorId,
      type: appointment.type,
      status: appointment.status,
      isEmergency: appointment.isEmergency
    });
    
    // Verificar permissões: médico pode excluir suas consultas, paciente pode excluir as suas
    let canDelete = false;
    
    if (userRole === 'doctor') {
      // Se for médico, buscar o doctorId baseado no userId
      const doctor = await storage.getDoctorByUserId(userId);
      console.log(`Verificando permissão de exclusão - Médico userId: ${userId}, doctorId: ${doctor?.id}, appointment.doctorId: ${appointment.doctorId}`);
      
      // Médico pode excluir se:
      // 1. É o médico atribuído à consulta
      // 2. A consulta ainda não tem médico atribuído (consulta órfã)
      canDelete = doctor ? (appointment.doctorId === doctor.id || !appointment.doctorId) : false;
    } else if (userRole === 'patient') {
      // Se for paciente, comparar diretamente o userId
      console.log(`Verificando permissão de exclusão - Paciente userId: ${userId}, appointment.userId: ${appointment.userId}`);
      canDelete = appointment.userId === userId;
    } else if (userRole === 'admin') {
      // Admin pode excluir qualquer consulta
      canDelete = true;
    }
    
    console.log(`Permissão de exclusão: ${canDelete} para usuário ${userId} (${userRole})`);
    
    
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

/**
 * Endpoint para cancelar consultas
 * POST /api/appointments/:id/cancel
 */
appointmentJoinRouter.post('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    const appointmentId = req.params.id;
    const { reason } = req.body;
    
    console.log(`Cancelando consulta #${appointmentId} pelo usuário ${req.user.id}`);
    
    // Para consultas de emergência com formato especial (ex: emergency-doctor-4)
    if (appointmentId.startsWith('emergency-')) {
      console.log(`Cancelando consulta de emergência: ${appointmentId}`);
      
      // TODO: Implementar lógica específica para cancelar consultas de emergência
      // Por enquanto, apenas retornar sucesso
      return res.json({ 
        success: true, 
        message: 'Consulta de emergência cancelada com sucesso' 
      });
    }
    
    // Para consultas normais
    const appointmentIdNum = parseInt(appointmentId);
    if (isNaN(appointmentIdNum)) {
      return res.status(400).json({ message: 'ID de consulta inválido' });
    }
    
    // Verificar se a consulta existe
    const appointment = await storage.getAppointmentById(appointmentIdNum);
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    // Verificar permissões (médico pode cancelar suas consultas, paciente pode cancelar as dele)
    const isDoctor = req.user.role === 'doctor';
    let hasPermission = false;
    
    if (isDoctor) {
      // Se for médico, buscar o doctorId baseado no userId
      const doctor = await storage.getDoctorByUserId(req.user.id);
      console.log(`Verificando permissão de cancelamento - Médico userId: ${req.user.id}, doctorId: ${doctor?.id}, appointment.doctorId: ${appointment.doctorId}`);
      
      // Médico pode cancelar se:
      // 1. É o médico atribuído à consulta
      // 2. A consulta ainda não tem médico atribuído (consulta órfã)
      hasPermission = doctor ? (appointment.doctorId === doctor.id || !appointment.doctorId) : false;
    } else {
      // Se for paciente, comparar diretamente o userId
      console.log(`Verificando permissão de cancelamento - Paciente userId: ${req.user.id}, appointment.userId: ${appointment.userId}`);
      hasPermission = appointment.userId === req.user.id;
    }
    
    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Você não tem permissão para cancelar esta consulta' });
    }
    
    // Atualizar o status da consulta para cancelado
    // Nota: os campos cancelledAt, cancelledBy e cancellationReason não existem no schema
    // Vamos usar o campo notes para registrar o cancelamento
    const cancelInfo = `Cancelado por ${req.user.fullName || req.user.username} em ${new Date().toISOString()}. Motivo: ${reason || 'Não especificado'}`;
    
    console.log(`[CANCELAMENTO] Atualizando consulta #${appointmentIdNum} para status 'cancelled'`);
    
    await storage.updateAppointment(appointmentIdNum, {
      status: 'cancelled',
      notes: appointment.notes ? `${appointment.notes}\n\n${cancelInfo}` : cancelInfo,
      paymentStatus: 'cancelled'
    });
    
    // Verificar se a atualização funcionou
    const updatedAppointment = await storage.getAppointmentById(appointmentIdNum);
    console.log(`[CANCELAMENTO] Status após atualização: "${updatedAppointment?.status}"`);
    
    if (updatedAppointment?.status !== 'cancelled') {
      console.error(`[ERRO] Consulta #${appointmentIdNum} não foi atualizada para 'cancelled'. Status atual: "${updatedAppointment?.status}"`);
    }
    
    // Se houver um payment intent, cancelar a pré-autorização
    if (appointment.paymentIntentId) {
      try {
        await cancelConsultationPayment(appointment.paymentIntentId);
        console.log(`Pré-autorização de pagamento cancelada para consulta #${appointmentIdNum}`);
      } catch (paymentError) {
        console.error(`Erro ao cancelar pré-autorização de pagamento:`, paymentError);
        // Continuar mesmo se o cancelamento do pagamento falhar
      }
    }
    
    console.log(`Consulta #${appointmentIdNum} cancelada com sucesso`);
    
    return res.json({ 
      success: true, 
      message: 'Consulta cancelada com sucesso' 
    });
    
  } catch (error) {
    console.error('Erro ao cancelar consulta:', error);
    return res.status(500).json({ 
      message: 'Erro ao cancelar consulta',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * ENDPOINT TEMPORÁRIO DE DEBUG
 * GET /api/appointments/debug/108
 * Busca diretamente a consulta #108 do banco de dados
 */
appointmentJoinRouter.get('/debug/108', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('=== DEBUG: Buscando consulta #108 diretamente do banco ===');
    
    // Buscar a consulta diretamente
    const appointment = await storage.getAppointment(108);
    
    if (!appointment) {
      console.log('Consulta #108 não encontrada no banco de dados');
      return res.status(404).json({ 
        message: 'Consulta #108 não encontrada',
        debug: true 
      });
    }
    
    // Buscar informações adicionais
    const doctor = appointment.doctorId ? await storage.getDoctor(appointment.doctorId) : null;
    const user = await storage.getUser(appointment.userId);
    
    // Log completo dos dados
    console.log('Dados completos da consulta #108:', {
      ...appointment,
      doctor: doctor ? { id: doctor.id, name: doctor.fullName || 'Médico' } : null,
      user: user ? { id: user.id, name: user.fullName } : null
    });
    
    // Retornar todos os dados para análise
    return res.json({
      debug: true,
      appointment: {
        ...appointment,
        // Campos adicionais para debug
        _raw: appointment,
        _doctor: doctor,
        _user: user ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email
        } : null
      },
      metadata: {
        queriedAt: new Date().toISOString(),
        databaseTime: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Erro no debug da consulta #108:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar consulta #108',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      debug: true
    });
  }
});

export default appointmentJoinRouter;