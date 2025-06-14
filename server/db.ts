import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from '../shared/schema';

// Configuração básica do WebSocket para Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configurando o pool com opções mínimas para evitar sobrecarga do plano gratuito do Neon
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1,                // apenas uma conexão simultânea (plano gratuito tem limitações)
  idleTimeoutMillis: 10000, // tempo reduzido que uma conexão permanece inativa
  connectionTimeoutMillis: 3000 // tempo curto para estabelecer conexão
});

// Adicione um handler para eventos de erro no pool de conexão
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexão do banco de dados:', err);
});

// Inicialização da instância Drizzle
export const db = drizzle(pool, { schema });

// Função auxiliar para garantir que o pool está funcionando
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Conexão com o banco de dados testada com sucesso:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Erro ao testar conexão com o banco de dados:', error);
    return false;
  }
};

// Testar a conexão durante a inicialização
testConnection().catch(err => {
  console.error('Falha no teste inicial de conexão:', err);
});
