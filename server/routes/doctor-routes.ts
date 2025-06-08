import express, { Response } from 'express';
import { storage } from '../storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/app-error';

const doctorRouter = express.Router();

// Middleware para verificar se o usuário é médico
const requireDoctorRole = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  if (req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Acesso restrito a médicos' });
  }
  
  next();
};

/**
 * Obter perfil do médico autenticado
 * GET /api/doctors/profile
 */
doctorRouter.get('/profile', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /profile - Buscando perfil do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      console.log('❌ Doctor /profile - Médico não encontrado para user ID:', req.user?.id);
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    console.log('✅ Doctor /profile - Perfil encontrado:', doctor.id);
    res.json(doctor);
  } catch (error) {
    console.error('❌ Erro ao obter perfil do médico:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter médico por user ID
 * GET /api/doctors/user/:userId
 */
doctorRouter.get('/user/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    console.log('🔍 Doctor /user/:userId - Buscando médico para user ID:', userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }
    
    // Verificar se o usuário pode acessar este perfil
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor) {
      console.log('❌ Doctor /user/:userId - Médico não encontrado para user ID:', userId);
      return res.status(404).json({ error: 'Médico não encontrado' });
    }
    
    console.log('✅ Doctor /user/:userId - Médico encontrado:', doctor.id);
    res.json(doctor);
  } catch (error) {
    console.error('❌ Erro ao obter médico por user ID:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualizar perfil do médico
 * PUT /api/doctors/profile
 */
doctorRouter.put('/profile', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor PUT /profile - Atualizando perfil do médico ID:', req.user?.id);
    console.log('🔍 Doctor PUT /profile - Dados recebidos:', req.body);
    
    const { 
      specialization, 
      licenseNumber, 
      biography, 
      education,
      experienceYears,
      availableForEmergency,
      consultationFee,
      profileImage,
      // Campos alternativos para compatibilidade
      specialty, 
      crm, 
      bio, 
      phone, 
      address 
    } = req.body;
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Mapear campos para o formato correto do banco
    const updateData: any = {
      updatedAt: new Date()
    };
    
    // Usar os nomes corretos dos campos ou os alternativos
    if (specialization !== undefined || specialty !== undefined) {
      updateData.specialization = specialization || specialty;
    }
    if (licenseNumber !== undefined || crm !== undefined) {
      updateData.licenseNumber = licenseNumber || crm;
    }
    if (biography !== undefined || bio !== undefined) {
      updateData.biography = biography || bio;
    }
    if (education !== undefined) {
      updateData.education = education;
    }
    if (experienceYears !== undefined) {
      updateData.experienceYears = parseInt(experienceYears) || 0;
    }
    if (availableForEmergency !== undefined) {
      updateData.availableForEmergency = Boolean(availableForEmergency);
    }
    if (consultationFee !== undefined) {
      updateData.consultationFee = parseFloat(consultationFee) || 0;
    }
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
    }
    
    console.log('🔍 Doctor PUT /profile - Dados para atualização:', updateData);
    
    const updatedDoctor = await storage.updateDoctor(doctor.id, updateData);
    
    console.log('✅ Doctor PUT /profile - Perfil atualizado:', updatedDoctor.id);
    res.json(updatedDoctor);
  } catch (error) {
    console.error('❌ Erro ao atualizar perfil do médico:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter consultas do médico
 * GET /api/doctors/appointments
 */
doctorRouter.get('/appointments', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /appointments - Buscando consultas do médico ID:', req.user?.id);
    
    const { status } = req.query;
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Buscar consultas do médico (implementar quando houver tabela de appointments)
    const appointments = []; // Placeholder
    
    console.log('✅ Doctor /appointments - Consultas encontradas:', appointments.length);
    res.json({ appointments, total: appointments.length });
  } catch (error) {
    console.error('❌ Erro ao obter consultas do médico:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter histórico de consultas
 * GET /api/doctors/appointments/history
 */
doctorRouter.get('/appointments/history', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /appointments/history - Buscando histórico do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Buscar histórico de consultas (implementar quando houver tabela de appointments)
    const history = []; // Placeholder
    
    console.log('✅ Doctor /appointments/history - Histórico encontrado:', history.length);
    res.json({ history, total: history.length });
  } catch (error) {
    console.error('❌ Erro ao obter histórico de consultas:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter pagamentos do médico
 * GET /api/doctors/payments
 */
doctorRouter.get('/payments', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /payments - Buscando pagamentos do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Buscar pagamentos do médico (implementar quando houver sistema de pagamentos)
    const payments = []; // Placeholder
    
    console.log('✅ Doctor /payments - Pagamentos encontrados:', payments.length);
    res.json({ payments, total: payments.length });
  } catch (error) {
    console.error('❌ Erro ao obter pagamentos do médico:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter estatísticas de ganhos
 * GET /api/doctors/earnings
 */
doctorRouter.get('/earnings', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /earnings - Buscando ganhos do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Calcular estatísticas de ganhos (implementar quando houver sistema de pagamentos)
    const earnings = {
      totalEarnings: 0,
      monthlyEarnings: 0,
      pendingPayments: 0,
      totalAppointments: 0
    };
    
    console.log('✅ Doctor /earnings - Estatísticas calculadas');
    res.json(earnings);
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas de ganhos:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter configurações de pagamento
 * GET /api/doctors/payment-settings
 */
doctorRouter.get('/payment-settings', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /payment-settings - Buscando configurações do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Retornar apenas dados de pagamento (sem informações sensíveis)
    const paymentSettings = {
      pixKeyType: doctor.pixKeyType,
      pixKey: doctor.pixKey ? doctor.pixKey.substring(0, 5) + '***' : null,
      bankName: doctor.bankName,
      accountType: doctor.accountType
    };
    
    console.log('✅ Doctor /payment-settings - Configurações encontradas');
    res.json(paymentSettings);
  } catch (error) {
    console.error('❌ Erro ao obter configurações de pagamento:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualizar configurações de pagamento
 * PUT /api/doctors/payment-settings
 */
doctorRouter.put('/payment-settings', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor PUT /payment-settings - Atualizando configurações do médico ID:', req.user?.id);
    
    const { pixKey, pixKeyType, bankName, accountType } = req.body;
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    const updatedDoctor = await storage.updateDoctor(doctor.id, {
      pixKey,
      pixKeyType,
      bankName,
      accountType,
      updatedAt: new Date()
    });
    
    console.log('✅ Doctor PUT /payment-settings - Configurações atualizadas');
    res.json({ message: 'Configurações de pagamento atualizadas com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao atualizar configurações de pagamento:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter disponibilidade do médico
 * GET /api/doctors/availability
 */
doctorRouter.get('/availability', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /availability - Buscando disponibilidade do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Buscar disponibilidade (implementar quando houver tabela de availability)
    const availability = []; // Placeholder
    
    console.log('✅ Doctor /availability - Disponibilidade encontrada');
    res.json({ availability });
  } catch (error) {
    console.error('❌ Erro ao obter disponibilidade:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Definir horários de disponibilidade
 * POST /api/doctors/availability
 */
doctorRouter.post('/availability', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor POST /availability - Definindo disponibilidade do médico ID:', req.user?.id);
    
    const { dayOfWeek, startTime, endTime, available } = req.body;
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Criar disponibilidade (implementar quando houver tabela de availability)
    const newAvailability = {
      id: Date.now(), // Placeholder
      doctorId: doctor.id,
      dayOfWeek,
      startTime,
      endTime,
      available
    };
    
    console.log('✅ Doctor POST /availability - Disponibilidade criada');
    res.status(201).json(newAvailability);
  } catch (error) {
    console.error('❌ Erro ao criar disponibilidade:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualizar horários de disponibilidade
 * PUT /api/doctors/availability
 */
doctorRouter.put('/availability', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor PUT /availability - Atualizando disponibilidade do médico ID:', req.user?.id);
    
    const { dayOfWeek, startTime, endTime, available } = req.body;
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Atualizar disponibilidade (implementar quando houver tabela de availability)
    const updatedAvailability = {
      id: Date.now(), // Placeholder
      doctorId: doctor.id,
      dayOfWeek,
      startTime,
      endTime,
      available
    };
    
    console.log('✅ Doctor PUT /availability - Disponibilidade atualizada');
    res.json(updatedAvailability);
  } catch (error) {
    console.error('❌ Erro ao atualizar disponibilidade:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter estatísticas do dashboard
 * GET /api/doctors/dashboard
 */
doctorRouter.get('/dashboard', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /dashboard - Buscando estatísticas do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    // Calcular estatísticas do dashboard
    const stats = {
      totalAppointments: 0,
      pendingAppointments: 0,
      completedAppointments: 0,
      monthlyEarnings: 0,
      totalPatients: 0,
      avgRating: 0
    };
    
    console.log('✅ Doctor /dashboard - Estatísticas calculadas');
    res.json(stats);
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas do dashboard:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Verificar status de boas-vindas
 * GET /api/doctors/welcome-status
 */
doctorRouter.get('/welcome-status', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor /welcome-status - Verificando status do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    console.log('✅ Doctor /welcome-status - Status verificado');
    res.json({
      isFirstLogin: !doctor.welcomeCompleted,
      welcomeCompleted: doctor.welcomeCompleted || false
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status de boas-vindas:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Completar boas-vindas
 * POST /api/doctors/complete-welcome
 */
doctorRouter.post('/complete-welcome', requireAuth, requireDoctorRole, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Doctor POST /complete-welcome - Completando boas-vindas do médico ID:', req.user?.id);
    
    const doctor = await storage.getDoctorByUserId(req.user!.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de médico não encontrado' });
    }
    
    await storage.updateDoctor(doctor.id, {
      welcomeCompleted: true,
      updatedAt: new Date()
    });
    
    console.log('✅ Doctor POST /complete-welcome - Boas-vindas completadas');
    res.json({ success: true, message: 'Boas-vindas completadas com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao completar boas-vindas:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

export default doctorRouter; 