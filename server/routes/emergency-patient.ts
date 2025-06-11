import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { createRoom, createToken } from '../utils/daily';

const emergencyPatientRouter = Router();

/**
 * Endpoint para paciente iniciar sala de emergência
 * POST /api/emergency/patient/start
 */
emergencyPatientRouter.post('/start', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    if (req.user!.role !== 'patient') {
      return res.status(403).json({ error: 'Apenas pacientes podem iniciar consultas de emergência' });
    }

    // Buscar dados atualizados do usuário para verificar consultas disponíveis
    const user = await storage.getUser(req.user!.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se tem consultas de emergência disponíveis
    if (!user.emergency_consultations_left || user.emergency_consultations_left <= 0) {
      return res.status(403).json({ 
        error: 'Você não possui consultas de emergência disponíveis',
        emergency_consultations_left: 0
      });
    }

    // Verificar se tem assinatura ativa
    if (user.subscription_status !== 'active' || !user.subscription_plan || user.subscription_plan === 'free') {
      return res.status(403).json({ 
        error: 'Você precisa de uma assinatura ativa para usar consultas de emergência',
        subscription_status: user.subscription_status,
        subscription_plan: user.subscription_plan
      });
    }
    
    console.log(`Paciente ${req.user!.id} (${req.user!.fullName}) iniciando sala de emergência`);
    
    // Gerar um nome de sala único para esta emergência
    const roomName = `emergency-${Date.now()}-${req.user!.id}`;
    console.log(`Nome da sala de emergência: ${roomName}`);
    
    // Criar a sala no Daily.co com tempo de expiração mais longo para emergências (3 horas)
    const room = await createRoom(roomName, 180, true);
    
    if (!room) {
      throw new Error('Falha ao criar sala de emergência no Daily.co');
    }
    
    // Criar token para o paciente
    const token = await createToken(roomName, {
      user_id: req.user!.id.toString(),
      user_name: req.user!.fullName,
      is_owner: true
    });
    
    // Registrar consulta de emergência no banco de dados
    const appointmentData = {
      userId: req.user!.id,
      doctorId: null, // Será preenchido quando um médico entrar
      date: new Date(),
      startTime: new Date(),
      endTime: null,
      duration: 30, // Duração estimada em minutos
      status: 'waiting',
      type: 'emergencia',
      telemedRoomName: roomName,
      telemedRoomUrl: room.url || `https://cnvidas.daily.co/${roomName}`,
      notes: 'Consulta de emergência iniciada pelo paciente',
      patientSymptoms: req.body.symptoms || 'Emergência - Sem sintomas informados',
      isEmergency: true
    };
    
    const appointment = await storage.createAppointment(appointmentData);
    
    // Decrementar o número de consultas de emergência disponíveis
    await storage.updateUser(req.user!.id, {
      emergency_consultations_left: user.emergency_consultations_left - 1
    });
    
    console.log(`Consultas de emergência restantes para usuário ${req.user!.id}: ${user.emergency_consultations_left - 1}`);
    
    // Enviar notificação para médicos disponíveis
    // TODO: Implementar notificação em tempo real para médicos
    
    // Enviar os dados da sala para o cliente
    return res.json({
      success: true,
      room: {
        name: roomName,
        url: room.url || `https://cnvidas.daily.co/${roomName}`
      },
      token,
      appointmentId: appointment.id,
      emergency_consultations_left: user.emergency_consultations_left - 1
    });
    
  } catch (error) {
    console.error('Erro ao criar sala de emergência para paciente:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar sala de emergência',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para verificar se médicos estão disponíveis antes de iniciar emergência
 * GET /api/emergency/patient/check-doctors
 */
emergencyPatientRouter.get('/check-doctors', async (req: Request, res: Response) => {
  try {
    const availableDoctors = await storage.getAvailableDoctors();
    const doctorCount = availableDoctors.length;
    
    return res.json({
      doctorsAvailable: doctorCount > 0,
      count: doctorCount,
      estimatedWaitTime: doctorCount > 0 ? 'menos de 5 minutos' : 'indeterminado'
    });
  } catch (error) {
    console.error('Erro ao verificar disponibilidade de médicos:', error);
    return res.status(500).json({ 
      message: 'Erro ao verificar disponibilidade',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para verificar elegibilidade do paciente para consulta de emergência
 * GET /api/emergency/patient/eligibility
 */
emergencyPatientRouter.get('/eligibility', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    if (req.user!.role !== 'patient') {
      return res.status(403).json({ error: 'Apenas pacientes podem verificar elegibilidade' });
    }

    // Buscar dados atualizados do usuário
    const user = await storage.getUser(req.user!.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se tem consultas de emergência disponíveis
    const hasEmergencyConsultations = user.emergency_consultations_left && user.emergency_consultations_left > 0;
    
    // Verificar se tem assinatura ativa
    const hasActiveSubscription = user.subscription_status === 'active' && 
      user.subscription_plan && 
      user.subscription_plan !== 'free';

    return res.json({
      eligible: hasEmergencyConsultations && hasActiveSubscription,
      emergency_consultations_left: user.emergency_consultations_left || 0,
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
      reasons: {
        has_consultations: hasEmergencyConsultations,
        has_active_subscription: hasActiveSubscription,
        message: !hasEmergencyConsultations 
          ? 'Você não possui consultas de emergência disponíveis em seu plano'
          : !hasActiveSubscription
          ? 'Sua assinatura não está ativa'
          : 'Você está elegível para consultas de emergência'
      }
    });
  } catch (error) {
    console.error('Erro ao verificar elegibilidade:', error);
    return res.status(500).json({ 
      message: 'Erro ao verificar elegibilidade',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para buscar médicos disponíveis para emergência
 * GET /api/emergency/patient/available-doctors
 */
emergencyPatientRouter.get('/available-doctors', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    if (req.user!.role !== 'patient') {
      return res.status(403).json({ error: 'Apenas pacientes podem buscar médicos disponíveis' });
    }

    // Buscar médicos disponíveis para emergência
    const availableDoctors = await storage.getAvailableDoctors();
    
    // Filtrar apenas informações relevantes para o paciente
    const doctorsInfo = availableDoctors.map(doctor => ({
      id: doctor.id,
      name: doctor.full_name || doctor.email,
      specialization: doctor.specialization || 'Clínico Geral',
      available: true,
      profileImage: doctor.profile_image || null
    }));

    return res.json({
      success: true,
      count: doctorsInfo.length,
      doctors: doctorsInfo,
      message: doctorsInfo.length > 0 
        ? 'Médicos disponíveis encontrados'
        : 'Nenhum médico disponível no momento'
    });
  } catch (error) {
    console.error('Erro ao buscar médicos disponíveis:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar médicos',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default emergencyPatientRouter;