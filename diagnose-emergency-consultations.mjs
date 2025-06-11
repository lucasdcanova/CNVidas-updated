import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();

async function diagnoseEmergencyConsultations() {
  console.log('🔍 Diagnóstico de Consultas de Emergência\n');

  try {
    // 1. Verificar consultas de emergência recentes
    console.log('📊 1. Verificando consultas de emergência recentes...');
    const recentAppointments = await prisma.appointment.findMany({
      where: {
        isEmergency: true,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        }
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            emergencyConsultationsLeft: true,
            subscriptionPlan: true
          }
        },
        doctor: {
          select: {
            user: {
              select: {
                email: true,
                name: true
              }
            },
            specialization: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n📝 Total de consultas de emergência nas últimas 24h: ${recentAppointments.length}`);
    
    if (recentAppointments.length > 0) {
      console.log('\nDetalhes das consultas:');
      recentAppointments.forEach((apt, index) => {
        console.log(`\n${index + 1}. Consulta ID: ${apt.id}`);
        console.log(`   Status: ${apt.status} ${apt.status === 'waiting' ? '⏳' : '✅'}`);
        console.log(`   Criada em: ${apt.createdAt}`);
        console.log(`   Paciente: ${apt.user?.email || 'N/A'}`);
        console.log(`   Médico: ${apt.doctor ? `${apt.doctor.user.email} (${apt.doctor.specialization})` : 'NENHUM MÉDICO ATRIBUÍDO ❌'}`);
        console.log(`   Sala: ${apt.telemedRoomName || 'N/A'}`);
        console.log(`   Tipo: ${apt.type}`);
        console.log(`   DoctorId: ${apt.doctorId || 'NULL'}`);
        console.log(`   ServiceId: ${apt.serviceId || 'NULL'}`);
        console.log(`   ConsultationStartedAt: ${apt.consultationStartedAt || 'NULL'}`);
        console.log(`   WasCharged: ${apt.wasCharged || false}`);
      });
    }

    // 2. Verificar consultas em status 'waiting'
    console.log('\n\n📊 2. Verificando consultas em status "waiting"...');
    const waitingConsultations = await prisma.appointment.findMany({
      where: {
        status: 'waiting',
        isEmergency: true
      },
      include: {
        user: true,
        doctor: true
      }
    });

    console.log(`Total de consultas aguardando: ${waitingConsultations.length}`);
    if (waitingConsultations.length > 0) {
      waitingConsultations.forEach(apt => {
        console.log(`\n- ID: ${apt.id}`);
        console.log(`  Paciente: ${apt.user?.email}`);
        console.log(`  Criada há: ${Math.round((Date.now() - new Date(apt.createdAt).getTime()) / 60000)} minutos`);
      });
    }

    // 3. Verificar status únicos de consultas
    console.log('\n\n📊 3. Distribuição de status das consultas de emergência:');
    const statusCount = await prisma.appointment.groupBy({
      by: ['status'],
      where: {
        isEmergency: true
      },
      _count: {
        status: true
      }
    });

    statusCount.forEach(item => {
      console.log(`   ${item.status}: ${item._count.status} consultas`);
    });

    // 4. Verificar médicos disponíveis para emergência
    console.log('\n\n📊 4. Médicos disponíveis para emergência:');
    const availableDoctors = await prisma.doctor.findMany({
      where: {
        availableForEmergency: true
      },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    console.log(`Total de médicos disponíveis: ${availableDoctors.length}`);
    availableDoctors.forEach(doctor => {
      console.log(`   - ${doctor.user.email} (${doctor.specialization})`);
    });

    // 5. Verificar campos do schema
    console.log('\n\n📊 5. Verificando estrutura das consultas...');
    const sampleAppointment = await prisma.appointment.findFirst({
      where: {
        isEmergency: true
      }
    });

    if (sampleAppointment) {
      console.log('\nCampos disponíveis na tabela appointments:');
      Object.keys(sampleAppointment).forEach(key => {
        console.log(`   - ${key}: ${typeof sampleAppointment[key]}`);
      });
    }

    // 6. Verificar problemas específicos
    console.log('\n\n🔍 6. Diagnóstico de problemas:');
    
    // Verificar se há consultas sem médico mas com status diferente de 'waiting'
    const problematicAppointments = await prisma.appointment.findMany({
      where: {
        isEmergency: true,
        doctorId: null,
        status: {
          not: 'waiting'
        }
      }
    });

    if (problematicAppointments.length > 0) {
      console.log(`\n⚠️  PROBLEMA: ${problematicAppointments.length} consultas sem médico mas com status diferente de 'waiting'`);
      problematicAppointments.forEach(apt => {
        console.log(`   - ID ${apt.id}: status = ${apt.status}`);
      });
    }

    // 7. Sugestão de correção
    console.log('\n\n💡 Análise do problema:');
    console.log('O problema parece estar na criação das consultas de emergência.');
    console.log('As consultas estão sendo criadas com:');
    console.log('- status: "scheduled" (deveria ser "waiting")');
    console.log('- doctorId já preenchido (deveria ser null até um médico aceitar)');
    console.log('\nIsso explica por que não aparecem como "Waiting" na interface.');

  } catch (error) {
    console.error('❌ Erro ao executar diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o diagnóstico
diagnoseEmergencyConsultations();