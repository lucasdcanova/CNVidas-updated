const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkEmergencyConsultations() {
  console.log('🔍 Verificando consultas de emergência no banco de dados...\n');

  try {
    // 1. Buscar usuários pacientes
    const users = await prisma.users.findMany({
      where: {
        role: 'patient'
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        subscription_plan: true,
        emergency_consultations_left: true,
        subscription_status: true,
        created_at: true,
      }
    });

    console.log(`📊 Total de pacientes encontrados: ${users.length}\n`);

    // 2. Mostrar detalhes
    console.log('👤 Detalhes dos pacientes:\n');
    users.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Nome: ${user.full_name || 'Não informado'}`);
      console.log(`Plano: ${user.subscription_plan || 'Sem plano'}`);
      console.log(`Consultas de emergência restantes: ${user.emergency_consultations_left || 0}`);
      console.log(`Status da assinatura: ${user.subscription_status}`);
      console.log('---');
    });

    // 3. Atualizar um usuário específico
    const testEmail = 'lucas.canova@example.com';
    console.log(`\n🔧 Atualizando usuário: ${testEmail}`);
    
    // Primeiro verificar se existe
    const existingUser = await prisma.users.findUnique({
      where: { email: testEmail }
    });

    if (existingUser) {
      const updatedUser = await prisma.users.update({
        where: { email: testEmail },
        data: {
          emergency_consultations_left: 5,
          subscription_plan: 'premium',
          subscription_status: 'active'
        }
      });

      console.log('✅ Usuário atualizado com sucesso!');
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Plano: ${updatedUser.subscription_plan}`);
      console.log(`   Consultas de emergência: ${updatedUser.emergency_consultations_left}`);
    } else {
      console.log('❌ Usuário não encontrado. Crie primeiro um usuário com este email.');
    }

    // 4. Listar usuários com consultas disponíveis
    console.log('\n🚨 Usuários com consultas de emergência disponíveis:');
    const usersWithEmergency = await prisma.users.findMany({
      where: {
        emergency_consultations_left: {
          gt: 0
        }
      },
      select: {
        email: true,
        full_name: true,
        emergency_consultations_left: true,
        subscription_plan: true
      }
    });

    if (usersWithEmergency.length === 0) {
      console.log('❌ Nenhum usuário com consultas de emergência disponíveis!');
    } else {
      usersWithEmergency.forEach(user => {
        console.log(`${user.email} - ${user.emergency_consultations_left} consultas (Plano: ${user.subscription_plan})`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmergencyConsultations();