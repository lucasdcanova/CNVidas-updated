import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testLogin() {
  console.log('🔍 Testando login do paciente...\n');

  try {
    // Buscar o usuário
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['patient-test@example.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Usuário encontrado:');
    console.log('  - ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Username:', user.username);
    console.log('  - FullName:', user.full_name);
    console.log('  - Role:', user.role);
    console.log('  - Password hash:', user.password);
    console.log('  - Password format:', user.password.includes('.') ? 'scrypt' : 'bcrypt');
    console.log('  - Password length:', user.password.length);
    
    if (user.password.includes('.')) {
      const [hashed, salt] = user.password.split('.');
      console.log('  - Hash part length:', hashed.length);
      console.log('  - Salt part length:', salt.length);
      console.log('  - Hash Buffer length:', Buffer.from(hashed, 'hex').length);
    }

    // Testar senha
    console.log('\n🔐 Testando senha...');
    const passwordMatch = await bcrypt.compare('test123', user.password);
    console.log(`   Senha correta: ${passwordMatch ? '✅ Sim' : '❌ Não'}`);

    // Se a senha não bater, vamos resetar
    if (!passwordMatch) {
      console.log('\n🔧 Resetando senha para test123...');
      const newHash = await bcrypt.hash('test123', 10);
      await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [newHash, user.id]
      );
      console.log('✅ Senha resetada com sucesso!');
    }

    // Verificar médicos
    console.log('\n👨‍⚕️ Verificando médicos cadastrados...');
    const doctors = await pool.query(`
      SELECT u.full_name, u.email, d.specialization, d.available_for_emergency
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE u.role = 'doctor'
    `);
    
    console.log(`Total de médicos: ${doctors.rows.length}`);
    doctors.rows.forEach(doc => {
      console.log(`   - ${doc.full_name} (${doc.specialization}) - Emergência: ${doc.available_for_emergency ? '✅' : '❌'}`);
    });

    // Verificar serviços
    console.log('\n🏥 Verificando serviços...');
    const services = await pool.query(`
      SELECT ps.name, ps.category, ps.discount_price, p.business_name
      FROM partner_services ps
      JOIN partners p ON ps.partner_id = p.id
      WHERE ps.is_active = true
    `);
    
    console.log(`Total de serviços: ${services.rows.length}`);
    services.rows.forEach(service => {
      console.log(`   - ${service.name} (${service.category}) - R$ ${(service.discount_price/100).toFixed(2)}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

testLogin(); 