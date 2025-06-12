const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    console.log('🔄 Executando migração para adicionar coluna days_hospitalized...');
    
    // Adicionar a coluna days_hospitalized
    await pool.query(`
      ALTER TABLE claims 
      ADD COLUMN IF NOT EXISTS days_hospitalized INTEGER DEFAULT 0;
    `);
    
    // Adicionar comentário
    await pool.query(`
      COMMENT ON COLUMN claims.days_hospitalized IS 'Número de dias que o paciente ficou internado para cálculo do valor do sinistro';
    `);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('📊 Coluna days_hospitalized adicionada à tabela claims');
    
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
  } finally {
    await pool.end();
  }
}

runMigration(); 