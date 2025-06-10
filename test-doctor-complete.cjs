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

async function testDoctorLogin() {
  console.log('\n🔐 TESTE: Login do Médico');
  
  try {
    const response = await api.post('/api/login', {
      email: 'dr.teste.1749419452680@cnvidas.com',
      password: 'password123'
    });
    
    if (response.status === 200 && response.data.user) {
      authToken = response.data.token;
      doctorUserId = response.data.user.id;
      doctorData = response.data.user;
      
      console.log('✅ Login bem-sucedido');
      console.log('   Email:', response.data.user.email);
      console.log('   Role:', response.data.user.role);
      console.log('   ID:', response.data.user.id);
      
      if (response.data.user.role !== 'doctor') {
        console.log('⚠️ AVISO: Usuário não é médico!');
        return false;
      }
      
      return true;
    } else {
      console.log('❌ Falha no login:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Erro no login:', error.response?.data || error.message);
    return false;
  }
}

async function testDoctorProfile() {
  console.log('\n👤 TESTE: Perfil do Médico');
  
  const tests = [
    {
      name: 'Buscar perfil básico (/api/doctors/profile)',
      url: '/api/doctors/profile',
      method: 'GET'
    },
    {
      name: 'Buscar perfil por user ID (/api/doctors/user/:id)',
      url: `/api/doctors/user/${doctorUserId}`,
      method: 'GET'
    },
    {
      name: 'Atualizar perfil (/api/doctors/profile)',
      url: '/api/doctors/profile',
      method: 'PUT',
      data: {
        specialty: 'Cardiologia',
        crm: '12345-SP',
        bio: 'Médico especialista em cardiologia'
      }
    }
  ];
  
  let successCount = 0;
  
  for (const test of tests) {
    try {
      const config = {
        headers: authToken ? { 'x-auth-token': authToken } : {}
      };
      
      let response;
      if (test.method === 'GET') {
        response = await api.get(test.url, config);
      } else if (test.method === 'PUT') {
        response = await api.put(test.url, test.data, config);
      }
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name}`);
        if (test.name.includes('Buscar perfil básico')) {
          console.log('   Dados:', JSON.stringify(response.data, null, 2));
        }
        successCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Erro: ${error.response?.status || error.message}`);
    }
  }
  
  return { total: tests.length, success: successCount };
}

async function testDoctorAppointments() {
  console.log('\n📅 TESTE: Consultas do Médico');
  
  const tests = [
    {
      name: 'Listar consultas (/api/doctors/appointments)',
      url: '/api/doctors/appointments',
      method: 'GET'
    },
    {
      name: 'Consultas pendentes (/api/doctors/appointments?status=pending)',
      url: '/api/doctors/appointments?status=pending',
      method: 'GET'
    },
    {
      name: 'Histórico de consultas (/api/doctors/appointments/history)',
      url: '/api/doctors/appointments/history',
      method: 'GET'
    }
  ];
  
  let successCount = 0;
  
  for (const test of tests) {
    try {
      const config = {
        headers: authToken ? { 'x-auth-token': authToken } : {}
      };
      
      const response = await api.get(test.url, config);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name}`);
        successCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Erro: ${error.response?.status || error.message}`);
    }
  }
  
  return { total: tests.length, success: successCount };
}

async function testDoctorFinances() {
  console.log('\n💰 TESTE: Finanças do Médico');
  
  const tests = [
    {
      name: 'Pagamentos recebidos (/api/doctors/payments)',
      url: '/api/doctors/payments',
      method: 'GET'
    },
    {
      name: 'Estatísticas financeiras (/api/doctors/earnings)',
      url: '/api/doctors/earnings',
      method: 'GET'
    },
    {
      name: 'Configurações de pagamento (/api/doctors/payment-settings)',
      url: '/api/doctors/payment-settings',
      method: 'GET'
    },
    {
      name: 'Atualizar dados bancários (/api/doctors/payment-settings)',
      url: '/api/doctors/payment-settings',
      method: 'PUT',
      data: {
        pixKey: 'medico@test.com',
        pixKeyType: 'email',
        bankName: 'Banco Teste',
        accountType: 'checking'
      }
    }
  ];
  
  let successCount = 0;
  
  for (const test of tests) {
    try {
      const config = {
        headers: authToken ? { 'x-auth-token': authToken } : {}
      };
      
      let response;
      if (test.method === 'GET') {
        response = await api.get(test.url, config);
      } else if (test.method === 'PUT') {
        response = await api.put(test.url, test.data, config);
      }
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name}`);
        successCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Erro: ${error.response?.status || error.message}`);
    }
  }
  
  return { total: tests.length, success: successCount };
}

async function testDoctorAvailability() {
  console.log('\n⏰ TESTE: Disponibilidade do Médico');
  
  const tests = [
    {
      name: 'Listar horários disponíveis (/api/doctors/availability)',
      url: '/api/doctors/availability',
      method: 'GET'
    },
    {
      name: 'Definir horários (/api/doctors/availability)',
      url: '/api/doctors/availability',
      method: 'POST',
      data: {
        dayOfWeek: 1, // Segunda-feira
        startTime: '09:00',
        endTime: '17:00',
        available: true
      }
    },
    {
      name: 'Atualizar horários (/api/doctors/availability)',
      url: '/api/doctors/availability',
      method: 'PUT',
      data: {
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '18:00',
        available: true
      }
    }
  ];
  
  let successCount = 0;
  
  for (const test of tests) {
    try {
      const config = {
        headers: authToken ? { 'x-auth-token': authToken } : {}
      };
      
      let response;
      if (test.method === 'GET') {
        response = await api.get(test.url, config);
      } else if (test.method === 'POST') {
        response = await api.post(test.url, test.data, config);
      } else if (test.method === 'PUT') {
        response = await api.put(test.url, test.data, config);
      }
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name}`);
        successCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Erro: ${error.response?.status || error.message}`);
    }
  }
  
  return { total: tests.length, success: successCount };
}

async function testDoctorNotifications() {
  console.log('\n🔔 TESTE: Notificações do Médico');
  
  const tests = [
    {
      name: 'Listar notificações (/api/notifications)',
      url: '/api/notifications',
      method: 'GET'
    },
    {
      name: 'Notificações não lidas (/api/notifications/unread-count)',
      url: '/api/notifications/unread-count',
      method: 'GET'
    },
    {
      name: 'Marcar como lida (/api/notifications/mark-read)',
      url: '/api/notifications/mark-read',
      method: 'POST',
      data: {
        notificationId: 1
      }
    }
  ];
  
  let successCount = 0;
  
  for (const test of tests) {
    try {
      const config = {
        headers: authToken ? { 'x-auth-token': authToken } : {}
      };
      
      let response;
      if (test.method === 'GET') {
        response = await api.get(test.url, config);
      } else if (test.method === 'POST') {
        response = await api.post(test.url, test.data, config);
      }
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name}`);
        successCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Erro: ${error.response?.status || error.message}`);
    }
  }
  
  return { total: tests.length, success: successCount };
}

async function testDoctorDashboard() {
  console.log('\n📊 TESTE: Dashboard do Médico');
  
  const tests = [
    {
      name: 'Estatísticas do dashboard (/api/doctors/dashboard)',
      url: '/api/doctors/dashboard',
      method: 'GET'
    },
    {
      name: 'Status de boas-vindas (/api/doctors/welcome-status)',
      url: '/api/doctors/welcome-status',
      method: 'GET'
    },
    {
      name: 'Completar boas-vindas (/api/doctors/complete-welcome)',
      url: '/api/doctors/complete-welcome',
      method: 'POST',
      data: {}
    }
  ];
  
  let successCount = 0;
  
  for (const test of tests) {
    try {
      const config = {
        headers: authToken ? { 'x-auth-token': authToken } : {}
      };
      
      let response;
      if (test.method === 'GET') {
        response = await api.get(test.url, config);
      } else if (test.method === 'POST') {
        response = await api.post(test.url, test.data, config);
      }
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name}`);
        successCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Erro: ${error.response?.status || error.message}`);
    }
  }
  
  return { total: tests.length, success: successCount };
}

async function runAllTests() {
  console.log('🏥 INICIANDO TESTES COMPLETOS DO SISTEMA DE MÉDICOS');
  console.log('================================================');
  
  // Fazer login primeiro
  const loginSuccess = await testDoctorLogin();
  if (!loginSuccess) {
    console.log('\n❌ FALHA NO LOGIN - Interrompendo testes');
    return;
  }
  
  // Executar todos os testes
  const results = {
    profile: await testDoctorProfile(),
    appointments: await testDoctorAppointments(),
    finances: await testDoctorFinances(),
    availability: await testDoctorAvailability(),
    notifications: await testDoctorNotifications(),
    dashboard: await testDoctorDashboard()
  };
  
  // Calcular estatísticas
  let totalTests = 0;
  let totalSuccess = 0;
  
  Object.values(results).forEach(result => {
    totalTests += result.total;
    totalSuccess += result.success;
  });
  
  console.log('\n📈 RESUMO DOS TESTES');
  console.log('==================');
  console.log(`Total de testes: ${totalTests}`);
  console.log(`Sucessos: ${totalSuccess}`);
  console.log(`Falhas: ${totalTests - totalSuccess}`);
  console.log(`Taxa de sucesso: ${Math.round((totalSuccess / totalTests) * 100)}%`);
  
  console.log('\n📊 DETALHES POR CATEGORIA:');
  Object.entries(results).forEach(([category, result]) => {
    const percentage = Math.round((result.success / result.total) * 100);
    console.log(`   ${category}: ${result.success}/${result.total} (${percentage}%)`);
  });
  
  console.log('\n🔧 RECOMENDAÇÕES:');
  if (results.profile.success === 0) {
    console.log('   - Criar rotas de perfil do médico (/api/doctors/profile, /api/doctors/user/:id)');
  }
  if (results.appointments.success === 0) {
    console.log('   - Implementar sistema de consultas do médico');
  }
  if (results.finances.success === 0) {
    console.log('   - Criar sistema financeiro para médicos');
  }
  if (results.availability.success === 0) {
    console.log('   - Implementar gestão de disponibilidade');
  }
  if (results.notifications.success === 0) {
    console.log('   - Criar sistema de notificações');
  }
  if (results.dashboard.success === 0) {
    console.log('   - Implementar dashboard do médico');
  }
}

// Executar testes
runAllTests().catch(console.error); 