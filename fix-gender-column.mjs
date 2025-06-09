import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Carregar variáveis de ambiente
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida');
}

const sql = neon(databaseUrl);

async function addGenderColumn() {
  try {
    console.log('Adicionando coluna gender e outras colunas faltantes...');
    
    // Adicionar cada coluna separadamente para evitar erros
    const columns = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'active\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN DEFAULT false',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)'
    ];
    
    // Executar todas as alterações em uma única query
    try {
      const query = columns.join('; ');
      const result = await sql(query);
      console.log('✅ Todas as colunas foram adicionadas com sucesso!');
    } catch (err) {
      // Se falhar, tentar uma por uma
      console.log('Tentando adicionar colunas individualmente...');
      for (const query of columns) {
        try {
          await sql(query);
          console.log('✅', query.split(' ')[4]); // Mostrar nome da coluna
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('ℹ️  Coluna', query.split(' ')[4], 'já existe');
          } else {
            console.log('⚠️  Erro:', err.message);
          }
        }
      }
    }
    
    console.log('\n✅ Migração concluída!');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

addGenderColumn();