const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function diagnoseEmergencyStatus() {
  console.log('🔍 Diagnóstico de Status das Consultas de Emergência\n');

  try {
    // 1. Verificar consultas de emergência recentes
    console.log('📊 1. Verificando consultas de emergência recentes...');
    const recentAppointments = await prisma.appointments.findMany({
      where: {
        is_emergency: true,
        created_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 dias
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 20
    });

    console.log(`\n📝 Total de consultas de emergência nos últimos 7 dias: ${recentAppointments.length}`);
    
    if (recentAppointments.length > 0) {
      console.log('\nDetalhes das consultas:');
      recentAppointments.forEach((apt, index) => {
        console.log(`\n${index + 1}. Consulta ID: ${apt.id}`);
        console.log(`   Status: ${apt.status} ${apt.status === 'waiting' ? '⏳' : apt.status === 'scheduled' ? '📅' : '✅'}`);
        console.log(`   Criada em: ${apt.created_at}`);
        console.log(`   User ID: ${apt.user_id}`);
        console.log(`   Doctor ID: ${apt.doctor_id || 'NULL ❌'}`);
        console.log(`   Tipo: ${apt.type}`);
        console.log(`   Sala: ${apt.telemed_room_name || 'N/A'}`);
        if (apt.notes) console.log(`   Notas: ${apt.notes}`);
      });
    }

    // 2. Verificar distribuição de status
    console.log('\n\n📊 2. Distribuição de status das consultas de emergência:');
    const statusCounts = {};
    recentAppointments.forEach(apt => {
      statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} consultas`);
    });

    // 3. Verificar consultas sem médico
    console.log('\n\n📊 3. Consultas sem médico atribuído:');
    const consultationsWithoutDoctor = recentAppointments.filter(apt => !apt.doctor_id);
    console.log(`Total: ${consultationsWithoutDoctor.length}`);
    
    if (consultationsWithoutDoctor.length > 0) {
      console.log('\nDetalhes:');
      consultationsWithoutDoctor.forEach(apt => {
        console.log(`   - ID ${apt.id}: status = "${apt.status}" (criada há ${Math.round((Date.now() - new Date(apt.created_at).getTime()) / 60000)} minutos)`);
      });
    }

    // 4. Verificar médicos disponíveis
    console.log('\n\n📊 4. Médicos disponíveis para emergência:');
    const availableDoctors = await prisma.doctors.findMany({
      where: {
        available_for_emergency: true
      }
    });

    console.log(`Total de médicos disponíveis: ${availableDoctors.length}`);
    
    if (availableDoctors.length > 0) {
      for (const doctor of availableDoctors) {
        const user = await prisma.users.findUnique({
          where: { id: doctor.user_id }
        });
        console.log(`   - ID ${doctor.id}: ${user?.email || 'email não encontrado'} (${doctor.specialization})`);
      }
    }

    // 5. Análise do problema
    console.log('\n\n💡 ANÁLISE DO PROBLEMA:');
    console.log('=====================================');
    
    const scheduledWithDoctor = recentAppointments.filter(apt => apt.status === 'scheduled' && apt.doctor_id);
    const scheduledWithoutDoctor = recentAppointments.filter(apt => apt.status === 'scheduled' && !apt.doctor_id);
    const waitingConsultations = recentAppointments.filter(apt => apt.status === 'waiting');
    
    console.log(`\n📌 Consultas com status "scheduled" e médico atribuído: ${scheduledWithDoctor.length}`);
    console.log(`📌 Consultas com status "scheduled" sem médico: ${scheduledWithoutDoctor.length}`);
    console.log(`📌 Consultas com status "waiting": ${waitingConsultations.length}`);
    
    if (scheduledWithDoctor.length > 0) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
      console.log('As consultas de emergência estão sendo criadas com:');
      console.log('1. Status "scheduled" ao invés de "waiting"');
      console.log('2. Doctor ID já preenchido ao invés de NULL');
      console.log('\nIsso faz com que não apareçam como "Aguardando" na interface!');
    }

    // 6. Verificar rotas sendo usadas
    console.log('\n\n📊 6. Verificando padrão das consultas:');
    const emergencyV2Pattern = recentAppointments.filter(apt => 
      apt.notes && apt.notes.includes('Consulta de emergência com Dr.')
    );
    const oldPatternPattern = recentAppointments.filter(apt => 
      apt.notes && apt.notes.includes('Consulta de emergência iniciada pelo paciente')
    );
    
    console.log(`\n✅ Usando rota emergency/v2 (nova): ${emergencyV2Pattern.length} consultas`);
    console.log(`📌 Usando rota emergency/patient (antiga): ${oldPatternPattern.length} consultas`);
    
    if (emergencyV2Pattern.length > 0) {
      console.log('\n⚠️  A rota emergency/v2 está criando consultas com médico pré-selecionado!');
      console.log('Isso é intencional para o novo fluxo onde o paciente escolhe o médico.');
      console.log('Mas o status deveria ser "waiting" até o médico aceitar.');
    }

    // 7. Sugestão de correção
    console.log('\n\n🔧 CORREÇÃO NECESSÁRIA:');
    console.log('=====================================');
    console.log('No arquivo server/routes/emergency-v2.ts, linha 82:');
    console.log('ATUAL:    status: "scheduled",');
    console.log('CORRETO:  status: "waiting",');
    console.log('\nIsso fará com que as consultas apareçam corretamente como "Aguardando".');

  } catch (error) {
    console.error('❌ Erro ao executar diagnóstico:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o diagnóstico
diagnoseEmergencyStatus();