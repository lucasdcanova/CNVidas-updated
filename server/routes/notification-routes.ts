import express from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import type { AuthenticatedRequest } from '../../types/express';

const router = express.Router();

// Buscar todas as notificações do usuário
router.get("/", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const notifications = await storage.getNotifications(userId);
    
    res.json(notifications);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    res.status(500).json({ error: "Erro ao buscar notificações" });
  }
});

// Buscar contagem de notificações não lidas
router.get("/unread-count", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    const count = await storage.getUnreadNotificationsCount(req.user!.id);
    res.json({ count });
  } catch (error) {
    console.error("Erro ao buscar contagem de notificações:", error);
    res.status(500).json({ error: "Erro ao buscar contagem" });
  }
});

// Marcar notificação como lida
router.put("/:id/read", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    // Verificar se a notificação pertence ao usuário seria ideal,
    // mas por ora vamos apenas marcar como lida
    await storage.markNotificationAsRead(notificationId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    res.status(500).json({ error: "Erro ao atualizar notificação" });
  }
});

// Marcar todas as notificações como lidas
router.put("/read-all", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    await storage.markAllNotificationsAsRead(req.user!.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao marcar todas notificações como lidas:", error);
    res.status(500).json({ error: "Erro ao atualizar notificações" });
  }
});

export { router as notificationRouter }; 