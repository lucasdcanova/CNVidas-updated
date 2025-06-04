import type { Express } from "express";
import { Router } from 'express';

interface DailyRoom {
  id: string;
  name: string;
  url: string;
  created_at: string;
  config: any;
}

interface CreateRoomResponse {
  id: string;
  name: string;
  url: string;
  created_at: string;
  config: any;
}

const dailyEmergencyRouter = Router();

export function registerDailyEmergencyRoutes(app: Express): void {
  // Criar sala de emergência
  app.post("/api/emergency/create-room", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user!;
      const roomName = `emergency-${user.id}-${Date.now()}`;

      console.log('Criando sala de emergência:', roomName);

      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            start_video_off: false,
            start_audio_off: false,
            enable_screenshare: true,
            enable_chat: true,
            exp: Math.round(Date.now() / 1000) + (60 * 60 * 2), // Expira em 2 horas
            max_participants: 10,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta da Daily.co:', response.status, errorText);
        throw new Error(`Daily.co API error: ${response.status} - ${errorText}`);
      }

      const room: CreateRoomResponse = await response.json();
      console.log('Sala criada com sucesso:', room.name);

      res.json({
        roomName: room.name,
        roomUrl: room.url,
        roomId: room.id,
      });

    } catch (error) {
      console.error('Erro ao criar sala de emergência:', error);
      res.status(500).json({ 
        message: "Erro ao criar sala de emergência",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Deletar sala de emergência após uso
  app.delete("/api/emergency/delete-room/:roomName", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { roomName } = req.params;
      console.log('Deletando sala de emergência:', roomName);

      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${process.env.DAILY_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('Erro ao deletar sala:', response.status);
        // Não falhar se não conseguir deletar - a sala expira automaticamente
      }

      res.json({ success: true });

    } catch (error) {
      console.error('Erro ao deletar sala de emergência:', error);
      // Não falhar se não conseguir deletar
      res.json({ success: true });
    }
  });
}

export default dailyEmergencyRouter;