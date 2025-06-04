require('dotenv').config();
const { drizzle } = require('drizzle-orm/neon-serverless');
const { Pool } = require('@neondatabase/serverless');
const { migrate } = require('drizzle-orm/neon-serverless/migrator');
const path = require('path');

// Configuração do pool de conexão
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1
});

const db = drizzle(pool);

// Função principal para criar o esquema
async function main() {
  console.log('Iniciando migração do banco de dados...');

  try {
    // Aplicar migrações
    await migrate(db, { migrationsFolder: path.join(__dirname, 'server/migrations') });
    console.log('Migração concluída com sucesso!');
    
    // Verificar conexão
    const result = await pool.query('SELECT NOW()');
    console.log('Banco de dados conectado:', result.rows[0].now);
    
    console.log('Configuração do banco de dados concluída!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    await pool.end();
  }
}

main();