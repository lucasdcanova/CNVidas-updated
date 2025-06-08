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

export default notificationRouter; 