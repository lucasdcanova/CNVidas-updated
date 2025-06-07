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
      status: 'em_andamento',
      type: 'emergencia',
      telemedRoomName: roomName,
      telemedRoomUrl: room.url || `https://cnvidas.daily.co/${roomName}`,
      notes: 'Consulta de emergência iniciada pelo paciente',
      patientSymptoms: req.body.symptoms || 'Emergência - Sem sintomas informados',
      isEmergency: true
    };
    
    const appointment = await storage.createAppointment(appointmentData);
    
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
      appointmentId: appointment.id
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

export default emergencyPatientRouter;