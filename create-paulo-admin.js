// Script para criar usuário administrador Paulo
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import ws from 'ws';

// Configure o websocket para o Neon Database
neonConfig.webSocketConstructor = ws;

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createPauloAdmin() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não está definido. Configure esta variável de ambiente.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Define admin user data for Paulo
    const adminEmail = 'paulo@blueoceansem.com.br';
    const adminPassword = 'blue1234';
    const hashedPassword = await hashPassword(adminPassword);

    // Check if admin user already exists
    const checkResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [adminEmail]
    );

    if (checkResult.rows.length > 0) {
      console.log(`O usuário administrador com o email ${adminEmail} já existe. Atualizando a senha...`);
      
      // Update admin password and role
      const updateResult = await pool.query(
        `UPDATE users 
         SET password = $1, role = $2, updated_at = $3 
         WHERE email = $4
         RETURNING id, email, username, full_name, role`,
        [hashedPassword, 'admin', new Date(), adminEmail]
      );
      
      if (updateResult.rows.length > 0) {
        console.log(`Administrador Paulo atualizado com sucesso!`);
        console.log('Dados do administrador:');
        console.log('Email:', adminEmail);
        console.log('Senha:', adminPassword);
        console.log('Dados da conta:', updateResult.rows[0]);
      }
      
      await pool.end();
      return;
    }

    // Create new admin user for Paulo
    const result = await pool.query(
      `INSERT INTO users 
       (email, username, password, full_name, role, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, username, full_name, role`,
      [adminEmail, 'paulo', hashedPassword, 'Paulo - Blue Ocean Sem', 'admin', true, new Date(), new Date()]
    );
    
    if (result.rows.length > 0) {
      console.log('Usuário administrador Paulo criado com sucesso:');
      console.log('Dados do administrador:');
      console.log('Email:', adminEmail);
      console.log('Senha:', adminPassword);
      console.log('Dados da conta:', result.rows[0]);
    }
    
  } catch (error) {
    console.error('Erro ao criar usuário administrador Paulo:', error);
  } finally {
    await pool.end();
  }
}

// Execute the function
createPauloAdmin().catch(err => {
  console.error('Error in main function:', err);
  process.exit(1);
});