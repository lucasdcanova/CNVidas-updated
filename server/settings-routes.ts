import { Router, Request, Response } from 'express';
import { storage } from './storage';

const settingsRouter = Router();

// Middleware para verificar autenticação
const isAuthenticated = async (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  next();
};

// Obter configurações de usuário
settingsRouter.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = await storage.getUserSettings(userId);
    return res.status(200).json(settings);
  } catch (error) {
    console.error("Erro ao obter configurações do usuário:", error);
    return res.status(500).json({ message: "Erro ao processar solicitação" });
  }
});

// Atualizar configurações de usuário
settingsRouter.put('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { notifications, privacy } = req.body;
    
    // Verificar se pelo menos um campo foi fornecido
    if (!notifications && !privacy) {
      return res.status(400).json({ message: "Nenhuma configuração fornecida para atualização" });
    }
    
    // Construir objeto de configurações a ser atualizado
    const settingsToUpdate: Partial<{ notifications: any, privacy: any }> = {};
    
    if (notifications) {
      settingsToUpdate.notifications = notifications;
    }
    
    if (privacy) {
      settingsToUpdate.privacy = privacy;
    }
    
    // Atualizar configurações
    const updatedSettings = await storage.saveUserSettings(userId, settingsToUpdate);
    
    return res.status(200).json(updatedSettings);
  } catch (error) {
    console.error("Erro ao atualizar configurações do usuário:", error);
    return res.status(500).json({ message: "Erro ao processar solicitação" });
  }
});

export default settingsRouter;