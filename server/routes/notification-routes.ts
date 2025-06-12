import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { storage } from '../storage';
import { AppError } from '../utils/app-error';

const notificationRouter = express.Router();

/**
 * Buscar todas as notificações do usuário
 * GET /api/notifications
 */
notificationRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Notifications - Buscando notificações do usuário ID:', req.user?.id);
    
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const notifications = await storage.getNotifications(userId);
    
    console.log('✅ Notifications - Notificações encontradas:', notifications.length);
    res.json(notifications);
  } catch (error) {
    console.error("❌ Erro ao buscar notificações:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  }
});

/**
 * Buscar contagem de notificações não lidas
 * GET /api/notifications/unread-count
 */
notificationRouter.get("/unread-count", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Notifications /unread-count - Buscando contagem para usuário ID:', req.user?.id);
    
    const count = await storage.getUnreadNotificationsCount(req.user!.id);
    
    console.log('✅ Notifications /unread-count - Contagem:', count);
    res.json({ count });
  } catch (error) {
    console.error("❌ Erro ao buscar contagem de notificações:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao buscar contagem" });
    }
  }
});

/**
 * Marcar notificação como lida
 * PUT /api/notifications/:id/read
 */
notificationRouter.put("/:id/read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    console.log('🔍 Notifications PUT /:id/read - Marcando como lida:', notificationId);
    
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'ID de notificação inválido' });
    }
    
    // Verificar se a notificação pertence ao usuário seria ideal,
    // mas por ora vamos apenas marcar como lida
    await storage.markNotificationAsRead(notificationId);
    
    console.log('✅ Notifications PUT /:id/read - Marcada como lida');
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erro ao marcar notificação como lida:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao atualizar notificação" });
    }
  }
});

/**
 * Marcar notificação como lida (compatibilidade)
 * POST /api/notifications/mark-read
 */
notificationRouter.post("/mark-read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { notificationId } = req.body;
    
    console.log('🔍 Notifications POST /mark-read - Marcando como lida:', notificationId);
    
    if (!notificationId || isNaN(parseInt(notificationId))) {
      return res.status(400).json({ error: 'ID de notificação inválido' });
    }
    
    await storage.markNotificationAsRead(parseInt(notificationId));
    
    console.log('✅ Notifications POST /mark-read - Marcada como lida');
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erro ao marcar notificação como lida:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao atualizar notificação" });
    }
  }
});

/**
 * Marcar todas as notificações como lidas
 * PUT /api/notifications/read-all
 */
notificationRouter.put("/read-all", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Notifications PUT /read-all - Marcando todas como lidas para usuário ID:', req.user?.id);
    
    await storage.markAllNotificationsAsRead(req.user!.id);
    
    console.log('✅ Notifications PUT /read-all - Todas marcadas como lidas');
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erro ao marcar todas notificações como lidas:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao atualizar notificações" });
    }
  }
});

/**
 * Buscar atividades recentes do usuário
 * GET /api/notifications/recent-activities
 */
notificationRouter.get("/recent-activities", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Activities - Buscando atividades recentes do usuário ID:', req.user?.id);
    
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Buscar atividades de múltiplas fontes
    const activities: any[] = [];
    
    // 1. Consultas agendadas/realizadas
    try {
      const appointments = await storage.getUserAppointments(userId);
      appointments.slice(0, 5).forEach(appointment => {
        activities.push({
          id: `appointment-${appointment.id}`,
          type: 'appointment',
          title: appointment.status === 'completed' ? 'Consulta Realizada' : 
                 appointment.status === 'scheduled' ? 'Consulta Agendada' :
                 appointment.isEmergency ? 'Consulta de Emergência' : 'Consulta',
          description: appointment.isEmergency ? 
            'Consulta de emergência realizada com sucesso' :
            `Consulta ${appointment.status === 'completed' ? 'concluída' : 'agendada'} - ${appointment.specialization || 'Clínico Geral'}`,
          date: new Date(appointment.createdAt),
          icon: appointment.isEmergency ? 'emergency' : 'videocam',
          status: appointment.status,
          link: '/appointments'
        });
      });
    } catch (error) {
      console.log('Erro ao buscar consultas:', error);
    }
    
    // 2. Sinistros submetidos/atualizados
    try {
      const claims = await storage.getUserClaims(userId);
      claims.slice(0, 5).forEach(claim => {
        activities.push({
          id: `claim-${claim.id}`,
          type: 'claim',
          title: claim.status === 'em análise' ? 'Sinistro em Análise' :
                 claim.status === 'aprovado' ? 'Sinistro Aprovado' :
                 claim.status === 'rejeitado' ? 'Sinistro Rejeitado' : 'Sinistro Enviado',
          description: `${claim.type || 'Sinistro'} - ${claim.description ? claim.description.substring(0, 100) + '...' : 'Aguardando análise'}`,
          date: new Date(claim.createdAt),
          icon: 'description',
          status: claim.status,
          link: '/claims'
        });
      });
    } catch (error) {
      console.log('Erro ao buscar sinistros:', error);
    }
    
    // 3. Atualizações de plano (verificar histórico na tabela users)
    try {
      const user = await storage.getUser(userId);
      if (user?.subscriptionPlan && user.subscriptionPlan !== 'free') {
        activities.push({
          id: `subscription-${userId}`,
          type: 'subscription',
          title: 'Plano Ativado',
          description: `Plano ${user.subscriptionPlan.charAt(0).toUpperCase() + user.subscriptionPlan.slice(1)} ativado com sucesso`,
          date: new Date(user.updatedAt || user.createdAt),
          icon: 'verified_user',
          status: user.subscriptionStatus || 'active',
          link: '/subscription'
        });
      }
    } catch (error) {
      console.log('Erro ao buscar dados de plano:', error);
    }
    
    // 4. Leituras de QR Code (buscar logs de autenticação)
    try {
      const qrLogs = await storage.getQrAuthLogs(5, 0);
      qrLogs.filter(log => log.tokenUserName && log.tokenUserName.includes(user?.fullName || '')).forEach(log => {
        activities.push({
          id: `qr-scan-${log.id}`,
          type: 'qr_scan',
          title: 'QR Code Verificado',
          description: `Seu QR Code foi escaneado por ${log.scannerName || 'Parceiro'} para verificação de identidade`,
          date: new Date(log.createdAt),
          icon: 'qr_code_scanner',
          status: 'verified',
          link: '/qr-code'
        });
      });
    } catch (error) {
      console.log('Erro ao buscar logs de QR Code:', error);
    }

    // 5. Dependentes adicionados
    try {
      // Buscar dependentes recentes (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Aqui você pode implementar uma query para buscar dependentes recentes
      // Por enquanto, vamos simular baseado na data de criação do usuário
    } catch (error) {
      console.log('Erro ao buscar dependentes:', error);
    }

    // 6. Notificações do sistema
    try {
      const notifications = await storage.getNotifications(userId);
      notifications.slice(0, 3).forEach(notification => {
        activities.push({
          id: `notification-${notification.id}`,
          type: notification.type,
          title: notification.title,
          description: notification.message,
          date: new Date(notification.createdAt),
          icon: notification.type === 'appointment' ? 'videocam' :
                notification.type === 'claim' ? 'description' :
                notification.type === 'subscription' ? 'verified_user' :
                notification.type === 'payment' ? 'payment' :
                notification.type === 'qr_scan' ? 'qr_code_scanner' :
                notification.type === 'checkout' ? 'shopping_cart' :
                notification.type === 'dependent' ? 'family_restroom' :
                notification.type === 'profile' ? 'person' :
                notification.type === 'system' ? 'info' : 'notifications',
          status: 'active',
          link: notification.link || '/'
        });
      });
    } catch (error) {
      console.log('Erro ao buscar notificações:', error);
    }
    
    // 5. Adicionar atividades de welcome para novos usuários
    try {
      const user = await storage.getUser(userId);
      const userCreatedRecently = user && new Date(user.createdAt).getTime() > (Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias
      
      if (userCreatedRecently) {
        activities.push({
          id: `welcome-${userId}`,
          type: 'system',
          title: 'Bem-vindo à CN Vidas!',
          description: 'Sua conta foi criada com sucesso. Explore nossos serviços de saúde digital.',
          date: new Date(user.createdAt),
          icon: 'celebration',
          status: 'active',
          link: '/dashboard'
        });
      }
    } catch (error) {
      console.log('Erro ao verificar usuário:', error);
    }
    
    // Ordenar por data (mais recente primeiro) e aplicar limite
    const sortedActivities = activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
    
    console.log('✅ Activities - Atividades encontradas:', sortedActivities.length);
    res.json(sortedActivities);
    
  } catch (error) {
    console.error("❌ Erro ao buscar atividades recentes:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao buscar atividades recentes" });
    }
  }
});

export default notificationRouter; 