import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

// Carregar variáveis de ambiente PRIMEIRO
dotenv.config();

const { Pool } = pg;

// Criar pool de conexão
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupTestData() {
  console.log('🚀 Iniciando configuração de dados de teste...\n');

  try {
    // 1. Criar usuário paciente de teste
    console.log('1️⃣ Criando paciente de teste...');
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    // Verificar se o paciente já existe
    const existingPatient = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      ['patient-test@example.com']
    );
    
    let patientId;
    if (existingPatient.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO users (email, username, password, full_name, role, cpf, phone, email_verified, subscription_plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        ['patient-test@example.com', 'patient-test', hashedPassword, 'Paciente Teste', 
         'patient', '12345678900', '11999999999', true, 'basic']
      );
      patientId = result.rows[0].id;
      console.log('✅ Paciente criado com sucesso! ID:', patientId);
    } else {
      patientId = existingPatient.rows[0].id;
      console.log('✅ Paciente já existe! ID:', patientId);
    }

    // 2. Criar médicos de teste
    console.log('\n2️⃣ Criando médicos de teste...');
    const doctorData = [
      {
        name: 'Dr. João Silva',
        email: 'dr.joao@example.com',
        specialization: 'Cardiologia',
        licenseNumber: 'CRM123456',
        availableForEmergency: true,
        consultationFee: 15000
      },
      {
        name: 'Dra. Maria Santos',
        email: 'dra.maria@example.com',
        specialization: 'Pediatria',
        licenseNumber: 'CRM789012',
        availableForEmergency: true,
        consultationFee: 12000
      },
      {
        name: 'Dr. Carlos Oliveira',
        email: 'dr.carlos@example.com',
        specialization: 'Clínica Geral',
        licenseNumber: 'CRM345678',
        availableForEmergency: false,
        consultationFee: 10000
      }
    ];

    for (const doc of doctorData) {
      // Verificar se o médico já existe
      const existing = await pool.query(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [doc.email]
      );
      
      if (existing.rows.length === 0) {
        // Criar usuário médico
        const userResult = await pool.query(
          `INSERT INTO users (email, username, password, full_name, role, email_verified)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [doc.email, doc.email.split('@')[0], hashedPassword, doc.name, 'doctor', true]
        );

        // Criar perfil de médico
        const doctorResult = await pool.query(
          `INSERT INTO doctors (user_id, specialization, license_number, available_for_emergency, 
                               consultation_fee, status, welcome_completed)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [userResult.rows[0].id, doc.specialization, doc.licenseNumber, 
           doc.availableForEmergency, doc.consultationFee, 'active', true]
        );

        // Se disponível para emergência, criar slots de disponibilidade
        if (doc.availableForEmergency) {
          // Disponível todos os dias das 8h às 20h
          for (let day = 0; day <= 6; day++) {
            await pool.query(
              `INSERT INTO availability_slots (doctor_id, day_of_week, start_time, end_time, is_available)
               VALUES ($1, $2, $3, $4, $5)`,
              [doctorResult.rows[0].id, day, '08:00:00', '20:00:00', true]
            );
          }
          console.log(`✅ ${doc.name} criado e configurado para emergências`);
        } else {
          console.log(`✅ ${doc.name} criado`);
        }
      } else {
        console.log(`ℹ️  ${doc.name} já existe`);
      }
    }

    // 3. Criar parceiro e serviços
    console.log('\n3️⃣ Criando parceiro e serviços de teste...');
    
    const existingPartnerUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      ['partner-test@example.com']
    );
    
    let partnerId;
    if (existingPartnerUser.rows.length === 0) {
      // Criar usuário parceiro
      const partnerUserResult = await pool.query(
        `INSERT INTO users (email, username, password, full_name, role, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['partner-test@example.com', 'partner-test', hashedPassword, 'Clínica Teste', 'partner', true]
      );

      // Criar perfil de parceiro
      const partnerResult = await pool.query(
        `INSERT INTO partners (user_id, business_name, business_type, description, phone, 
                              cnpj, status, address, city, state, zipcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [partnerUserResult.rows[0].id, 'Clínica Saúde Total', 'clinic', 
         'Clínica completa com diversos serviços', '1133334444', '12345678000190', 
         'active', 'Rua Teste, 123', 'São Paulo', 'SP', '01234567']
      );
      
      partnerId = partnerResult.rows[0].id;
      console.log('✅ Parceiro criado com sucesso! ID:', partnerId);
    } else {
      const existingPartner = await pool.query(
        'SELECT * FROM partners WHERE user_id = $1 LIMIT 1',
        [existingPartnerUser.rows[0].id]
      );
      if (existingPartner.rows.length > 0) {
        partnerId = existingPartner.rows[0].id;
        console.log('ℹ️  Parceiro já existe! ID:', partnerId);
      }
    }

    // Criar serviços se temos um partnerId
    if (partnerId) {
      const services = [
        {
          name: 'Consulta Médica Geral',
          description: 'Consulta com clínico geral',
          category: 'consulta',
          regularPrice: 20000,
          discountPrice: 15000,
          discountPercentage: 25,
          duration: 30
        },
        {
          name: 'Exame de Sangue Completo',
          description: 'Hemograma completo + bioquímica',
          category: 'exame',
          regularPrice: 15000,
          discountPrice: 10000,
          discountPercentage: 33,
          duration: 15
        },
        {
          name: 'Raio-X Torax',
          description: 'Radiografia de tórax em duas posições',
          category: 'exame',
          regularPrice: 10000,
          discountPrice: 7500,
          discountPercentage: 25,
          duration: 20
        }
      ];

      for (const service of services) {
        const existing = await pool.query(
          'SELECT * FROM partner_services WHERE partner_id = $1 AND name = $2 LIMIT 1',
          [partnerId, service.name]
        );
        
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO partner_services (partner_id, name, description, category, 
                                         regular_price, discount_price, discount_percentage, 
                                         duration, is_active, is_featured)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [partnerId, service.name, service.description, service.category,
             service.regularPrice, service.discountPrice, service.discountPercentage,
             service.duration, true, true]
          );
          console.log(`✅ Serviço "${service.name}" criado`);
        } else {
          console.log(`ℹ️  Serviço "${service.name}" já existe`);
        }
      }
    }

    console.log('\n✨ Configuração de dados de teste concluída!');
    console.log('\n📋 Resumo:');
    console.log('- Paciente de teste: patient-test@example.com / test123');
    console.log('- 3 médicos criados (2 disponíveis para emergência)');
    console.log('- 1 parceiro com 3 serviços disponíveis');
    
  } catch (error) {
    console.error('❌ Erro ao configurar dados de teste:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Executar
setupTestData().catch(console.error); 