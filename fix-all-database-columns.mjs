import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Carregar variáveis de ambiente
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida');
}

const sql = neon(databaseUrl);

async function fixAllDatabaseColumns() {
  try {
    console.log('🔧 Corrigindo todas as tabelas do banco de dados...\n');
    
    // Colunas faltantes na tabela partners
    console.log('📋 Verificando tabela partners...');
    const partnerColumns = [
      'postal_code TEXT',
      'street TEXT',
      'number TEXT',
      'complement TEXT',
      'neighborhood TEXT'
    ];
    
    // Adicionar colunas uma por uma
    try {
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS postal_code TEXT`;
      console.log('✅ postal_code');
    } catch (err) {
      console.log('ℹ️  postal_code:', err.message.includes('already exists') ? 'já existe' : err.message);
    }
    
    try {
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS street TEXT`;
      console.log('✅ street');
    } catch (err) {
      console.log('ℹ️  street:', err.message.includes('already exists') ? 'já existe' : err.message);
    }
    
    try {
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS number TEXT`;
      console.log('✅ number');
    } catch (err) {
      console.log('ℹ️  number:', err.message.includes('already exists') ? 'já existe' : err.message);
    }
    
    try {
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS complement TEXT`;
      console.log('✅ complement');
    } catch (err) {
      console.log('ℹ️  complement:', err.message.includes('already exists') ? 'já existe' : err.message);
    }
    
    try {
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS neighborhood TEXT`;
      console.log('✅ neighborhood');
    } catch (err) {
      console.log('ℹ️  neighborhood:', err.message.includes('already exists') ? 'já existe' : err.message);
    }
    
    // Verificar se há outras tabelas com problemas
    console.log('\n📋 Verificando tabela services...');
    try {
      // Tentar criar a tabela services se não existir
      await sql`
        CREATE TABLE IF NOT EXISTS services (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          image_url TEXT,
          category VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          partner_id INTEGER REFERENCES partners(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Tabela services verificada/criada');
    } catch (err) {
      console.log('⚠️  Erro com tabela services:', err.message);
    }
    
    console.log('\n🎉 Correções concluídas!');
    console.log('Por favor, reinicie o servidor para aplicar as mudanças.');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

fixAllDatabaseColumns();