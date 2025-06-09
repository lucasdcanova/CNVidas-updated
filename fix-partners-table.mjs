import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Carregar variáveis de ambiente
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida');
}

const sql = neon(databaseUrl);

async function fixPartnersTable() {
  try {
    console.log('🔧 Corrigindo tabela partners...\n');
    
    // Verificar se a coluna trading_name já existe (no schema está como trading_name)
    console.log('Verificando estrutura da tabela partners...');
    
    // A coluna já está no schema como trading_name, mas pode estar faltando no banco
    const checkResult = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'partners' 
      AND column_name = 'trading_name'
    `;
    
    if (checkResult.length === 0) {
      console.log('Adicionando coluna trading_name...');
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS trading_name TEXT`;
      console.log('✅ trading_name adicionada');
    } else {
      console.log('ℹ️  Coluna trading_name já existe');
    }
    
    console.log('\n🎉 Correção concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

fixPartnersTable();