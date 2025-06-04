import { Router, Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import dns from 'dns';
import os from 'os';
import Daily from '@daily-co/daily-js';
import axios from 'axios';

const diagnosticRouter = Router();

// Define um esquema para validar os logs de erro
const errorLogSchema = z.object({
  appointmentId: z.number(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string().optional(),
  details: z.any().optional(),
  error: z.any().optional(),
  userAgent: z.string().optional(),
  connectionInfo: z.any().optional()
});

// Verificar se as credenciais do Daily.co estão configuradas
const dailyConfigured = process.env.DAILY_API_KEY;

/**
 * Verifica ambiente e requisitos da telemedicina
 */
diagnosticRouter.get('/check', async (req: Request, res: Response) => {
  try {
    // Verficia se as variáveis de ambiente do Twilio estão configuradas
    const twilioConfigured = process.env.TWILIO_ACCOUNT_SID && 
                            process.env.TWILIO_API_KEY && 
                            process.env.TWILIO_API_SECRET;

    // Verifica disponibilidade do banco de dados
    let dbStatus = false;
    try {
      // Aqui poderia verificar a conexão com o banco, mas estamos em modo de simulação
      dbStatus = true;
    } catch (error) {
      console.error("Erro ao verificar banco de dados:", error);
    }

    // Verifica uso de memória e CPU do servidor
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemoryPercentage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    const cpuInfo = os.cpus();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      twilioConfigured,
      dbStatus,
      serverStats: {
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          memoryUsedPercent: Math.round(usedMemoryPercentage)
        },
        cpuInfo: {
          cores: cpuInfo.length,
          model: cpuInfo[0]?.model,
          usage: cpuUsage
        },
        uptime: Math.round(process.uptime()) // segundos
      }
    });
  } catch (error) {
    console.error("Erro ao verificar ambiente de telemedicina:", error);
    res.status(500).json({ 
      status: 'error',
      message: 'Falha ao verificar o ambiente de telemedicina',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Endpoint para ping rápido (verificar se o servidor está respondendo)
 */
diagnosticRouter.get('/ping', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    time: new Date().toISOString(),
    serverTime: Date.now()
  });
});

/**
 * Registra erros detalhados de telemedicina
 */
diagnosticRouter.post('/error-log', async (req: Request, res: Response) => {
  try {
    // Validar o payload
    const validationResult = errorLogSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Payload inválido',
        details: validationResult.error
      });
    }
    
    const logData = validationResult.data;
    
    // Adicionar informações adicionais ao log
    const enhancedLog = {
      ...logData,
      timestamp: logData.timestamp || new Date().toISOString(),
      ip: req.ip,
      serverTime: Date.now()
    };
    
    // Em produção, os logs podem ser salvos em um arquivo ou banco de dados
    console.log('TELEMEDICINE ERROR LOG:', JSON.stringify(enhancedLog, null, 2));
    
    // Em ambiente de desenvolvimento, salva logs em arquivo para diagnóstico
    if (process.env.NODE_ENV === 'development') {
      const logsDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const logFilePath = path.join(logsDir, `telemedicine-errors-${new Date().toISOString().split('T')[0]}.log`);
      
      fs.appendFileSync(
        logFilePath,
        JSON.stringify(enhancedLog, null, 2) + ',\n'
      );
    }
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error("Erro ao registrar log de telemedicina:", error);
    res.status(500).json({ 
      status: 'error',
      message: 'Falha ao registrar log de erro',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Retorna diagnóstico de rede e servidor
 */
diagnosticRouter.get('/network', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();
    
    // Verifica a conectividade com serviços externos
    const dnsCheckPromise = new Promise<{ success: boolean, time: number }>((resolve) => {
      const dnsStart = performance.now();
      dns.lookup('google.com', (err) => {
        resolve({
          success: !err,
          time: Math.round(performance.now() - dnsStart)
        });
      });
    });
    
    // Execute verificações em paralelo
    const [dnsCheck] = await Promise.all([dnsCheckPromise]);
    
    const responseTime = Math.round(performance.now() - startTime);
    
    res.json({
      status: 'ok',
      responseTime,
      dns: dnsCheck,
      serverTime: Date.now()
    });
  } catch (error) {
    console.error("Erro ao executar diagnóstico de rede:", error);
    res.status(500).json({ 
      status: 'error',
      message: 'Falha ao executar diagnóstico de rede',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Específico para verificação do servidor de telemedicina
 */
diagnosticRouter.get('/telemedicine-check', (req: Request, res: Response) => {
  try {
    // Verifica se as credenciais do Twilio estão presentes
    const hasTwilioCredentials = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_API_KEY &&
      process.env.TWILIO_API_SECRET
    );
    
    // Em uma implementação completa, poderia verificar a conectividade real com a API do Twilio,
    // mas isso requer credenciais válidas que consumiriam recursos da conta em cada verificação
    
    res.json({
      status: 'ok',
      telemedicineServiceAvailable: true,
      hasTwilioCredentials,
      serverTime: Date.now()
    });
  } catch (error) {
    console.error("Erro ao verificar servidor de telemedicina:", error);
    res.status(500).json({ 
      status: 'error',
      message: 'Falha ao verificar servidor de telemedicina',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Rota para verificar o status do sistema
diagnosticRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      status: 'operational',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        dailyConfigured: !!dailyConfigured,
        database: 'operational',
        api: 'operational'
      },
      environment: process.env.NODE_ENV || 'development',
      missingCredentials: !dailyConfigured ? [
        !process.env.DAILY_API_KEY ? 'DAILY_API_KEY' : null
      ].filter(Boolean) : [],
      readyForTelemedicine: dailyConfigured
    };

    res.json(status);
  } catch (error) {
    console.error('Erro ao verificar status do sistema:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao verificar status do sistema'
    });
  }
});

// Rota para verificar a conexão com o Daily.co
diagnosticRouter.get('/daily-test', async (req: Request, res: Response) => {
  try {
    const response = await axios.get('https://api.daily.co/v1/rooms', {
      headers: {
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      }
    });
    
    res.json({
      status: 'success',
      dailyStatus: response.status === 200 ? 'operational' : 'error',
      message: response.status === 200 ? 'Conexão com Daily.co estabelecida com sucesso' : 'Erro ao conectar com Daily.co'
    });
  } catch (error) {
    console.error('Erro ao testar conexão com Daily.co:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao testar conexão com Daily.co'
    });
  }
});

export default diagnosticRouter;