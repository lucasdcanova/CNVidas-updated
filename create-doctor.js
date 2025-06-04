import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createDoctor() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Gerar hash da senha
    const hashedPassword = await hashPassword('123456');
    
    // Inserir usuário
    const userRes = await pool.query(
      `INSERT INTO users (email, username, password, full_name, role, email_verified) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['medico@cnvidas.com', 'drmario', hashedPassword, 'Dr. Mario Santos', 'doctor', true]
    );
    
    const userId = userRes.rows[0].id;
    
    // Inserir perfil de médico
    await pool.query(
      `INSERT INTO doctors (user_id, specialization, license_number, biography, experience_years, 
                          available_for_emergency, consultation_fee, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, 'Clínico Geral', 'CRM-54321', 'Médico clínico geral com experiência em atendimento emergencial.', 
       7, true, 180.00, 'active']
    );
    
    console.log('Médico criado com sucesso!');
    console.log('Email: medico@cnvidas.com');
    console.log('Senha: 123456');
    
  } catch (err) {
    console.error('Erro ao criar médico:', err);
  } finally {
    await pool.end();
  }
}

createDoctor();