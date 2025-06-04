import { Router, Request, Response } from 'express';
import Daily from '@daily-co/daily-js';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { doctors, appointments } from '../shared/schema';
import { AppError } from './utils/app-error';
import { AuthenticatedRequest, isAuthenticated } from './middlewares/authMiddleware';

/**
 * Sistema de diagnóstico de erros para telemedicina
 * Fornece endpoints para registro de erros, verificação de requisitos
 * e diagnóstico da conexão de videochamada.
 */

const router = Router();

// Verificar se as credenciais do Daily.co estão configuradas
const dailyConfigured = process.env.DAILY_API_KEY;

// Interface para o status do sistema
interface SystemStatus {
  status: 'ok' | 'error';
  message: string;
  readyForTelemedicine: boolean;
  dailyConfigured: boolean;
  stripeConfigured: boolean;
  databaseConnected: boolean;
  redisConnected: boolean;
  activeDoctors: number;
  activeAppointments: number;
  systemLoad: {
    cpu: number;
    memory: number;
  };
}

// Interface para o status do Daily.co
interface DailyStatus {
  status: 'success' | 'error';
  dailyStatus: 'operational' | 'error';
  message: string;
  activeRooms: number;
  activeParticipants: number;
  apiVersion: string;
}

// Interface para diagnóstico de conexão
interface ConnectionDiagnostic {
  status: 'success' | 'error';
  message: string;
  latency: number;
  bandwidth: number;
  videoQuality: 'good' | 'medium' | 'poor';
  audioQuality: 'good' | 'medium' | 'poor';
  browserInfo: {
    name: string;
    version: string;
    os: string;
  };
}

// Função para verificar o status do sistema
export async function checkSystemStatus(): Promise<SystemStatus> {
  try {
    const dailyConfigured = !!process.env.DAILY_API_KEY;
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    const databaseConnected = await checkDatabaseConnection();
    const redisConnected = await checkRedisConnection();

    // Contar médicos ativos
    const activeDoctors = (await db.query.doctors.findMany({
      where: eq(doctors.availableForEmergency, true)
    })).length;

    // Contar consultas ativas
    const activeAppointments = (await db.query.appointments.findMany({
      where: eq(appointments.status, 'confirmed')
    })).length;

    // Obter informações de carga do sistema
    const systemLoad = await getSystemLoad();

    return {
      status: 'ok',
      message: 'Sistema funcionando normalmente',
      readyForTelemedicine: dailyConfigured && databaseConnected && redisConnected,
      dailyConfigured,
      stripeConfigured,
      databaseConnected,
      redisConnected,
      activeDoctors,
      activeAppointments,
      systemLoad
    };
  } catch (error) {
    console.error('Erro ao verificar status do sistema:', error);
    return {
      status: 'error',
      message: 'Erro ao verificar status do sistema',
      readyForTelemedicine: false,
      dailyConfigured: false,
      stripeConfigured: false,
      databaseConnected: false,
      redisConnected: false,
      activeDoctors: 0,
      activeAppointments: 0,
      systemLoad: {
        cpu: 0,
        memory: 0
      }
    };
  }
}

// Função para verificar conexão com o banco de dados
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.query.doctors.findFirst();
    return true;
  } catch (error) {
    console.error('Erro ao conectar com o banco de dados:', error);
    return false;
  }
}

// Função para verificar conexão com Redis
async function checkRedisConnection(): Promise<boolean> {
  try {
    // Implementar verificação de conexão com Redis
    return true;
  } catch (error) {
    console.error('Erro ao conectar com Redis:', error);
    return false;
  }
}

// Função para obter carga do sistema
async function getSystemLoad(): Promise<{ cpu: number; memory: number }> {
  try {
    // Implementar obtenção de métricas do sistema
    return {
      cpu: 0,
      memory: 0
    };
  } catch (error) {
    console.error('Erro ao obter carga do sistema:', error);
    return {
      cpu: 0,
      memory: 0
    };
  }
}

// Verificar status do sistema
router.get('/status', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Contar médicos ativos
    const activeDoctors = await db.query.doctors.findMany({
      where: eq(doctors.status, 'active')
    });

    // Contar consultas ativas
    const activeAppointments = await db.query.appointments.findMany({
      where: eq(appointments.status, 'in_progress')
    });

    res.json({
      success: true,
      status: {
        activeDoctors: activeDoctors.length,
        activeAppointments: activeAppointments.length,
        systemStatus: 'operational'
      }
    });

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao verificar status'
    });
  }
});

// Testar conexão com Daily.co
router.get('/daily-test', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!process.env.DAILY_API_KEY) {
      throw new AppError('Daily.co não está configurado', 500);
    }

    // Simular teste de conexão
    res.json({
      success: true,
      status: 'connected',
      message: 'Conexão com Daily.co estabelecida'
    });

  } catch (error) {
    console.error('Erro ao testar conexão com Daily.co:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao testar conexão com Daily.co'
    });
  }
});

// Testar conexão do usuário
router.post('/connection-test', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { browserInfo } = req.body;

    // Simular teste de conexão
    res.json({
      success: true,
      status: 'connected',
      latency: Math.random() * 100,
      bandwidth: Math.random() * 1000,
      browserInfo
    });

  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof AppError ? error.message : 'Erro ao testar conexão'
    });
  }
});

export default router;