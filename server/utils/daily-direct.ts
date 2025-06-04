import axios from 'axios';

// Cliente HTTP para comunicação com a API do Daily.co
const dailyClient = axios.create({
  baseURL: 'https://api.daily.co/v1',
  timeout: 10000
});

/**
 * Sanitiza o nome da sala para o formato aceito pelo Daily.co
 */
export function sanitizeRoomName(roomName: string): string {
  return roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/**
 * Verifica se uma sala existe no Daily.co
 */
export async function getRoomDirect(roomName: string): Promise<any | null> {
  if (!process.env.DAILY_API_KEY) {
    console.error('DAILY_API_KEY não configurada');
    return null;
  }

  try {
    const response = await dailyClient.get(`/rooms/${roomName}`, {
      headers: {
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return null; // Sala não existe
    }
    
    console.error(`[Daily.co Direct] Erro ao verificar sala ${roomName}:`, 
      error.response?.data || error.message);
    return null;
  }
}

/**
 * Cria uma sala no Daily.co usando a abordagem mais direta e confiável
 */
export const createRoomDirect = createRoom;
export async function createRoom(roomName: string, expiryMinutes: number = 60, shouldPropagateErrors: boolean = false): Promise<any> {
  if (!process.env.DAILY_API_KEY) {
    console.error('DAILY_API_KEY não configurada');
    throw new Error('DAILY_API_KEY não configurada');
  }

  const sanitizedName = sanitizeRoomName(roomName);
  
  try {
    // Primeiro verificar se a sala já existe
    const existingRoom = await getRoomDirect(sanitizedName);
    if (existingRoom) {
      console.log(`[Daily.co Direct] Sala ${sanitizedName} já existe, reusando`);
      return existingRoom;
    }
    
    // Se não existe, criar a sala
    console.log(`[Daily.co Direct] Criando nova sala: ${sanitizedName}`);
    
    // Configurar quando a sala expira (unix timestamp em segundos)
    const exp = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
    
    const response = await dailyClient.post('/rooms', {
      name: sanitizedName,
      properties: {
        exp,
        enable_chat: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[Daily.co Direct] Sala criada com sucesso: ${sanitizedName}`);
    return response.data;
  } catch (error: any) {
    const errorMsg = `[Daily.co Direct] Erro ao criar sala ${sanitizedName}: ${error.response?.data?.info || error.message}`;
    console.error(errorMsg);
    
    if (shouldPropagateErrors) {
      throw new Error(errorMsg);
    }
    
    // Retornar um objeto mínimo para não quebrar o fluxo
    return {
      name: sanitizedName,
      url: `https://cnvidas.daily.co/${sanitizedName}`
    };
  }
}

/**
 * Cria um token de acesso para uma sala do Daily.co
 */
export const createTokenDirect = createToken;
export async function createToken(
  roomName: string, 
  userInfo: { user_id: string, user_name: string, is_owner: boolean },
  expiryMinutes: number = 60
): Promise<string> {
  if (!process.env.DAILY_API_KEY) {
    console.error('DAILY_API_KEY não configurada');
    throw new Error('DAILY_API_KEY não configurada');
  }

  const sanitizedName = sanitizeRoomName(roomName);
  
  try {
    // Primeiro, garantir que a sala existe
    const roomExists = await getRoomDirect(sanitizedName);
    
    if (!roomExists) {
      console.log(`[Daily.co Direct] Sala ${sanitizedName} não existe, criando antes de gerar token...`);
      await createRoom(sanitizedName, expiryMinutes);
    }
    
    // Criar token de acesso
    const response = await dailyClient.post('/meeting-tokens', {
      properties: {
        room_name: sanitizedName,
        user_id: userInfo.user_id,
        user_name: userInfo.user_name,
        is_owner: userInfo.is_owner,
        exp: Math.floor(Date.now() / 1000) + (expiryMinutes * 60)
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[Daily.co Direct] Token criado com sucesso para ${userInfo.user_name} na sala ${sanitizedName}`);
    return response.data.token;
  } catch (error: any) {
    console.error(`[Daily.co Direct] Erro ao criar token para ${sanitizedName}:`, 
      error.response?.data || error.message);
    
    // Em vez de retornar um token falso, lançar erro para tratamento adequado
    throw new Error(`Falha ao gerar token: ${error.response?.data?.info || error.message}`);
  }
}

/**
 * Cria uma sala e retorna o token em uma única operação
 * @param roomName Nome da sala
 * @param userName Nome do usuário
 * @param isOwner Se o usuário é proprietário da sala
 * @param expiryMinutes Tempo de expiração em minutos
 */
export async function createRoomWithToken(
  roomName: string,
  userName: string,
  isOwner: boolean = false,
  expiryMinutes: number = 60
): Promise<{ room: any, token: string }> {
  try {
    // Criar/verificar a sala
    const room = await createRoom(roomName, expiryMinutes);
    
    // Gerar token para o usuário
    const token = await createToken(roomName, {
      user_id: `user-${Date.now()}`,
      user_name: userName,
      is_owner: isOwner
    }, expiryMinutes);
    
    return { room, token };
  } catch (error) {
    console.error(`[Daily.co Direct] Erro ao criar sala e token para ${roomName}:`, error);
    throw error;
  }
}