import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth-unified';

const router = express.Router();
const prisma = new PrismaClient();

// Obter configurações de um usuário específico (apenas médicos podem ver de pacientes)
router.get('/:userId/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requesterId = req.user?.id;
    const targetUserId = parseInt(req.params.userId);

    if (!requesterId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Verificar se o usuário está tentando acessar suas próprias configurações
    if (requesterId === targetUserId) {
      const settings = await prisma.user_settings.findUnique({
        where: { user_id: targetUserId }
      });

      if (!settings) {
        // Criar configurações padrão se não existirem
        const newSettings = await prisma.user_settings.create({
          data: {
            user_id: targetUserId,
            notifications: {
              emailNotifications: true,
              smsNotifications: false,
              pushNotifications: true,
              notificationFrequency: "immediate",
              appointmentReminders: true,
              marketingEmails: false
            },
            privacy: {
              shareWithDoctors: true,
              shareWithPartners: false,
              shareFullMedicalHistory: false,
              allowAnonymizedDataUse: true,
              profileVisibility: "contacts",
              allowConsultationRecording: true
            }
          }
        });

        return res.json(newSettings);
      }

      return res.json(settings);
    }

    // Verificar se o solicitante é médico
    const requester = await prisma.users.findUnique({
      where: { id: requesterId },
      include: { doctors: true }
    });

    if (!requester || requester.role !== 'doctor') {
      return res.status(403).json({ error: 'Apenas médicos podem acessar configurações de outros usuários' });
    }

    // Verificar se existe uma consulta entre o médico e o paciente
    const appointment = await prisma.appointments.findFirst({
      where: {
        user_id: targetUserId,
        doctor_id: requester.doctors[0]?.id
      }
    });

    if (!appointment) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar as configurações deste usuário' });
    }

    // Buscar configurações do paciente
    const settings = await prisma.user_settings.findUnique({
      where: { user_id: targetUserId }
    });

    if (!settings) {
      // Retornar configurações padrão
      return res.json({
        user_id: targetUserId,
        notifications: {
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
          notificationFrequency: "immediate",
          appointmentReminders: true,
          marketingEmails: false
        },
        privacy: {
          shareWithDoctors: true,
          shareWithPartners: false,
          shareFullMedicalHistory: false,
          allowAnonymizedDataUse: true,
          profileVisibility: "contacts",
          allowConsultationRecording: true
        }
      });
    }

    // Retornar apenas informações relevantes de privacidade para médicos
    res.json({
      user_id: settings.user_id,
      privacy: settings.privacy
    });

  } catch (error: any) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Obter informações de uma consulta (para médicos)
router.get('/appointments/:appointmentId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const appointmentId = parseInt(req.params.appointmentId);

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar usuário e verificar se é médico
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { doctors: true }
    });

    if (!user || user.role !== 'doctor') {
      return res.status(403).json({ error: 'Apenas médicos podem acessar informações de consultas' });
    }

    // Buscar consulta
    const appointment = await prisma.appointments.findFirst({
      where: {
        id: appointmentId,
        doctor_id: user.doctors[0]?.id
      },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
            email: true
          }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Consulta não encontrada' });
    }

    res.json(appointment);

  } catch (error: any) {
    console.error('Erro ao buscar consulta:', error);
    res.status(500).json({ error: 'Erro ao buscar consulta' });
  }
});

export default router;