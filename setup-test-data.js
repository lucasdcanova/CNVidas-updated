import dotenv from 'dotenv';
import { db } from './server/db.js';
import { storage } from './server/storage.js';
import bcrypt from 'bcrypt';
import { users, doctors, partners, partnerServices, availabilitySlots } from './shared/schema.js';
import { eq, and } from 'drizzle-orm';

dotenv.config();

async function setupTestData() {
  console.log('🚀 Iniciando configuração de dados de teste...\n');

  try {
    // 1. Criar usuário paciente de teste
    console.log('1️⃣ Criando paciente de teste...');
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const existingPatient = await db.select().from(users)
      .where(eq(users.email, 'patient-test@example.com'))
      .limit(1);
    
    let patientId;
    if (existingPatient.length === 0) {
      const [newPatient] = await db.insert(users).values({
        email: 'patient-test@example.com',
        username: 'patient-test',
        password: hashedPassword,
        fullName: 'Paciente Teste',
        role: 'patient',
        cpf: '12345678900',
        phone: '11999999999',
        emailVerified: true,
        subscriptionPlan: 'basic'
      }).returning();
      patientId = newPatient.id;
      console.log('✅ Paciente criado com sucesso! ID:', patientId);
    } else {
      patientId = existingPatient[0].id;
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
        consultationFee: 15000 // R$ 150,00
      },
      {
        name: 'Dra. Maria Santos',
        email: 'dra.maria@example.com',
        specialization: 'Pediatria',
        licenseNumber: 'CRM789012',
        availableForEmergency: true,
        consultationFee: 12000 // R$ 120,00
      },
      {
        name: 'Dr. Carlos Oliveira',
        email: 'dr.carlos@example.com',
        specialization: 'Clínica Geral',
        licenseNumber: 'CRM345678',
        availableForEmergency: false,
        consultationFee: 10000 // R$ 100,00
      }
    ];

    for (const doc of doctorData) {
      // Verificar se o médico já existe
      const existing = await db.select().from(users)
        .where(eq(users.email, doc.email))
        .limit(1);
      
      if (existing.length === 0) {
        // Criar usuário médico
        const [doctorUser] = await db.insert(users).values({
          email: doc.email,
          username: doc.email.split('@')[0],
          password: hashedPassword,
          fullName: doc.name,
          role: 'doctor',
          emailVerified: true
        }).returning();

        // Criar perfil de médico
        const [doctor] = await db.insert(doctors).values({
          userId: doctorUser.id,
          specialization: doc.specialization,
          licenseNumber: doc.licenseNumber,
          availableForEmergency: doc.availableForEmergency,
          consultationFee: doc.consultationFee,
          status: 'active',
          welcomeCompleted: true
        }).returning();

        // Se disponível para emergência, criar slots de disponibilidade
        if (doc.availableForEmergency) {
          // Disponível todos os dias das 8h às 20h
          for (let day = 0; day <= 6; day++) {
            await db.insert(availabilitySlots).values({
              doctorId: doctor.id,
              dayOfWeek: day,
              startTime: '08:00:00',
              endTime: '20:00:00',
              isAvailable: true
            });
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
    
    const existingPartnerUser = await db.select().from(users)
      .where(eq(users.email, 'partner-test@example.com'))
      .limit(1);
    
    let partnerId;
    if (existingPartnerUser.length === 0) {
      // Criar usuário parceiro
      const [partnerUser] = await db.insert(users).values({
        email: 'partner-test@example.com',
        username: 'partner-test',
        password: hashedPassword,
        fullName: 'Clínica Teste',
        role: 'partner',
        emailVerified: true
      }).returning();

      // Criar perfil de parceiro
      const [partner] = await db.insert(partners).values({
        userId: partnerUser.id,
        businessName: 'Clínica Saúde Total',
        businessType: 'clinic',
        description: 'Clínica completa com diversos serviços',
        phone: '1133334444',
        cnpj: '12345678000190',
        status: 'active',
        address: 'Rua Teste, 123',
        city: 'São Paulo',
        state: 'SP',
        zipcode: '01234567'
      }).returning();
      
      partnerId = partner.id;
      console.log('✅ Parceiro criado com sucesso! ID:', partnerId);
    } else {
      const [existingPartner] = await db.select().from(partners)
        .where(eq(partners.userId, existingPartnerUser[0].id))
        .limit(1);
      partnerId = existingPartner.id;
      console.log('ℹ️  Parceiro já existe! ID:', partnerId);
    }

    // Criar serviços
    const services = [
      {
        name: 'Consulta Médica Geral',
        description: 'Consulta com clínico geral',
        category: 'consulta',
        regularPrice: 20000, // R$ 200,00
        discountPrice: 15000, // R$ 150,00
        discountPercentage: 25,
        duration: 30
      },
      {
        name: 'Exame de Sangue Completo',
        description: 'Hemograma completo + bioquímica',
        category: 'exame',
        regularPrice: 15000, // R$ 150,00
        discountPrice: 10000, // R$ 100,00
        discountPercentage: 33,
        duration: 15
      },
      {
        name: 'Raio-X Torax',
        description: 'Radiografia de tórax em duas posições',
        category: 'exame',
        regularPrice: 10000, // R$ 100,00
        discountPrice: 7500, // R$ 75,00
        discountPercentage: 25,
        duration: 20
      }
    ];

    for (const service of services) {
      const existing = await db.select().from(partnerServices)
        .where(and(
          eq(partnerServices.partnerId, partnerId),
          eq(partnerServices.name, service.name)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(partnerServices).values({
          partnerId,
          ...service,
          isActive: true,
          isFeatured: true
        });
        console.log(`✅ Serviço "${service.name}" criado`);
      } else {
        console.log(`ℹ️  Serviço "${service.name}" já existe`);
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
    process.exit(0);
  }
}

// Executar
setupTestData().catch(console.error); 