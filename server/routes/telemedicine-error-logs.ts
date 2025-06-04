import { Router, Request, Response } from 'express';
import { DailyCallFactory } from '@daily-co/daily-js';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import axios from 'axios';

const telemedicineErrorRouter = Router();

/**
 * Controlador para registro de erros de telemedicina
 * Recebe os dados detalhados do erro e salva no banco de dados
 * para análise posterior.
 */
export async function logTelemedicineError(req: Request, res: Response) {
  try {
    // Extrai os dados do erro da requisição
    const errorData = req.body;
    
    if (!errorData || !errorData.type || !errorData.message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dados de erro inválidos' 
      });
    }
    
    console.log(`Registrando erro de telemedicina: ${errorData.type} - ${errorData.message}`);
    
    // Formatar o dado para armazenamento
    const logEntry = {
      error_type: errorData.type,
      message: errorData.message,
      timestamp: errorData.timestamp || new Date(),
      user_id: errorData.userId || null,
      appointment_id: errorData.appointmentId || null,
      room_name: errorData.roomName || null,
      browser_info: JSON.stringify(errorData.deviceInfo || {}),
      connection_info: JSON.stringify(errorData.connectionInfo || {}),
      media_state: JSON.stringify(errorData.mediaState || {}),
      stack_trace: errorData.stackTrace || null,
      additional_data: JSON.stringify(errorData.contextData || {})
    };
    
    // Armazenar no banco de dados usando SQL bruto para garantir flexibilidade
    // já que esta tabela pode não estar no schema principal
    await db.execute(sql`
      INSERT INTO telemedicine_error_logs (
        error_type, message, timestamp, user_id, appointment_id, room_name,
        browser_info, connection_info, media_state, stack_trace, additional_data
      ) VALUES (
        ${logEntry.error_type}, ${logEntry.message}, ${logEntry.timestamp}, 
        ${logEntry.user_id}, ${logEntry.appointment_id}, ${logEntry.room_name},
        ${logEntry.browser_info}, ${logEntry.connection_info}, ${logEntry.media_state},
        ${logEntry.stack_trace}, ${logEntry.additional_data}
      )
      ON CONFLICT DO NOTHING
    `);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Erro registrado com sucesso' 
    });
    
  } catch (error) {
    console.error('Erro ao registrar log de telemedicina:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Falha ao registrar erro',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Ping simples para testar a conectividade
 */
export function ping(req: Request, res: Response) {
  res.status(200).json({ success: true, timestamp: new Date() });
}

/**
 * Verifica se todos os pré-requisitos para telemedicina estão atendidos no lado do servidor
 */
export async function checkTelemedicineRequirements(req: Request, res: Response) {
  try {
    // Verificar se as credenciais Twilio estão configuradas
    const twilioConfigured = 
      process.env.TWILIO_ACCOUNT_SID && 
      process.env.TWILIO_API_KEY && 
      process.env.TWILIO_API_SECRET && 
      process.env.TWILIO_AUTH_TOKEN;
    
    const requirements = {
      server: {
        twilioConfigured: !!twilioConfigured,
        databaseConnected: true, // Já estamos conectados se chegou aqui
        serviceAvailable: true
      },
      missingCredentials: !twilioConfigured ? [
        !process.env.TWILIO_ACCOUNT_SID ? 'TWILIO_ACCOUNT_SID' : null,
        !process.env.TWILIO_API_KEY ? 'TWILIO_API_KEY' : null,
        !process.env.TWILIO_API_SECRET ? 'TWILIO_API_SECRET' : null,
        !process.env.TWILIO_AUTH_TOKEN ? 'TWILIO_AUTH_TOKEN' : null
      ].filter(Boolean) : []
    };
    
    return res.status(200).json({
      success: true,
      requirements,
      readyForTelemedicine: twilioConfigured
    });
    
  } catch (error) {
    console.error('Erro ao verificar requisitos de telemedicina:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Falha ao verificar requisitos',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

// Verificar se as credenciais do Daily.co estão configuradas
const dailyConfigured = process.env.DAILY_API_KEY;

// Rota para verificar o status do sistema
telemedicineErrorRouter.get('/status', async (req: Request, res: Response) => {
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
telemedicineErrorRouter.get('/daily-test', async (req: Request, res: Response) => {
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

export default telemedicineErrorRouter;