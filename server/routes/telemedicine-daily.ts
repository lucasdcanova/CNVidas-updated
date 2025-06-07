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
import { User } from '@shared/schema';
import { Router } from 'express';
import { DatabaseStorage } from '../storage';
import { toNumberOrThrow } from '../utils/id-converter';
import { db } from '../db';
import { appointments, users } from '@shared/schema';
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
dailyRouter.post('/room', requireAuth, checkSubscription, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) {
      throw new AppError('ID da consulta é obrigatório', 400);
    }

    const appointmentIdNumber = toNumberOrThrow(appointmentId);
    
    // Buscar consulta
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentIdNumber },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!appointment) {
      throw new AppError('Consulta não encontrada', 404);
    }

    // Verificar permissão
    if (!req.user || (appointment.patientId !== toNumberOrThrow(req.user.id) && appointment.doctorId !== toNumberOrThrow(req.user.id))) {
      throw new AppError('Sem permissão para acessar esta consulta', 403);
    }

    // Verificar se já existe sala
    if (appointment.telemedicineRoom) {
      return res.json({
        name: appointment.telemedicineRoom,
        url: `https://cnvidas.daily.co/${appointment.telemedicineRoom}`,
      });
    }

    // Criar nome da sala
    const roomName = sanitizeRoomName(`appointment-${appointmentId}-${Date.now()}`);

    // Criar sala no Daily.co
    const roomData = await createDailyRoom(roomName);

    // Atualizar consulta com informações da sala
    await prisma.appointments.update({
      where: { id: appointmentIdNumber },
      data: {
        telemedicineRoom: roomName,
        telemedicineUrl: roomData.url,
      },
    });

    res.json({
      name: roomName,
      url: roomData.url,
    });
  } catch (error) {
    console.error('Erro ao criar sala:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao criar sala de videoconferência' });
    }
  }
});

/**
 * Rota para gerar token de acesso à videoconferência
 * POST /api/telemedicine/daily/token
 */
dailyRouter.post('/token', requireAuth, checkSubscription, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      throw new AppError('Nome da sala é obrigatório', 400);
    }

    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const token = await generateDailyToken(roomName, req.user.fullName || req.user.username, false);
    res.json(token);
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao gerar token de videoconferência' });
    }
  }
});

/**
 * Rota para iniciar consulta de emergência
 * POST /api/telemedicine/daily/emergency
 */
dailyRouter.post('/emergency', requireAuth, checkSubscription, async (req: Request, res: Response) => {
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
    const availableDoctor = await prisma.doctor.findFirst({
      where: {
        availableForEmergency: true,
      },
      orderBy: {
        createdAt: 'asc'
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
        patientId,
        doctorId: availableDoctor.id,
        isEmergency: true,
        status: 'scheduled',
        symptoms,
        priority,
        scheduledAt: new Date(),
      },
    });
    // Criar sala de videoconferência
    const roomName = sanitizeRoomName(`emergency-${appointment.id}-${Date.now()}`);
    const roomData = await createDailyRoom(roomName);
    // Atualizar consulta com informações da sala
    await prisma.appointments.update({
      where: { id: appointment.id },
      data: {
        telemedicineRoom: roomName,
        telemedicineUrl: roomData.url,
      },
    });
    // Atualizar último atendimento de emergência do médico
    await prisma.doctor.update({
      where: { id: availableDoctor.id },
      data: {
        updatedAt: new Date(),
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