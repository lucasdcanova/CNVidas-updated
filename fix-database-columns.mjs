import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Carregar variáveis de ambiente
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida');
}

const sql = neon(databaseUrl);

async function fixDatabase() {
  try {
    console.log('🔧 Corrigindo estrutura do banco de dados...\n');
    
    // Usar template literals corretamente
    console.log('Adicionando coluna gender...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`;
    console.log('✅ gender');
    
    console.log('Adicionando coluna status...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`;
    console.log('✅ status');
    
    console.log('Adicionando coluna subscription_plan_id...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER`;
    console.log('✅ subscription_plan_id');
    
    console.log('Adicionando coluna subscription_start_date...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP`;
    console.log('✅ subscription_start_date');
    
    console.log('Adicionando coluna subscription_end_date...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP`;
    console.log('✅ subscription_end_date');
    
    console.log('Adicionando coluna welcome_completed...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN DEFAULT false`;
    console.log('✅ welcome_completed');
    
    console.log('Adicionando coluna pix_key_type...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20)`;
    console.log('✅ pix_key_type');
    
    console.log('Adicionando coluna pix_key...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255)`;
    console.log('✅ pix_key');
    
    console.log('Adicionando coluna bank_name...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)`;
    console.log('✅ bank_name');
    
    console.log('Adicionando coluna account_type...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)`;
    console.log('✅ account_type');
    
    console.log('\n🎉 Migração concluída com sucesso!');
    console.log('Reinicie o servidor para aplicar as mudanças.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Algumas colunas já existem, isso é normal.');
    }
  }
}

fixDatabase();