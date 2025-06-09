const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
  try {
    const email = 'admin@cnvidas.com';
    const password = 'admin123';
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Verificar se o admin já existe
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (checkResult.rows.length > 0) {
      console.log('Admin já existe! ID:', checkResult.rows[0].id);
      
      // Atualizar a senha
      await pool.query(
        'UPDATE users SET password = $1, role = $2 WHERE email = $3',
        [hashedPassword, 'admin', email]
      );
      console.log('Senha do admin atualizada!');
    } else {
      // Criar novo admin
      const result = await pool.query(
        `INSERT INTO users (email, username, password, full_name, role, is_active, email_verified, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
         RETURNING id`,
        [email, 'admin', hashedPassword, 'Administrador', 'admin', true, true]
      );
      console.log('Admin criado com sucesso! ID:', result.rows[0].id);
    }
    
    console.log('\nCredenciais do admin:');
    console.log('Email:', email);
    console.log('Senha:', password);
    
  } catch (error) {
    console.error('Erro ao criar admin:', error);
  } finally {
    await pool.end();
  }
}

createAdmin();