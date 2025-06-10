import dotenv from 'dotenv';
import pg from 'pg';

// Carregar variáveis de ambiente
dotenv.config();

console.log('🔍 Testando conexão com o banco de dados...\n');

// Verificar se DATABASE_URL está definida
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida!');
  console.log('Certifique-se de que o arquivo .env existe e contém DATABASE_URL');
  process.exit(1);
}

console.log('✅ DATABASE_URL encontrada');
console.log(`📊 Conectando a: ${process.env.DATABASE_URL.substring(0, 30)}...`);

// Criar pool de conexão
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Testar conexão
async function testConnection() {
  try {
    // Fazer uma query simples
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    
    console.log('\n✅ Conexão bem-sucedida!');
    console.log(`⏰ Hora no servidor: ${result.rows[0].current_time}`);
    console.log(`📦 Versão do PostgreSQL: ${result.rows[0].pg_version.split(',')[0]}`);
    
    // Verificar tabelas
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\n📋 Tabelas encontradas: ${tablesResult.rows.length}`);
    if (tablesResult.rows.length > 0) {
      console.log('Algumas tabelas:');
      tablesResult.rows.slice(0, 10).forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      if (tablesResult.rows.length > 10) {
        console.log(`  ... e mais ${tablesResult.rows.length - 10} tabelas`);
      }
    }
    
    // Verificar se a tabela users existe
    const usersExists = tablesResult.rows.some(row => row.table_name === 'users');
    if (usersExists) {
      const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
      console.log(`\n👥 Total de usuários: ${usersCount.rows[0].count}`);
    } else {
      console.log('\n⚠️  Tabela "users" não encontrada!');
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao conectar ao banco de dados:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Dica: Verifique se o servidor do banco está rodando');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Dica: Verifique o host na DATABASE_URL');
    } else if (error.code === '28P01') {
      console.log('\n💡 Dica: Verifique as credenciais (usuário/senha)');
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Executar teste
testConnection(); 