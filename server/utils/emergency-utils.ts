/**
 * Utilitários simplificados para consultas de emergência
 */

import axios from 'axios';

// Verificar credenciais do Daily.co
if (!process.env.DAILY_API_KEY) {
  console.warn('AVISO: DAILY_API_KEY não configurada.');
}

const DAILY_API_URL = 'https://api.daily.co/v1';

/**
 * Cria uma sala no Daily.co para atendimento de emergência
 */
export async function createEmergencyRoom(roomName: string): Promise<any> {
  try {
    // Sanitizar o nome da sala
    const sanitizedName = roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    // Primeiro verificar se a sala já existe
    try {
      const response = await axios.get(`${DAILY_API_URL}/rooms/${sanitizedName}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
        }
      });
      
      console.log(`Sala já existe: ${sanitizedName}`);
      return response.data;
    } catch (error: any) {
      // Se a sala não existir (HTTP 404), criar uma nova
      if (error.response && error.response.status === 404) {
        console.log(`Sala não existe, criando nova: ${sanitizedName}`);
        
        // Criar nova sala
        const response = await axios.post(`${DAILY_API_URL}/rooms`, {
          name: sanitizedName,
          properties: {
            exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 horas
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
          }
        });
        
        console.log(`Sala criada com sucesso: ${sanitizedName}`);
        return response.data;
      }
      
      // Se for outro erro, relançar
      throw error;
    }
  } catch (error: any) {
    console.error(`Erro ao criar sala de emergência ${roomName}:`, error.message);
    
    // Em caso de erro, retornar objeto básico para não quebrar o fluxo
    return {
      name: roomName,
      url: `https://cnvidas.daily.co/${roomName}`
    };
  }
}

/**
 * Gera um token de acesso para uma sala de emergência
 */
export async function createEmergencyToken(roomName: string, userName: string, isDoctor: boolean = false): Promise<string> {
  try {
    // Sanitizar o nome da sala
    const sanitizedName = roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    // Garantir que a sala existe
    await createEmergencyRoom(sanitizedName);
    
    // Criar token de acesso
    const response = await axios.post(`${DAILY_API_URL}/meeting-tokens`, {
      properties: {
        room_name: sanitizedName,
        user_name: userName,
        exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 horas
        is_owner: isDoctor
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      }
    });
    
    console.log(`Token de emergência criado com sucesso para ${userName} na sala ${sanitizedName}`);
    return response.data.token;
  } catch (error: any) {
    console.error(`Erro ao criar token de emergência para ${roomName}:`, error.message);
    
    // Em caso de erro grave, lançar uma exceção
    throw new Error(`Falha ao gerar token de emergência: ${error.message}`);
  }
}