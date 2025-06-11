import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();

async function checkEmergencyConsultations() {
  console.log('🔍 Verificando consultas de emergência no banco de dados...\n');

  try {
    // 1. Buscar todos os usuários com seus planos
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionPlan: true,
        emergencyConsultationsLeft: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
      },
      where: {
        role: 'patient'
      }
    });

    console.log(`📊 Total de pacientes encontrados: ${users.length}\n`);

    // 2. Analisar a situação das consultas de emergência
    console.log('👤 Detalhes dos pacientes:\n');
    users.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Nome: ${user.name || 'Não informado'}`);
      console.log(`Plano: ${user.subscriptionPlan || 'Sem plano'}`);
      console.log(`Consultas de emergência restantes: ${user.emergencyConsultationsLeft || 0}`);
      console.log(`Assinatura ativa: ${user.subscriptionEndDate ? new Date(user.subscriptionEndDate) > new Date() : false}`);
      console.log('---');
    });

    // 3. Buscar um usuário específico para teste
    const testEmail = 'lucas.canova@example.com';
    console.log(`\n🔍 Buscando usuário de teste: ${testEmail}`);
    
    let testUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (!testUser) {
      console.log('❌ Usuário de teste não encontrado. Criando...');
      
      // Criar usuário de teste
      testUser = await prisma.user.create({
        data: {
          email: testEmail,
          password: '$2b$10$YourHashedPasswordHere', // Você precisará hash a senha
          name: 'Lucas Canova Teste',
          role: 'patient',
          subscriptionPlan: 'premium',
          emergencyConsultationsLeft: 5,
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          emailVerified: true,
          verificationToken: null
        }
      });
      
      console.log('✅ Usuário de teste criado com sucesso!');
    } else {
      console.log('✅ Usuário de teste encontrado!');
    }

    // 4. Atualizar consultas de emergência do usuário de teste
    console.log('\n🔧 Atualizando consultas de emergência do usuário de teste...');
    
    const updatedUser = await prisma.user.update({
      where: { email: testEmail },
      data: {
        emergencyConsultationsLeft: 5,
        subscriptionPlan: 'premium',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    console.log('✅ Usuário atualizado com sucesso!');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Plano: ${updatedUser.subscriptionPlan}`);
    console.log(`   Consultas de emergência: ${updatedUser.emergencyConsultationsLeft}`);
    console.log(`   Assinatura válida até: ${updatedUser.subscriptionEndDate}`);

    // 5. Verificar os planos de assinatura disponíveis
    console.log('\n📋 Planos de assinatura no sistema:');
    const subscriptionPlans = await prisma.subscriptionPlan.findMany();
    
    subscriptionPlans.forEach(plan => {
      console.log(`\nPlano: ${plan.name}`);
      console.log(`  ID: ${plan.id}`);
      console.log(`  Preço: R$ ${plan.price}`);
      console.log(`  Consultas de emergência: ${plan.emergencyConsultations || 0}`);
      console.log(`  Ativo: ${plan.active}`);
    });

    // 6. Listar todos os usuários com consultas de emergência disponíveis
    console.log('\n🚨 Usuários com consultas de emergência disponíveis:');
    const usersWithEmergency = await prisma.user.findMany({
      where: {
        emergencyConsultationsLeft: {
          gt: 0
        }
      },
      select: {
        email: true,
        name: true,
        emergencyConsultationsLeft: true,
        subscriptionPlan: true
      }
    });

    if (usersWithEmergency.length === 0) {
      console.log('❌ Nenhum usuário com consultas de emergência disponíveis!');
    } else {
      usersWithEmergency.forEach(user => {
        console.log(`${user.email} - ${user.emergencyConsultationsLeft} consultas (Plano: ${user.subscriptionPlan})`);
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar consultas de emergência:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
checkEmergencyConsultations();