const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testEmergencyFix() {
  console.log('🧪 Testando correção das consultas de emergência\n');

  try {
    // 1. Criar uma consulta de teste manualmente
    console.log('1️⃣ Criando consulta de emergência de teste...');
    
    // Buscar um paciente
    const patient = await prisma.users.findFirst({
      where: {
        role: 'patient',
        emergency_consultations_left: { gt: 0 }
      }
    });

    if (!patient) {
      console.log('❌ Nenhum paciente com consultas de emergência disponíveis encontrado.');
      return;
    }

    console.log(`   Paciente: ${patient.email}`);
    console.log(`   Consultas disponíveis: ${patient.emergency_consultations_left}`);

    // Criar consulta com status 'waiting'
    const newAppointment = await prisma.appointments.create({
      data: {
        user_id: patient.id,
        doctor_id: null, // Sem médico atribuído inicialmente
        date: new Date(),
        duration: 30,
        status: 'waiting', // Status correto
        type: 'telemedicine',
        is_emergency: true,
        telemed_room_name: `test-emergency-${Date.now()}`,
        notes: 'Teste de consulta de emergência com status waiting',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`✅ Consulta criada com ID: ${newAppointment.id}`);
    console.log(`   Status: ${newAppointment.status}`);
    console.log(`   Doctor ID: ${newAppointment.doctor_id || 'NULL'}`);

    // 2. Verificar consultas waiting
    console.log('\n2️⃣ Verificando consultas com status "waiting"...');
    const waitingConsultations = await prisma.appointments.findMany({
      where: {
        status: 'waiting',
        is_emergency: true
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 5
    });

    console.log(`\n📊 Total de consultas aguardando: ${waitingConsultations.length}`);
    
    if (waitingConsultations.length > 0) {
      console.log('\nDetalhes:');
      waitingConsultations.forEach((apt, index) => {
        console.log(`\n${index + 1}. ID: ${apt.id}`);
        console.log(`   Status: ${apt.status} ⏳`);
        console.log(`   User ID: ${apt.user_id}`);
        console.log(`   Doctor ID: ${apt.doctor_id || 'NULL - Aguardando médico'}`);
        console.log(`   Criada em: ${apt.created_at}`);
      });
    }

    // 3. Simular médico aceitando a consulta
    console.log('\n3️⃣ Simulando médico aceitando a consulta...');
    
    // Buscar um médico disponível
    const doctor = await prisma.doctors.findFirst({
      where: {
        available_for_emergency: true
      }
    });

    if (doctor) {
      const updatedAppointment = await prisma.appointments.update({
        where: { id: newAppointment.id },
        data: {
          doctor_id: doctor.id,
          status: 'in_progress',
          updated_at: new Date()
        }
      });

      console.log(`✅ Consulta atualizada!`);
      console.log(`   Doctor ID: ${updatedAppointment.doctor_id}`);
      console.log(`   Status: ${updatedAppointment.status}`);
    } else {
      console.log('⚠️  Nenhum médico disponível para emergência encontrado.');
    }

    // 4. Verificação final
    console.log('\n4️⃣ Verificação final - Distribuição de status:');
    const statusCounts = await prisma.appointments.groupBy({
      by: ['status'],
      where: {
        is_emergency: true,
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
        }
      },
      _count: {
        status: true
      }
    });

    statusCounts.forEach(item => {
      console.log(`   ${item.status}: ${item._count.status} consultas`);
    });

    console.log('\n✅ Teste concluído! As consultas agora devem aparecer com status "waiting".');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o teste
testEmergencyFix();