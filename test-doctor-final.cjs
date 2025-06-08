const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Configurar axios para incluir cookies
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

let authToken = null;
let doctorUserId = null;
let doctorData = null;

async function runCompleteTest() {
  console.log('🏥 TESTE COMPLETO DO SISTEMA DE MÉDICOS - CNVidas');
  console.log('=================================================');
  console.log('Data:', new Date().toLocaleString('pt-BR'));
  console.log('');

  const results = {
    login: false,
    profile: { get: false, update: false },
    appointments: { list: false, history: false },
    payments: { list: false, earnings: false, settings: false },
    availability: { get: false, set: false },
    notifications: { list: false, count: false, markRead: false },
    dashboard: { stats: false, welcome: false }
  };

  try {
    // 1. TESTE DE LOGIN
    console.log('🔐 1. TESTE DE LOGIN');
    console.log('-------------------');
    
    const loginResponse = await api.post('/api/login', {
      email: 'dr.teste.1749419452680@cnvidas.com',
      password: 'password123'
    });
    
    if (loginResponse.status === 200 && loginResponse.data.user) {
      authToken = loginResponse.data.token;
      doctorUserId = loginResponse.data.user.id;
      doctorData = loginResponse.data.user;
      results.login = true;
      
      console.log('✅ Login realizado com sucesso');
      console.log(`   Email: ${loginResponse.data.user.email}`);
      console.log(`   Role: ${loginResponse.data.user.role}`);
      console.log(`   ID: ${loginResponse.data.user.id}`);
      
      // Configurar token para próximas requisições
      api.defaults.headers['x-auth-token'] = authToken;
      api.defaults.headers['Authorization'] = `Bearer ${authToken}`;
    } else {
      console.log('❌ Falha no login');
      return results;
    }

    // 2. TESTE DE PERFIL
    console.log('\n👤 2. TESTE DE PERFIL');
    console.log('--------------------');
    
    try {
      // 2.1 Buscar perfil
      const profileResponse = await api.get('/api/doctors/profile');
      if (profileResponse.status === 200) {
        results.profile.get = true;
        console.log('✅ Buscar perfil: SUCESSO');
        console.log(`   ID do perfil: ${profileResponse.data.id}`);
        console.log(`   Especialização: ${profileResponse.data.specialization || 'Não informado'}`);
        console.log(`   CRM: ${profileResponse.data.licenseNumber || 'Não informado'}`);
        console.log(`   Status: ${profileResponse.data.status}`);
      }
      
      // 2.2 Atualizar perfil
      const updateData = {
        specialization: 'Cardiologia Intervencionista',
        licenseNumber: 'CRM-54321-SP',
        biography: 'Médico especialista em cardiologia intervencionista com 15 anos de experiência.',
        education: 'Residência em Cardiologia - Hospital das Clínicas USP',
        experienceYears: 15,
        consultationFee: 350,
        availableForEmergency: true
      };
      
      const updateResponse = await api.put('/api/doctors/profile', updateData);
      if (updateResponse.status === 200) {
        results.profile.update = true;
        console.log('✅ Atualizar perfil: SUCESSO');
        console.log(`   Nova especialização: ${updateResponse.data.specialization}`);
        console.log(`   Novo CRM: ${updateResponse.data.licenseNumber}`);
        console.log(`   Anos de experiência: ${updateResponse.data.experienceYears}`);
      }
    } catch (error) {
      console.log('❌ Erro no teste de perfil:', error.response?.data?.error || error.message);
    }

    // 3. TESTE DE CONSULTAS
    console.log('\n📅 3. TESTE DE CONSULTAS');
    console.log('-----------------------');
    
    try {
      // 3.1 Listar consultas
      const appointmentsResponse = await api.get('/api/doctors/appointments');
      if (appointmentsResponse.status === 200) {
        results.appointments.list = true;
        console.log('✅ Listar consultas: SUCESSO');
        console.log(`   Total de consultas: ${appointmentsResponse.data.total || 0}`);
      }
      
      // 3.2 Histórico de consultas
      const historyResponse = await api.get('/api/doctors/appointments/history');
      if (historyResponse.status === 200) {
        results.appointments.history = true;
        console.log('✅ Histórico de consultas: SUCESSO');
        console.log(`   Total no histórico: ${historyResponse.data.total || 0}`);
      }
    } catch (error) {
      console.log('❌ Erro no teste de consultas:', error.response?.data?.error || error.message);
    }

    // 4. TESTE DE PAGAMENTOS
    console.log('\n💰 4. TESTE DE PAGAMENTOS');
    console.log('------------------------');
    
    try {
      // 4.1 Listar pagamentos
      const paymentsResponse = await api.get('/api/doctors/payments');
      if (paymentsResponse.status === 200) {
        results.payments.list = true;
        console.log('✅ Listar pagamentos: SUCESSO');
        console.log(`   Total de pagamentos: ${paymentsResponse.data.total || 0}`);
      }
      
      // 4.2 Estatísticas de ganhos
      const earningsResponse = await api.get('/api/doctors/earnings');
      if (earningsResponse.status === 200) {
        results.payments.earnings = true;
        console.log('✅ Estatísticas de ganhos: SUCESSO');
        console.log(`   Ganhos totais: R$ ${earningsResponse.data.totalEarnings || 0}`);
        console.log(`   Ganhos mensais: R$ ${earningsResponse.data.monthlyEarnings || 0}`);
      }
      
      // 4.3 Configurações de pagamento
      const settingsResponse = await api.get('/api/doctors/payment-settings');
      if (settingsResponse.status === 200) {
        results.payments.settings = true;
        console.log('✅ Configurações de pagamento: SUCESSO');
        console.log(`   Tipo PIX: ${settingsResponse.data.pixKeyType || 'Não configurado'}`);
        console.log(`   Banco: ${settingsResponse.data.bankName || 'Não configurado'}`);
      }
    } catch (error) {
      console.log('❌ Erro no teste de pagamentos:', error.response?.data?.error || error.message);
    }

    // 5. TESTE DE DISPONIBILIDADE
    console.log('\n⏰ 5. TESTE DE DISPONIBILIDADE');
    console.log('-----------------------------');
    
    try {
      // 5.1 Buscar disponibilidade
      const availabilityResponse = await api.get('/api/doctors/availability');
      if (availabilityResponse.status === 200) {
        results.availability.get = true;
        console.log('✅ Buscar disponibilidade: SUCESSO');
        console.log(`   Horários configurados: ${availabilityResponse.data.schedules?.length || 0}`);
      }
      
      // 5.2 Definir disponibilidade
      const setAvailabilityData = {
        schedules: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
          { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
          { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
          { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' }
        ]
      };
      
      const setAvailabilityResponse = await api.post('/api/doctors/availability', setAvailabilityData);
      if (setAvailabilityResponse.status === 200) {
        results.availability.set = true;
        console.log('✅ Definir disponibilidade: SUCESSO');
        console.log(`   Novos horários definidos: ${setAvailabilityData.schedules.length}`);
      }
    } catch (error) {
      console.log('❌ Erro no teste de disponibilidade:', error.response?.data?.error || error.message);
    }

    // 6. TESTE DE NOTIFICAÇÕES
    console.log('\n🔔 6. TESTE DE NOTIFICAÇÕES');
    console.log('--------------------------');
    
    try {
      // 6.1 Listar notificações
      const notificationsResponse = await api.get('/api/notifications');
      if (notificationsResponse.status === 200) {
        results.notifications.list = true;
        console.log('✅ Listar notificações: SUCESSO');
        console.log(`   Total de notificações: ${notificationsResponse.data.length || 0}`);
      }
      
      // 6.2 Contagem não lidas
      const unreadResponse = await api.get('/api/notifications/unread-count');
      if (unreadResponse.status === 200) {
        results.notifications.count = true;
        console.log('✅ Contagem não lidas: SUCESSO');
        console.log(`   Notificações não lidas: ${unreadResponse.data.count || 0}`);
      }
      
      // 6.3 Marcar como lida (se houver notificações)
      const markReadResponse = await api.put('/api/notifications/read-all');
      if (markReadResponse.status === 200) {
        results.notifications.markRead = true;
        console.log('✅ Marcar como lida: SUCESSO');
      }
    } catch (error) {
      console.log('❌ Erro no teste de notificações:', error.response?.data?.error || error.message);
    }

    // 7. TESTE DE DASHBOARD
    console.log('\n📊 7. TESTE DE DASHBOARD');
    console.log('-----------------------');
    
    try {
      // 7.1 Estatísticas do dashboard
      const dashboardResponse = await api.get('/api/doctors/dashboard');
      if (dashboardResponse.status === 200) {
        results.dashboard.stats = true;
        console.log('✅ Estatísticas do dashboard: SUCESSO');
        console.log(`   Total de consultas: ${dashboardResponse.data.totalAppointments || 0}`);
        console.log(`   Consultas pendentes: ${dashboardResponse.data.pendingAppointments || 0}`);
        console.log(`   Ganhos mensais: R$ ${dashboardResponse.data.monthlyEarnings || 0}`);
      }
      
      // 7.2 Status de boas-vindas
      const welcomeResponse = await api.get('/api/doctors/welcome-status');
      if (welcomeResponse.status === 200) {
        results.dashboard.welcome = true;
        console.log('✅ Status de boas-vindas: SUCESSO');
        console.log(`   Boas-vindas completas: ${welcomeResponse.data.completed ? 'Sim' : 'Não'}`);
      }
    } catch (error) {
      console.log('❌ Erro no teste de dashboard:', error.response?.data?.error || error.message);
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.response?.data || error.message);
  }

  // RELATÓRIO FINAL
  console.log('\n📈 RELATÓRIO FINAL');
  console.log('==================');
  
  const categories = [
    { name: 'Login', tests: [results.login], total: 1 },
    { name: 'Perfil', tests: [results.profile.get, results.profile.update], total: 2 },
    { name: 'Consultas', tests: [results.appointments.list, results.appointments.history], total: 2 },
    { name: 'Pagamentos', tests: [results.payments.list, results.payments.earnings, results.payments.settings], total: 3 },
    { name: 'Disponibilidade', tests: [results.availability.get, results.availability.set], total: 2 },
    { name: 'Notificações', tests: [results.notifications.list, results.notifications.count, results.notifications.markRead], total: 3 },
    { name: 'Dashboard', tests: [results.dashboard.stats, results.dashboard.welcome], total: 2 }
  ];
  
  let totalTests = 0;
  let totalSuccess = 0;
  
  categories.forEach(category => {
    const success = category.tests.filter(Boolean).length;
    const percentage = Math.round((success / category.total) * 100);
    
    console.log(`${category.name}: ${success}/${category.total} (${percentage}%)`);
    
    totalTests += category.total;
    totalSuccess += success;
  });
  
  const overallPercentage = Math.round((totalSuccess / totalTests) * 100);
  
  console.log('');
  console.log(`🎯 RESULTADO GERAL: ${totalSuccess}/${totalTests} (${overallPercentage}%)`);
  
  if (overallPercentage >= 90) {
    console.log('🏆 EXCELENTE! Sistema funcionando perfeitamente.');
  } else if (overallPercentage >= 75) {
    console.log('✅ BOM! Sistema funcionando bem com pequenos ajustes necessários.');
  } else if (overallPercentage >= 50) {
    console.log('⚠️ REGULAR! Sistema precisa de melhorias.');
  } else {
    console.log('❌ CRÍTICO! Sistema precisa de correções urgentes.');
  }
  
  console.log('');
  console.log('📋 CREDENCIAIS DE TESTE:');
  console.log(`   Email: dr.teste.1749419452680@cnvidas.com`);
  console.log(`   Senha: password123`);
  console.log(`   User ID: ${doctorUserId}`);
  console.log('');
  console.log('🔗 ROTAS TESTADAS:');
  console.log('   GET  /api/doctors/profile');
  console.log('   PUT  /api/doctors/profile');
  console.log('   GET  /api/doctors/user/:id');
  console.log('   GET  /api/doctors/appointments');
  console.log('   GET  /api/doctors/appointments/history');
  console.log('   GET  /api/doctors/payments');
  console.log('   GET  /api/doctors/earnings');
  console.log('   GET  /api/doctors/payment-settings');
  console.log('   GET  /api/doctors/availability');
  console.log('   POST /api/doctors/availability');
  console.log('   GET  /api/doctors/dashboard');
  console.log('   GET  /api/doctors/welcome-status');
  console.log('   GET  /api/notifications');
  console.log('   GET  /api/notifications/unread-count');
  console.log('   PUT  /api/notifications/read-all');
  
  return results;
}

// Executar teste
runCompleteTest().catch(console.error); 