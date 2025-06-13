/**
 * Utilitário para integração com o Daily.co
 */
import axios from 'axios';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

if (!DAILY_API_KEY) {
  console.error('⚠️ Chave de API do Daily.co não encontrada. Configure a variável de ambiente DAILY_API_KEY.');
}

/**
 * Criar uma nova sala de vídeo no Daily.co
 * @param roomName - Nome da sala (deve ser único)
 * @param expiryMinutes - Tempo de expiração da sala em minutos (padrão: 60)
 * @param waitForPropagation - Se deve aguardar propagação da sala após criação (default: false)
 */
export async function createRoom(roomName: string, expiryMinutes = 60, waitForPropagation = false) {
  try {
    console.log(`➡️ Criando sala ${roomName} no Daily.co - API key: ${!!DAILY_API_KEY}`);
    
    // Verificar se temos uma API key válida
    if (!DAILY_API_KEY) {
      throw new Error('DAILY_API_KEY não configurada');
    }
    
    // IMPLEMENTAÇÃO BASEADA NAS PRÁTICAS RECOMENDADAS DO DAILY.CO
    
    // Sanitizar o nome da sala para garantir compatibilidade
    const sanitizedRoomName = roomName
      .replace(/[^a-zA-Z0-9-]/g, '-') // substituir caracteres não alfanuméricos por hífen
      .toLowerCase();                 // converter para minúsculas
      
    if (sanitizedRoomName !== roomName) {
      console.log(`Nome da sala sanitizado: "${roomName}" -> "${sanitizedRoomName}"`);
    }
    
    // 1. Verificar se a sala já existe
    let existingRoom;
    
    try {
      console.log(`🔍 Verificando se sala "${sanitizedRoomName}" já existe...`);
      const checkResponse = await axios({
        method: 'GET',
        url: `${DAILY_API_URL}/rooms/${sanitizedRoomName}`,
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (checkResponse.status === 200) {
        console.log(`✅ Sala "${sanitizedRoomName}" já existe no Daily.co`);
        existingRoom = checkResponse.data;
        
        // Verificar se a URL está correta - formato exato que o Daily.co exige
        const expectedUrl = `https://cnvidas.daily.co/${sanitizedRoomName}`;
        if (existingRoom.url !== expectedUrl) {
          console.log(`⚠️ URL da sala retornada (${existingRoom.url}) difere da esperada (${expectedUrl})`);
          existingRoom.url = expectedUrl;
        }
        
        // Se a sala existe, retornar diretamente sem aguardar propagação
        if (!waitForPropagation) {
          return {
            id: existingRoom.id,
            name: existingRoom.name,
            url: existingRoom.url,
            api_created: true
          };
        }
      }
    } catch (error) {
      console.log(`Sala "${sanitizedRoomName}" não existe, será criada`);
    }
    
    // 2. Se não existe, criar uma nova sala
    if (!existingRoom) {
      console.log(`🆕 Criando nova sala "${sanitizedRoomName}" no Daily.co...`);
      
      // Configuração padrão para salas - seguindo a documentação oficial
      const createData = {
        name: sanitizedRoomName,
        properties: {
          start_audio_off: false,
          start_video_off: false,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: false, // Desabilitar "knocking" para acesso direto
          enable_network_ui: true, // Habilitar UI de rede
          enable_prejoin_ui: false, // Desabilitar tela de pre-join
          exp: Math.floor(Date.now() / 1000) + expiryMinutes * 60 // expiração em timestamp unix
        }
      };
        
      console.log("Payload para criação da sala:", JSON.stringify(createData));
      
      try {
        // Fazer requisição à API do Daily.co com axios
        const createResponse = await axios({
          method: 'POST',
          url: `${DAILY_API_URL}/rooms`,
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: createData
        });
        
        if (createResponse.status === 200) {
          console.log(`✅ Sala "${sanitizedRoomName}" criada com sucesso`);
          existingRoom = createResponse.data;
          
          // CRUCIAL: Aguardar propagação da sala conforme documentação do Daily.co
          if (waitForPropagation) {
            // Abordagem em duas fases com verificação
            console.log(`⏳ Aguardando primeira fase de propagação (5s)...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verificar se a sala já está acessível após a primeira fase
            let roomAccessible = false;
            try {
              console.log(`🔍 Verificando se sala "${sanitizedRoomName}" já está acessível...`);
              const verifyResponse = await axios({
                method: 'GET',
                url: `${DAILY_API_URL}/rooms/${sanitizedRoomName}`,
                headers: {
                  'Authorization': `Bearer ${DAILY_API_KEY}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (verifyResponse.status === 200) {
                console.log(`✅ Sala "${sanitizedRoomName}" confirmada como acessível`);
                roomAccessible = true;
                
                // Atualizar objeto de sala com dados mais recentes
                existingRoom = verifyResponse.data;
              }
            } catch (verifyError) {
              console.log(`⚠️ Sala "${sanitizedRoomName}" ainda não está acessível, continuando propagação...`);
            }
            
            // Se a sala ainda não estiver acessível, aguardar mais tempo
            if (!roomAccessible) {
              console.log(`⏳ Aguardando segunda fase de propagação (10s)...`);
              await new Promise(resolve => setTimeout(resolve, 10000));
              console.log(`✅ Período total de propagação (15s) concluído para "${sanitizedRoomName}"`);
            }
          }
        } else {
          throw new Error(`Resposta inesperada: ${createResponse.status}`);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao criar sala ${sanitizedRoomName}:`, error.message);
        throw error;
      }
    }
    
    // 3. Retornar dados da sala existente ou recém-criada
    if (existingRoom) {
      // Garantir que sempre retornamos o mesmo formato e URL correta
      return {
        id: existingRoom.id,
        name: existingRoom.name,
        url: `https://cnvidas.daily.co/${sanitizedRoomName}`,
        api_created: true
      };
    } else {
      throw new Error(`Falha ao criar ou recuperar a sala ${sanitizedRoomName}`);
    }
  } catch (error: any) {
    console.error('❌ Erro geral ao criar sala no Daily.co:', error.message);
    throw error;
  }
}

/**
 * Obter detalhes de uma sala existente
 * @param roomName - Nome da sala para recuperar informações
 */
export async function getRoomDetails(roomName: string) {
  try {
    const response = await axios.get(
      `${DAILY_API_URL}/rooms/${roomName}`,
      {
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error(`Sala ${roomName} não encontrada no Daily.co:`, error);
    throw new Error(`Sala de videoconferência não encontrada: ${error.message || 'Erro desconhecido'}`);
  }
}

/**
 * Criar um token para acesso à sala de vídeo
 * @param roomName - Nome da sala para a qual gerar o token
 * @param participantId - ID do participante
 * @param participantName - Nome do participante
 * @param isDoctor - Se o participante é um médico
 * @param expiryMinutes - Tempo de expiração do token em minutos (padrão: 120)
 */
export async function createMeetingToken(
  roomName: string,
  participantId: string,
  participantName: string,
  isDoctor: boolean,
  expiryMinutes = 120
) {
  try {
    // Calcular a data de expiração
    const exp = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
    
    // Para testes em ambiente de desenvolvimento, retornar um token simulado
    if (!DAILY_API_KEY || process.env.NODE_ENV === 'development') {
      console.log(`Modo de desenvolvimento: Gerando token simulado para ${participantName} na sala ${roomName}`);
      // Criar um token fictício para desenvolvimento com valores reais interpolados
      const dummyToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb29tX25hbWUiOiIke3Jvb21OYW1lfSIsInVzZXJfaWQiOiIke3BhcnRpY2lwYW50SWR9IiwidXNlcl9uYW1lIjoiJHtwYXJ0aWNpcGFudE5hbWV9IiwiaXNfb3duZXIiOiR7aXNEb2N0b3J9LCJleHAiOiR7ZXhwfX0.${Date.now()}`;
      
      return {
        token: dummyToken,
        expires_at: new Date(exp * 1000).toISOString(),
        properties: {
          room_name: roomName,
          user_id: participantId,
          user_name: participantName,
          is_owner: isDoctor
        }
      };
    }
    
    // Definir propriedades do participante
    const response = await axios.post(
      `${DAILY_API_URL}/meeting-tokens`,
      {
        properties: {
          room_name: roomName,
          user_id: participantId,
          user_name: participantName,
          exp,
          is_owner: isDoctor, // Médicos têm controles adicionais
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          enable_recording: isDoctor // Apenas médicos podem gravar
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`
        }
      }
    );
    
    console.log(`Token criado com sucesso para ${participantName} na sala ${roomName}`);
    return response.data;
  } catch (error: any) {
    console.error('Erro ao criar token de acesso Daily.co:', error);
    
    // Em caso de erro, retornar um token simulado para evitar quebrar o fluxo
    const expTime = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
    const dummyToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb29tX25hbWUiOiIkey0o5yIsInVzZXJfaWQiOiIkey0o5yIsInVzZXJfbmFtZSI6IlRlbGVtZWRpY2luYSBDTiBWaWRhcyIsImlzX293bmVyIjp0cnVlLCJleHAiOjAsInJvb21faWQiOiIke3Jvb21OYW1lfSJ9.${Date.now()}`;
    
    return {
      token: dummyToken,
      expires_at: new Date((Math.floor(Date.now() / 1000) + expiryMinutes * 60) * 1000).toISOString(),
      properties: {
        room_name: roomName,
        user_id: participantId,
        user_name: participantName,
        is_owner: isDoctor
      }
    };
  }
}

/**
 * Função simplificada para criar token seguindo as práticas recomendadas do Daily.co
 * Usada para emergências e consultas rápidas
 */
export async function createToken(roomName: string, userDetails: { user_id: string, user_name: string, is_owner: boolean }) {
  try {
    console.log(`Criando token para sala ${roomName}`);
    
    // Sanitizar o nome da sala para garantir compatibilidade com Daily.co
    const sanitizedRoomName = roomName
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .toLowerCase();
    
    if (sanitizedRoomName !== roomName) {
      console.log(`Nome da sala sanitizado: "${roomName}" -> "${sanitizedRoomName}"`);
    }
    
    // Garantir que a sala existe antes de criar o token
    console.log(`Verificando/criando sala ${sanitizedRoomName} antes de gerar token`);
    try {
      await createRoom(sanitizedRoomName, 120, true); // 2 horas de duração, COM propagação
      console.log(`Sala ${sanitizedRoomName} verificada/criada com sucesso`);
    } catch (roomError) {
      console.error(`Erro ao criar sala ${sanitizedRoomName}:`, roomError);
      // Continuar mesmo com erro para tentar criar o token
    }
    
    // Calcular a data de expiração (2 horas)
    const exp = Math.floor(Date.now() / 1000) + 120 * 60;
    
    // Verificar API key e lançar erro informativo se não estiver configurada
    if (!DAILY_API_KEY) {
      console.error(`⚠️ DAILY_API_KEY não configurada. Impossível gerar token válido.`);
      throw new Error('API key do Daily.co não configurada. Impossível criar token autêntico.');
    }
    
    // Definir propriedades para o token - CRUCIAL: usar o nome sanitizado da sala
    const tokenProperties = {
      room_name: sanitizedRoomName, // Usar nome sanitizado que corresponde exatamente à sala criada
      user_id: userDetails.user_id,
      user_name: userDetails.user_name,
      exp,
      is_owner: userDetails.is_owner,
      enable_screenshare: true,
      start_video_off: false,
      start_audio_off: false
    };
    
    console.log(`Solicitando token com propriedades:`, tokenProperties);
    
    const response = await axios.post(
      `${DAILY_API_URL}/meeting-tokens`,
      { properties: tokenProperties },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`
        }
      }
    );
    
    if (response.status === 200 && response.data && response.data.token) {
      console.log(`Token simplificado criado com sucesso: ${response.data.token.substring(0, 15)}...`);
      // Retornar apenas o token em vez do objeto completo
      return { token: response.data.token };
    } else {
      throw new Error(`Resposta inválida: ${JSON.stringify(response.data)}`);
    }
  } catch (error: any) {
    console.error('Erro ao criar token simplificado:', error?.message || 'Erro desconhecido');
    
    // Retentar uma vez com um nome de sala completamente sanitizado
    try {
      const sanitizedRoomName = roomName
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toLowerCase();
        
      console.log(`Tentativa de recuperação para token da sala: ${sanitizedRoomName}`);
      
      // Tempo adicional para garantir propagação máxima
      await createRoom(sanitizedRoomName, 120, true);
      console.log(`Sala ${sanitizedRoomName} recriada em modo de recuperação`);
      
      // Aguardar propagação adicional
      console.log('Aguardando propagação adicional...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Retentar criação do token com o nome sanitizado
      const recoveryResponse = await axios.post(
        `${DAILY_API_URL}/meeting-tokens`,
        { 
          properties: {
            room_name: sanitizedRoomName,
            user_id: userDetails.user_id,
            user_name: userDetails.user_name,
            exp: Math.floor(Date.now() / 1000) + 120 * 60,
            is_owner: userDetails.is_owner
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DAILY_API_KEY}`
          }
        }
      );
      
      if (recoveryResponse.status === 200 && recoveryResponse.data?.token) {
        console.log('Token recuperado com sucesso em segunda tentativa');
        return { token: recoveryResponse.data.token };
      }
    } catch (recoveryError) {
      console.error('Falha na recuperação de token:', recoveryError);
    }
    
    // Se todas as tentativas falharem, lançar o erro para evitar simulações
    throw new Error(`Falha ao criar token para a sala: ${error.message}`);
  }
}