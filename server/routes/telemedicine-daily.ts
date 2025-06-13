/**
 * Routes para intregração com o Daily.co
 */
import express, { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { storage } from '../storage';
import { createRoom, createMeetingToken, createToken } from '../utils/daily';
import { checkSubscriptionFeature } from '../middleware/subscription-check';
import axios, { AxiosError } from 'axios';
import { checkSubscription } from '../middleware/check-subscription';
import { jsonResponse } from '../middleware/json-response';
import { prisma } from '../lib/prisma';
import { sanitizeRoomName } from '../utils/sanitize';
import Daily from '@daily-co/daily-js';
import { AppError } from '../utils/app-error';
import { User } from '../../shared/schema';
import { Router } from 'express';
import { DatabaseStorage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';
import { db } from '../db';
import { appointments, users } from '../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Interface para resposta da API do Daily.co
interface DailyRoomResponse {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: {
    enable_chat: boolean;
    enable_recording: string;
    enable_screenshare: boolean;
    enable_video_processing: boolean;
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

const dailyRouter = Router();

// Middleware para garantir respostas JSON
dailyRouter.use(jsonResponse);

// Middleware de autenticação compatível com Express
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Constantes
const DAILY_API_URL = 'https://api.daily.co/v1';
const DAILY_API_KEY = process.env.DAILY_API_KEY;

// Funções auxiliares
const createDailyRoom = async (roomName: string): Promise<DailyRoomResponse> => {
  if (!DAILY_API_KEY) {
    throw new AppError('DAILY_API_KEY não configurada', 500);
  }

  try {
    const response = await axios.post<DailyRoomResponse>(
      `${DAILY_API_URL}/rooms`,
      {
        name: roomName,
        privacy: 'private',
        properties: {
          enable_chat: true,
          enable_recording: 'cloud',
          enable_screenshare: true,
          enable_video_processing: true,
          exp: Math.round(Date.now() / 1000) + 24 * 60 * 60, // 24 horas
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Erro ao criar sala Daily.co:', error.response?.data || error.message);
      throw new AppError(`Erro ao criar sala Daily.co: ${error.response?.data?.error || error.message}`, 500);
    }
    throw error;
  }
};

const generateDailyToken = async (roomName: string, userName: string, isOwner: boolean): Promise<DailyTokenResponse> => {
  if (!DAILY_API_KEY) {
    throw new AppError('DAILY_API_KEY não configurada', 500);
  }

  try {
    const response = await axios.post<DailyTokenResponse>(
      `${DAILY_API_URL}/meeting-tokens`,
      {
        properties: {
          room_name: roomName,
          user_name: userName,
          is_owner: isOwner,
          exp: Math.round(Date.now() / 1000) + 24 * 60 * 60, // 24 horas
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Erro ao gerar token Daily.co:', error.response?.data || error.message);
    } else {
      console.error('Erro ao gerar token Daily.co:', error);
    }
    throw new AppError('Falha ao gerar token de videoconferência', 500);
  }
};

/**
 * Rota para criar ou obter uma sala de videoconferência
 * POST /api/telemedicine/daily/room
 */
dailyRouter.post('/room', requireAuth, checkSubscriptionFeature('telemedicine'), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  console.log('🚀 [Daily Room] Recebendo requisição:', {
    appointmentId: req.body.appointmentId,
    roomName: req.body.roomName,
    isEmergency: req.body.isEmergency,
    userId: authReq.user?.id,
    userRole: authReq.user?.role
  });
  
  try {
    const { appointmentId, roomName: customRoomName, isEmergency } = req.body;
    
    // Se foi fornecido um roomName customizado (para emergência)
    if (customRoomName && isEmergency) {
      console.log('🏠 [Daily Room] Criando sala de emergência:', customRoomName);
      
      try {
        // Tentar criar a sala
        const roomData = await createDailyRoom(customRoomName);
        console.log('✅ [Daily Room] Sala criada com sucesso:', roomData.url);
        
        return res.json({
          name: customRoomName,
          url: roomData.url,
          status: 'created'
        });
      } catch (error: any) {
        // Se a sala já existe, retornar a URL esperada
        if (error.message?.includes('already exists') || error.response?.status === 422) {
          console.log('⚠️ [Daily Room] Sala já existe, retornando URL:', customRoomName);
          return res.json({
            name: customRoomName,
            url: `https://cnvidas.daily.co/${customRoomName}`,
            status: 'existing'
          });
        }
        throw error;
      }
    }
    
    if (!appointmentId) {
      throw new AppError('ID da consulta é obrigatório', 400);
    }

    const appointmentIdNumber = toNumberOrThrow(appointmentId);
    
    // Buscar consulta
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentIdNumber),
      with: {
        user: true,
      },
    });

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Verificar permissão
    if (!authReq.user || (appointment.userId !== authReq.user.id && appointment.doctorId !== authReq.user.id)) {
      throw new AppError('Sem permissão para acessar esta consulta', 403);
    }

    // Verificar se já existe sala
    if (appointment.telemedRoomName) {
      return res.json({
        name: appointment.telemedRoomName,
        url: `https://cnvidas.daily.co/${appointment.telemedRoomName}`,
      });
    }

    // Criar nome da sala
    const roomName = sanitizeRoomName(`appointment-${appointmentId}-${Date.now()}`);

    console.log('🎭 [Daily Room] Criando nova sala:', roomName);
    
    try {
      // Criar sala no Daily.co
      const roomData = await createDailyRoom(roomName);
      console.log('✅ [Daily Room] Sala criada com sucesso:', roomData.url);

      // Atualizar consulta com informações da sala
      await db.update(appointments)
        .set({
          telemedRoomName: roomName,
          telemedLink: roomData.url,
        })
        .where(eq(appointments.id, appointmentIdNumber));

      res.json({
        name: roomName,
        url: roomData.url,
        status: 'created'
      });
    } catch (error: any) {
      // Se a sala já existe, ainda assim atualizar no banco
      if (error.message?.includes('already exists') || error.response?.status === 422) {
        console.log('⚠️ [Daily Room] Sala já existe, atualizando banco:', roomName);
        
        const roomUrl = `https://cnvidas.daily.co/${roomName}`;
        await db.update(appointments)
          .set({
            telemedRoomName: roomName,
            telemedLink: roomUrl,
          })
          .where(eq(appointments.id, appointmentIdNumber));

        res.json({
          name: roomName,
          url: roomUrl,
          status: 'existing'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Rota para gerar token de acesso à videoconferência
 * POST /api/telemedicine/daily/token
 */
dailyRouter.post('/token', requireAuth, checkSubscriptionFeature('telemedicine'), async (req: Request, res: Response) => {
  // Garantir que a resposta será JSON
  res.setHeader('Content-Type', 'application/json');
  
  const authReq = req as AuthenticatedRequest;
  console.log('🔑 [Daily Token] Recebendo requisição:', {
    roomName: req.body.roomName,
    appointmentId: req.body.appointmentId,
    isDoctor: req.body.isDoctor,
    userId: authReq.user?.id,
    userName: authReq.user?.fullName || authReq.user?.username
  });
  
  try {
    const { roomName, isDoctor } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: 'Nome da sala é obrigatório' });
    }

    if (!authReq.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userName = authReq.user.fullName || authReq.user.username || 'Usuário';
    const isOwner = isDoctor === true || authReq.user.role === 'doctor';
    
    console.log('🎫 [Daily Token] Gerando token:', { roomName, userName, isOwner });
    
    const tokenData = await generateDailyToken(roomName, userName, isOwner);
    
    console.log('✅ [Daily Token] Token gerado com sucesso');
    
    return res.json(tokenData);
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Erro ao gerar token de videoconferência' });
    }
  }
});

/**
 * Rota para iniciar consulta de emergência
 * POST /api/telemedicine/daily/emergency
 */
dailyRouter.post('/emergency', requireAuth, checkSubscriptionFeature('emergency_consultation'), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { patientId, symptoms, priority } = req.body;
    if (!patientId || !symptoms) {
      return res.status(400).json({
        error: 'ID do paciente e sintomas são obrigatórios',
      });
    }
    // Verificar se o usuário é o paciente
    if (!authReq.user || patientId !== authReq.user.id) {
      return res.status(403).json({
        error: 'Sem permissão para criar consulta de emergência',
      });
    }
    // Buscar médico disponível
    const availableDoctor = await prisma.doctors.findFirst({
      where: {
        available_for_emergency: true,
      },
      orderBy: {
        created_at: 'asc'
      },
    });
    if (!availableDoctor) {
      return res.status(503).json({
        error: 'Nenhum médico disponível para emergência no momento',
      });
    }
    // Criar consulta de emergência
    const appointment = await prisma.appointments.create({
      data: {
        user_id: patientId,
        doctor_id: availableDoctor.id,
        is_emergency: true,
        status: 'scheduled',
        type: 'telemedicine',
        date: new Date(),
        duration: 30,
        notes: `Sintomas: ${symptoms}, Prioridade: ${priority}`
      },
    });
    // Criar sala de videoconferência
    const roomName = sanitizeRoomName(`emergency-${appointment.id}-${Date.now()}`);
    const roomData = await createDailyRoom(roomName);
    // Atualizar consulta com informações da sala
    await prisma.appointments.update({
      where: { id: appointment.id },
      data: {
        telemed_room_name: roomName,
        telemed_link: roomData.url,
      },
    });
    // Atualizar último atendimento de emergência do médico
    await prisma.doctors.update({
      where: { id: availableDoctor.id },
      data: {
        updated_at: new Date(),
      },
    });
    res.json({
      appointmentId: appointment.id,
      roomName,
      roomUrl: roomData.url,
    });
  } catch (error: any) {
    console.error('Erro ao criar consulta de emergência:', error);
    res.status(500).json({
      error: error.message || 'Erro ao criar consulta de emergência',
    });
  }
});

export default dailyRouter;