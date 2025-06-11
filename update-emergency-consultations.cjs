const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function updateEmergencyConsultations() {
  console.log('🔧 Atualizando consultas de emergência...\n');

  try {
    // Atualizar o usuário lucas.canova@hotmail.com
    const email = 'lucas.canova@hotmail.com';
    
    console.log(`Atualizando usuário: ${email}`);
    
    const updatedUser = await prisma.users.update({
      where: { email },
      data: {
        emergency_consultations_left: 10,  // Adicionar 10 consultas de emergência
        subscription_status: 'active'
      }
    });

    console.log('✅ Usuário atualizado com sucesso!');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Nome: ${updatedUser.full_name}`);
    console.log(`   Plano: ${updatedUser.subscription_plan}`);
    console.log(`   Consultas de emergência: ${updatedUser.emergency_consultations_left}`);
    console.log(`   Status: ${updatedUser.subscription_status}`);

    // Verificar se a atualização funcionou
    console.log('\n🔍 Verificando usuários com consultas de emergência disponíveis:');
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
        subscription_plan: true,
        subscription_status: true
      }
    });

    if (usersWithEmergency.length > 0) {
      console.log('\n✅ Usuários com consultas de emergência:');
      usersWithEmergency.forEach(user => {
        console.log(`\n${user.email}`);
        console.log(`  Nome: ${user.full_name}`);
        console.log(`  Consultas disponíveis: ${user.emergency_consultations_left}`);
        console.log(`  Plano: ${user.subscription_plan}`);
        console.log(`  Status: ${user.subscription_status}`);
      });
    }

    // Também vamos atualizar os outros usuários para terem consultas
    console.log('\n🔧 Atualizando outros usuários...');
    
    const otherUsers = [
      { email: 'gerhardtvini95@gmail.com', consultations: 3 },
      { email: 'mariana_delima@icloud.com', consultations: 5 }
    ];

    for (const user of otherUsers) {
      try {
        const updated = await prisma.users.update({
          where: { email: user.email },
          data: {
            emergency_consultations_left: user.consultations,
            subscription_status: 'active'
          }
        });
        console.log(`✅ ${updated.email} - ${user.consultations} consultas adicionadas`);
      } catch (error) {
        console.log(`❌ Erro ao atualizar ${user.email}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateEmergencyConsultations();