import express from 'express';
import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import { User } from '../../shared/schema';
import { isAuthenticated } from '../middleware/auth.js';
import { AppError } from '../utils/app-error';
import { DatabaseStorage } from '../storage';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { checkSubscriptionFeature } from '../middleware/subscription-check';
import { db } from '../db';
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
    enable_chat: boolean;
    enable_screenshare: boolean;
    start_video_off: boolean;
    start_audio_off: boolean;
    exp: number;
  };
}

// Interface para resposta de verificação de sala
interface RoomCheckResponse {
  exists: boolean;
  room?: DailyRoomResponse;
  message: string;
  error?: string;
}

// Interface para resposta de criação de sala
interface RoomCreateResponse {
  message: string;
  room: DailyRoomResponse;
  created: boolean;
  recovered?: boolean;
  error?: string;
}

const dailyDirectRouter = express.Router();

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

/**
 * Rota para verificar se uma sala existe
 * GET /api/daily-direct/room-exists
 */
dailyDirectRouter.get('/room-exists', requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.query;
    if (!roomName || typeof roomName !== 'string') {
      throw new AppError('Nome da sala é obrigatório', 400);
    }

    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      throw new AppError('Configuração da API Daily.co ausente', 500);
    }
    
    try {
      console.log(`Verificando existência da sala ${roomName} no Daily.co`);
      
      // Acessar a API do Daily.co para verificar se a sala existe
      const response = await axios.get<DailyRoomResponse>(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dailyApiKey}`
        }
      });
      
      // Sala existe
      console.log(`Sala ${roomName} existe no Daily.co:`, response.data);
      return res.json({ 
        exists: true, 
        room: response.data,
        message: 'Sala encontrada'
      } as RoomCheckResponse);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Sala não existe
          console.log(`Sala ${roomName} NÃO existe no Daily.co`);
          return res.json({ 
            exists: false,
            message: 'Sala não encontrada'
          } as RoomCheckResponse);
        }
        
        // Outros erros
        console.error(`Erro ao verificar sala ${roomName}:`, error.response?.data);
        throw new AppError(`Erro ao verificar sala: ${error.response?.data?.error || error.message}`, error.response?.status || 500);
      }
      
      console.error(`Erro ao verificar sala ${roomName}:`, error);
      throw new AppError('Erro ao verificar sala', 500);
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
 * Rota para criar uma sala
 * POST /api/daily-direct/create-room
 */
dailyDirectRouter.post('/create-room', requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName, forceCreate = false, expiryHours = 24 } = req.body;
    
    if (!roomName || typeof roomName !== 'string') {
      throw new AppError('Nome da sala é obrigatório', 400);
    }
    
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      throw new AppError('Configuração da API Daily.co ausente', 500);
    }
    
    console.log(`Criando sala ${roomName} diretamente no Daily.co`);
    
    // Sanitizar nome da sala
    const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9-]/g, '-');
    
    // Verificar se a sala já existe (se não forçar criação)
    if (!forceCreate) {
      try {
        const checkResponse = await axios.get<DailyRoomResponse>(`https://api.daily.co/v1/rooms/${sanitizedRoomName}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${dailyApiKey}`
          }
        });
        
        // Sala já existe
        console.log(`Sala ${sanitizedRoomName} já existe no Daily.co:`, checkResponse.data);
        return res.json({
          message: 'Sala já existe',
          room: checkResponse.data,
          created: false
        } as RoomCreateResponse);
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }
      }
    }
    
    // Calcular expiração
    const expirySeconds = Number(expiryHours) * 60 * 60;
    
    // Criar a sala
    try {
      const createResponse = await axios.post<DailyRoomResponse>('https://api.daily.co/v1/rooms', {
        name: sanitizedRoomName,
        properties: {
          exp: Math.floor(Date.now() / 1000) + expirySeconds, // Expira em X horas
          enable_chat: true,
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dailyApiKey}`
        }
      });
      
      // Sala criada com sucesso
      console.log(`Sala ${sanitizedRoomName} criada com sucesso:`, createResponse.data);
      return res.json({
        message: 'Sala criada com sucesso',
        room: createResponse.data,
        created: true
      } as RoomCreateResponse);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Erro ao criar sala ${sanitizedRoomName}:`, error.response?.data);
        throw new AppError(`Erro ao criar sala: ${error.response?.data?.error || error.message}`, error.response?.status || 500);
      }
      
      console.error(`Erro ao criar sala ${sanitizedRoomName}:`, error);
      throw new AppError('Erro ao criar sala', 500);
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
 * Gera token de acesso diretamente no Daily.co
 * POST /api/telemedicine/daily-direct/token
 */
dailyDirectRouter.post('/token', async (req: Request, res: Response) => {
  const { roomName, userName, isOwner = false, expiryHours = 24 } = req.body;
  
  if (!roomName || typeof roomName !== 'string') {
    return res.status(400).json({ error: 'Nome da sala é obrigatório' });
  }
  
  const dailyApiKey = process.env.DAILY_API_KEY;
  if (!dailyApiKey) {
    console.error('DAILY_API_KEY não está configurada');
    return res.status(500).json({ error: 'Configuração da API Daily.co ausente' });
  }
  
  try {
    console.log(`Gerando token para sala ${roomName} com usuário ${userName || 'anônimo'}`);
    
    // Calcular expiração
    const expirySeconds = Number(expiryHours) * 60 * 60;
    
    // Gerar token
    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dailyApiKey}`
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName || 'Usuário CN Vidas',
          exp: Math.floor(Date.now() / 1000) + expirySeconds,
          is_owner: isOwner
        }
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`Erro ao gerar token para sala ${roomName}:`, errorText);
      return res.status(tokenResponse.status).json({ 
        error: `Erro ao gerar token: ${tokenResponse.status}`,
        message: errorText
      });
    }
    
    // Token gerado com sucesso
    const tokenInfo = await tokenResponse.json();
    console.log(`Token gerado com sucesso para sala ${roomName}`);
    
    return res.json({
      message: 'Token gerado com sucesso',
      token: tokenInfo.token
    });
  } catch (error) {
    console.error(`Erro ao gerar token para sala ${roomName}:`, error);
    return res.status(500).json({ 
      error: 'Erro ao gerar token',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Rota para deletar uma sala
dailyDirectRouter.delete('/rooms/:roomName', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { roomName } = req.params;
    
    // Verificar se o usuário tem permissão (admin ou doctor)
    if (!authReq.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    if (authReq.user.role !== 'admin' && authReq.user.role !== 'doctor') {
      throw new AppError('Sem permissão para deletar salas', 403);
    }

    if (!process.env.DAILY_API_KEY) {
      throw new AppError('API Key do Daily.co não configurada', 500);
    }

    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      }
    });

    if (response.status === 404) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new AppError(`Erro ao deletar sala: ${errorData.error || response.statusText}`, response.status);
    }

    res.json({
      success: true,
      message: 'Sala deletada com sucesso',
      room_name: roomName,
      deleted_by: String(authReq.user?.id || 'unknown')
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

export default dailyDirectRouter;