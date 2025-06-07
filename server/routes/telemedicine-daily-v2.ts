/**
 * Routes para integração robusta com o Daily.co
 * Implementação alternativa com acesso direto à API
 */
import express, { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { storage } from '../storage';
import { checkSubscriptionFeature } from '../middleware/subscription-check';
import axios, { AxiosError } from 'axios';
import { ensureDailyJsonResponse } from '../middleware/json-response';
import { User } from '@shared/schema';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';
import { Router } from 'express';
import { DatabaseStorage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';

// Interface para resposta da API do Daily.co
interface DailyRoomResponse {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: {
    enable_screenshare: boolean;
    enable_chat: boolean;
    start_video_off: boolean;
    exp: number;
  };
}

// Interface para resposta do token do Daily.co
interface DailyTokenResponse {
  token: string;
  room_name: string;
  user_name: string;
  is_owner: boolean;
  exp: number;
}

// Interface para propriedades da sala
interface RoomProperties {
  enable_screenshare?: boolean;
  enable_chat?: boolean;
  start_video_off?: boolean;
  exp?: number;
  [key: string]: any;
}

// Router para rotas do Daily.co
export const telemedicineRouter = express.Router();

// Aplicar middleware para garantir respostas JSON
telemedicineRouter.use(ensureDailyJsonResponse);

// Middleware de autenticação compatível com Express
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Middleware de tratamento de erros
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message });
  }
};

// Configurações do Daily.co
const DAILY_API_URL = 'https://api.daily.co/v1';
const DAILY_API_KEY = process.env.DAILY_API_KEY;

// Funções auxiliares
const sanitizeRoomName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
};

const createDailyRoom = async (roomName: string, properties: RoomProperties = {}): Promise<DailyRoomResponse> => {
  if (!DAILY_API_KEY) {
    throw new AppError('DAILY_API_KEY não configurada', 500);
  }

  try {
    const response = await axios.post<DailyRoomResponse>(`${DAILY_API_URL}/rooms`, {
      name: roomName,
      properties: {
        enable_screenshare: true,
        enable_chat: true,
        start_video_off: false,
        exp: Math.floor(Date.now() / 1000) + 120 * 60, // 2 horas
        ...properties
      }
    }, {
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Erro ao criar sala Daily.co:', error.response?.data || error.message);
      throw new AppError(`Erro ao criar sala Daily.co: ${error.response?.data?.error || error.message}`, 500);
    }
    throw error;
  }
};

const createDailyToken = async (roomName: string, userName: string, isOwner: boolean = false): Promise<DailyTokenResponse> => {
  if (!DAILY_API_KEY) {
    throw new AppError('DAILY_API_KEY não configurada', 500);
  }

  try {
    const response = await axios.post<DailyTokenResponse>(`${DAILY_API_URL}/meeting-tokens`, {
      properties: {
        room_name: roomName,
        user_name: userName,
        exp: Math.floor(Date.now() / 1000) + 120 * 60, // 2 horas
        is_owner: isOwner
      }
    }, {
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Erro ao gerar token Daily.co:', error.response?.data || error.message);
      throw new AppError(`Erro ao gerar token Daily.co: ${error.response?.data?.error || error.message}`, 500);
    }
    throw error;
  }
};

// Rotas principais
telemedicineRouter.post('/room', requireAuth, checkSubscriptionFeature("telemedicine"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId, roomName: customRoomName } = req.body;
    
    if (!appointmentId && !customRoomName) {
      throw new AppError('ID da consulta ou nome da sala é obrigatório', 400);
    }

    let roomName: string;
    let appointment: any = null;
    
    if (appointmentId) {
      const appointmentIdNumber = toNumberOrThrow(appointmentId);
      
      appointment = await prisma.appointments.findUnique({
        where: { id: appointmentIdNumber }
      });
      
      if (!appointment) {
        throw new AppError('Consulta não encontrada', 404);
      }
      
      // Verificar se o usuário tem permissão para acessar esta consulta
      if (!req.user || (appointment.userId !== toNumberOrThrow(req.user.id) && req.user.role !== 'admin')) {
        throw new AppError('Não autorizado', 403);
      }
      
      roomName = appointment.telemedicineRoom || 
                (appointment.type === 'emergency' ? `emergency-${appointmentIdNumber}` : `consultation-${appointmentIdNumber}`);
    } else {
      roomName = customRoomName;
    }
    
    const sanitizedRoomName = sanitizeRoomName(roomName);
    
    try {
      const roomData = await createDailyRoom(sanitizedRoomName);
      
      if (appointment) {
        await prisma.appointments.update({
          where: { id: toNumberOrThrow(appointment.id) },
          data: {
            telemedicineRoom: sanitizedRoomName,
            type: 'telemedicine'
          }
        });
      }
      
      return res.status(200).json(roomData);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Erro ao criar sala:', error.response?.data || error.message);
        throw new AppError('Erro ao criar sala de videoconferência', 500);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

telemedicineRouter.post('/token', requireAuth, checkSubscriptionFeature("telemedicine"), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { roomName, userName, isOwner = false } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ 
        error: "Nome da sala é obrigatório" 
      });
    }
    
    const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    try {
      const tokenData = await createDailyToken(
        sanitizedRoomName,
        userName || (authReq.user ? authReq.user.fullName : 'Usuário'),
        isOwner
      );
      
      return res.status(200).json(tokenData);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Erro ao gerar token:', error.response?.data || error.message);
        return res.status(500).json({ 
          error: "Erro ao gerar token de videoconferência",
          details: error.response?.data || error.message
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro na rota /token:', error);
    return res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Rota para consultas de emergência
telemedicineRouter.post('/emergency', requireAuth, checkSubscriptionFeature("emergency_consultation"), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { doctorId } = req.body;
    
    if (!doctorId) {
      return res.status(400).json({ 
        error: "ID do médico é obrigatório" 
      });
    }
    
    const doctor = await storage.getDoctor(parseInt(doctorId));
    if (!doctor) {
      return res.status(404).json({ 
        error: "Médico não encontrado" 
      });
    }
    
    if (!doctor.availableForEmergency) {
      return res.status(400).json({ 
        error: "Este médico não está disponível para consultas de emergência" 
      });
    }
    
    if (!authReq.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    
    const appointment = await storage.createAppointment({
      userId: authReq.user.id,
      doctorId: doctor.id,
      date: new Date(),
      status: 'confirmed',
      type: 'telemedicine',
      isEmergency: true,
      duration: 30,
      notes: 'Consulta de emergência',
      specialization: doctor.specialization || ''
    });
    
    const roomName = `emergency-${appointment.id}`;
    const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    try {
      const roomData = await createDailyRoom(sanitizedRoomName);
      
      await storage.updateAppointment(appointment.id, {
        telemedProvider: "daily",
        telemedRoomName: sanitizedRoomName,
        telemedLink: `/telemedicine/${appointment.id}`
      });
      
      await storage.createNotification({
        userId: doctor.userId,
        type: 'appointment',
        title: 'Consulta de Emergência',
        message: `Paciente ${authReq.user.fullName || authReq.user.username} iniciou uma consulta de emergência`,
        link: `/telemedicine/${appointment.id}`,
        relatedId: appointment.id
      });
      
      return res.status(200).json({
        ...roomData,
        appointmentId: appointment.id
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('Erro ao criar sala de emergência:', error.response?.data || error.message);
        return res.status(500).json({ 
          error: "Erro ao criar sala de videoconferência",
          details: error.response?.data || error.message
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro na rota /emergency:', error);
    return res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default telemedicineRouter;