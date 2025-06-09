const { sql } = require('drizzle-orm');
const { db } = require('./dist/server/db.js');

async function runMigration() {
  try {
    console.log('Iniciando migração...');
    
    // Adicionar coluna gender e outras colunas faltantes
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER,
      ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255),
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)
    `);
    
    console.log('✅ Migração concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
  } finally {
    process.exit();
  }
}

runMigration();