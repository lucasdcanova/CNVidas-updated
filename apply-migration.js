import 'dotenv/config';
import { pool } from './server/db.js';

async function applyMigration() {
  try {
    console.log('Aplicando migração para adicionar coluna days_hospitalized...');
    
    const result = await pool.query('ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "days_hospitalized" integer DEFAULT 0;');
    
    console.log('✅ Migração aplicada com sucesso!');
    console.log('Resultado:', result);
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

applyMigration(); 