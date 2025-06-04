import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { Router } from 'express';

const dailyRouter = Router();

export function registerDailyRoutes(app: Express): void {
  // Rota para criar uma sala Daily.co
  app.post('/api/daily/create-room', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // Para demonstração, retornar uma URL de sala fictícia
      // Em produção, você integraria com a API do Daily.co
      const roomData = {
        url: `https://cnvidas.daily.co/room-${Date.now()}`,
        name: `room-${Date.now()}`,
        privacy: req.body.privacy || 'private',
        properties: req.body.properties || {}
      };

      console.log('Criando sala Daily.co:', roomData);

      res.json(roomData);
    } catch (error: any) {
      console.error('Erro ao criar sala Daily.co:', error);
      res.status(500).json({ 
        message: 'Erro ao criar sala de videochamada',
        error: error.message 
      });
    }
  });

  // Rota para obter token de acesso à sala
  app.post('/api/daily/get-token', async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
      const { roomName } = req.body;
      
      // Para demonstração, retornar um token fictício
      // Em produção, você integraria com a API do Daily.co
      const token = `daily-token-${Date.now()}-${req.user!.id}`;

      console.log('Gerando token Daily.co para sala:', roomName);

      res.json({ token });
    } catch (error: any) {
      console.error('Erro ao gerar token Daily.co:', error);
      res.status(500).json({ 
        message: 'Erro ao gerar token de acesso',
        error: error.message 
      });
    }
  });
}

export default dailyRouter;