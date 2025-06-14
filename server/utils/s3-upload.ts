import fs from 'fs';
import path from 'path';

// AWS S3 é opcional - só carregar se estiver disponível
let s3: any = null;

try {
  const AWS = require('aws-sdk');
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
} catch (error) {
  console.log('AWS SDK não disponível, S3 upload desabilitado');
}

export async function uploadToS3(filePath: string, key: string): Promise<string> {
  // Se não tiver configuração AWS ou S3 não estiver disponível, retornar erro
  if (!s3 || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
    console.log('AWS S3 não configurado, usando armazenamento local');
    throw new Error('S3 não configurado');
  }

  const fileContent = fs.readFileSync(filePath);
  const fileExtension = path.extname(filePath);
  
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: getContentType(fileExtension)
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('Erro ao fazer upload para S3:', error);
    throw error;
  }
}

function getContentType(extension: string): string {
  const types: { [key: string]: string } = {
    '.webm': 'audio/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4'
  };
  
  return types[extension.toLowerCase()] || 'application/octet-stream';
}