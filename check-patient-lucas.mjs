import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPatientLucasSubscription() {
  console.log('🔍 VERIFICANDO ASSINATURA DO PACIENTE LUCAS DICKEL CANOVA');
  console.log('=======================================================\n');
  
  try {
    // Buscar o usuário paciente com nome "Lucas Dickel Canova"
    const patient = await prisma.users.findFirst({
      where: {
        full_name: 'Lucas Dickel Canova',
        role: 'patient'
      },
      select: {
        id: true,
        email: true,
        username: true,
        full_name: true,
        role: true,
        subscription_plan: true,
        subscription_status: true,
        stripe_customer_id: true,
        stripe_subscription_id: true,
        emergency_consultations_left: true,
        email_verified: true,
        created_at: true,
        updated_at: true,
        subscription_changed_at: true,
        last_subscription_cancellation: true,
        seller_name: true,
        cpf: true,
        phone: true,
        city: true,
        state: true
      }
    });

    if (patient) {
      console.log('✅ PACIENTE ENCONTRADO:');
      console.log('========================');
      console.log(`📋 Informações Pessoais:`);
      console.log(`   ID: ${patient.id}`);
      console.log(`   Nome: ${patient.full_name}`);
      console.log(`   Email: ${patient.email}`);
      console.log(`   Username: ${patient.username}`);
      console.log(`   CPF: ${patient.cpf || 'Não informado'}`);
      console.log(`   Telefone: ${patient.phone || 'Não informado'}`);
      console.log(`   Cidade/Estado: ${patient.city || 'Não informado'}/${patient.state || 'Não informado'}`);
      console.log(`   Email Verificado: ${patient.email_verified ? 'Sim' : 'Não'}`);
      
      console.log(`\n💳 Informações de Assinatura:`);
      console.log(`   Plano: ${patient.subscription_plan || 'Nenhum'}`);
      console.log(`   Status: ${patient.subscription_status || 'Inativo'}`);
      console.log(`   Consultas de Emergência Restantes: ${patient.emergency_consultations_left || 0}`);
      console.log(`   Vendedor: ${patient.seller_name || 'Não informado'}`);
      
      console.log(`\n🔗 IDs do Stripe:`);
      console.log(`   Customer ID: ${patient.stripe_customer_id || 'Não configurado'}`);
      console.log(`   Subscription ID: ${patient.stripe_subscription_id || 'Não configurado'}`);
      
      console.log(`\n📅 Datas:`);
      console.log(`   Conta criada em: ${patient.created_at}`);
      console.log(`   Última atualização: ${patient.updated_at}`);
      console.log(`   Última mudança de assinatura: ${patient.subscription_changed_at || 'Nunca'}`);
      console.log(`   Último cancelamento: ${patient.last_subscription_cancellation || 'Nunca'}`);
      
      // Verificar se há outros usuários com nome similar
      console.log('\n🔍 VERIFICANDO OUTROS USUÁRIOS COM NOME SIMILAR...');
      const similarUsers = await prisma.users.findMany({
        where: {
          full_name: {
            contains: 'Lucas',
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          subscription_plan: true,
          subscription_status: true
        }
      });
      
      if (similarUsers.length > 1) {
        console.log(`\n📊 OUTROS USUÁRIOS COM NOME SIMILAR (Total: ${similarUsers.length}):`);
        similarUsers.forEach((user, index) => {
          console.log(`\n   ${index + 1}. ${user.full_name}`);
          console.log(`      ID: ${user.id}`);
          console.log(`      Email: ${user.email}`);
          console.log(`      Role: ${user.role}`);
          console.log(`      Plano: ${user.subscription_plan || 'Nenhum'}`);
          console.log(`      Status: ${user.subscription_status || 'Inativo'}`);
        });
      }
      
    } else {
      console.log('❌ PACIENTE NÃO ENCONTRADO');
      console.log('\n🔍 Buscando todos os pacientes para verificar...');
      
      const allPatients = await prisma.users.findMany({
        where: {
          role: 'patient'
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          subscription_plan: true,
          subscription_status: true
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 10
      });
      
      console.log(`\n📋 ÚLTIMOS 10 PACIENTES CADASTRADOS:`);
      allPatients.forEach((patient, index) => {
        console.log(`\n   ${index + 1}. ${patient.full_name}`);
        console.log(`      ID: ${patient.id}`);
        console.log(`      Email: ${patient.email}`);
        console.log(`      Plano: ${patient.subscription_plan || 'Nenhum'}`);
        console.log(`      Status: ${patient.subscription_status || 'Inativo'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ ERRO AO CONSULTAR BANCO DE DADOS:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar a verificação
checkPatientLucasSubscription();