const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

async function runMigration() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    // Criar a tabela
    await sql`
      CREATE TABLE IF NOT EXISTS legal_acceptances (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        document_version VARCHAR(20) NOT NULL,
        accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ Tabela legal_acceptances criada!');
    
    // Criar índices
    await sql`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_id ON legal_acceptances(user_id)`;
    console.log('✅ Índice user_id criado!');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_document_type ON legal_acceptances(document_type)`;
    console.log('✅ Índice document_type criado!');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_accepted_at ON legal_acceptances(accepted_at)`;
    console.log('✅ Índice accepted_at criado!');
    
    // Verificar se a tabela foi criada
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'legal_acceptances'
    `;
    
    if (result.length > 0) {
      console.log('✅ Tabela legal_acceptances confirmada no banco de dados!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
  }
}

runMigration();