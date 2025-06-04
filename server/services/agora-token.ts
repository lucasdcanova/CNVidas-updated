import crypto from 'crypto';

// Agora.io token generation
export interface IAgoraTokenParams {
  appID: string;
  appCertificate: string;
  channelName: string;
  uid: string | number;
  role?: Role;
  privilegeExpireTime?: number;
}

// Role consts
export enum Role {
  PUBLISHER = 1, // Pode publicar fluxo de áudio/vídeo
  SUBSCRIBER = 2, // Só pode consumir fluxos
}

// Tipos de privilégios para tokens
export enum Privileges {
  JOIN_CHANNEL = 1,
  PUBLISH_AUDIO = 2,
  PUBLISH_VIDEO = 4,
  PUBLISH_DATA = 8,
}

// Interface para message
interface IMessage {
  salt: string;
  ts: number;
  privileges: {
    [key: number]: number;
  };
}

// Função principal para gerar token do Agora.io
export function generateRtcToken(params: IAgoraTokenParams): string {
  const {
    appID,
    appCertificate,
    channelName,
    uid,
    role = Role.PUBLISHER,
    privilegeExpireTime = 3600, // 1 hora por padrão
  } = params;

  // Verificar parâmetros obrigatórios
  if (!appID || !appCertificate || !channelName) {
    throw new Error('appID, appCertificate e channelName são obrigatórios');
  }

  // Vamos usar um salt aleatório para cada token
  const salt = Math.floor(Math.random() * 100000);
  
  // Timestamp atual em segundos
  const ts = Math.floor(Date.now() / 1000);
  
  // Data de expiração em segundos
  const expireTime = ts + privilegeExpireTime;

  // Preparar a mensagem que será assinada
  const message: IMessage = {
    salt: salt.toString(),
    ts,
    privileges: {},
  };

  // Configurar privilégios com base no papel (role)
  message.privileges[Privileges.JOIN_CHANNEL] = expireTime;
  
  if (role === Role.PUBLISHER) {
    message.privileges[Privileges.PUBLISH_AUDIO] = expireTime;
    message.privileges[Privileges.PUBLISH_VIDEO] = expireTime;
    message.privileges[Privileges.PUBLISH_DATA] = expireTime;
  }

  // Converter para string e gerar a assinatura
  const msgStr = JSON.stringify(message);
  const signature = generateSignature(appID, appCertificate, channelName, uid, msgStr);
  
  // Construir o token final
  const token = encodeToken(signature, appID, channelName, uid, msgStr);

  return token;
}

// Função auxiliar para gerar a assinatura
function generateSignature(
  appID: string,
  appCertificate: string,
  channelName: string,
  uid: string | number,
  message: string
): string {
  // Formatado como: appID + channelName + uid + message
  const signContent = appID + channelName + uid + message;
  
  // Usar HMAC-SHA256 para assinar o conteúdo
  const hmac = crypto.createHmac('sha256', appCertificate);
  hmac.update(signContent);
  
  return hmac.digest('hex');
}

// Função auxiliar para codificar o token
function encodeToken(
  signature: string,
  appID: string,
  channelName: string,
  uid: string | number,
  message: string
): string {
  // Converter para base64
  const signatureBase64 = Buffer.from(signature, 'hex').toString('base64');
  const appIDBase64 = Buffer.from(appID).toString('base64');
  const channelNameBase64 = Buffer.from(channelName).toString('base64');
  const uidBase64 = Buffer.from(uid.toString()).toString('base64');
  const messageBase64 = Buffer.from(message).toString('base64');
  
  // Construir o token: versão.signatureBase64.appIDBase64.channelNameBase64.uidBase64.messageBase64
  const token = '006.' + 
                signatureBase64 + '.' +
                appIDBase64 + '.' +
                channelNameBase64 + '.' +
                uidBase64 + '.' +
                messageBase64;
  
  return token;
}

// Helper para gerar um token simplificado com valores padrão
export function generateToken(channelName: string, uid: string | number): string {
  const appID = process.env.AGORA_APP_ID || '';
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || '';
  
  if (!appID || !appCertificate) {
    throw new Error('AGORA_APP_ID e AGORA_APP_CERTIFICATE devem estar definidos nas variáveis de ambiente');
  }

  // Para maior compatibilidade, usar uma estratégia simplificada para o token
  try {
    // Garantir que o uid seja um número (importante para compatibilidade com o SDK)
    let numericUid: number;
    if (typeof uid === 'string') {
      numericUid = parseInt(uid, 10);
      if (isNaN(numericUid)) {
        numericUid = 0; // Fallback para 0 (valor que permite qualquer UID no cliente)
      }
    } else {
      numericUid = uid;
    }
    
    console.log(`Gerando token para canal ${channelName} com uid ${numericUid}`);
    
    // Calcular timestamp de expiração com maior duração para ambientes com restrições
    const privilegeExpireTime = Math.floor(Date.now() / 1000) + 86400; // 24 horas para garantir validade em testes
    
    const token = generateRtcToken({
      appID,
      appCertificate,
      channelName,
      uid: numericUid,
      role: Role.PUBLISHER,
      privilegeExpireTime,
    });
    
    // Verificar se o token foi gerado corretamente
    if (!token || token.length < 20) {
      throw new Error(`Token gerado inválido: ${token}`);
    }
    
    console.log(`Token gerado com sucesso (tamanho: ${token.length}, expira em: ${new Date(privilegeExpireTime * 1000).toISOString()})`);
    return token;
  } catch (error) {
    console.error('Erro ao gerar token do Agora:', error);
    throw new Error(`Falha ao gerar token: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}