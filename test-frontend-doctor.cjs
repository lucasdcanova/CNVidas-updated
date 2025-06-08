const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testFrontendDoctorRoutes() {
  console.log('🔍 TESTANDO ROTAS DO FRONTEND PARA MÉDICOS');
  console.log('=========================================');
  
  try {
    // 1. Fazer login como médico
    console.log('\n1. Fazendo login como médico...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'dr.teste.1749419452680@cnvidas.com',
      password: 'password123'
    }, {
      withCredentials: true
    });
    
    if (loginResponse.status !== 200) {
      console.log('❌ Falha no login do médico');
      return;
    }
    
    console.log('✅ Login do médico bem-sucedido');
    console.log('   ID do usuário:', loginResponse.data.user.id);
    console.log('   Role:', loginResponse.data.user.role);
    
    const userId = loginResponse.data.user.id;
    const authToken = loginResponse.data.token;
    
    // 2. Testar rotas que estavam falhando no frontend
    const routesToTest = [
      {
        name: 'Perfil do médico por user ID',
        url: `/api/doctors/user/${userId}`,
        method: 'GET'
      },
      {
        name: 'Perfil do médico autenticado',
        url: '/api/doctors/profile',
        method: 'GET'
      },
      {
        name: 'Contagem de notificações não lidas',
        url: '/api/notifications/unread-count',
        method: 'GET'
      },
      {
        name: 'Pagamentos do médico',
        url: '/api/doctors/payments',
        method: 'GET'
      },
      {
        name: 'Métodos de pagamento (subscription)',
        url: '/api/subscription/payment-methods',
        method: 'GET'
      },
      {
        name: 'Consultas do médico',
        url: '/api/doctors/appointments',
        method: 'GET'
      }
    ];
    
    console.log('\n2. Testando rotas específicas...');
    
    for (const route of routesToTest) {
      try {
        console.log(`\n🧪 Testando: ${route.name}`);
        console.log(`   URL: ${route.url}`);
        
        const response = await axios({
          method: route.method,
          url: `${BASE_URL}${route.url}`,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'x-auth-token': authToken,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        });
        
        if (response.status >= 200 && response.status < 300) {
          console.log(`   ✅ SUCESSO - Status: ${response.status}`);
          
          // Mostrar dados relevantes
          if (route.name.includes('Perfil do médico')) {
            console.log('   📋 Dados do perfil:');
            console.log(`      ID: ${response.data.id}`);
            console.log(`      User ID: ${response.data.userId}`);
            console.log(`      Especialização: ${response.data.specialization || 'Não informado'}`);
            console.log(`      CRM: ${response.data.licenseNumber || 'Não informado'}`);
            console.log(`      Status: ${response.data.status || 'Não informado'}`);
          } else if (route.name.includes('notificações')) {
            console.log(`   📬 Notificações não lidas: ${response.data.count || 0}`);
          } else if (route.name.includes('Pagamentos')) {
            console.log(`   💰 Pagamentos encontrados: ${response.data.total || 0}`);
          } else if (route.name.includes('Consultas')) {
            console.log(`   📅 Consultas encontradas: ${response.data.total || 0}`);
          }
        } else {
          console.log(`   ❌ FALHA - Status: ${response.status}`);
        }
        
      } catch (error) {
        console.log(`   ❌ ERRO - Status: ${error.response?.status || 'N/A'}`);
        console.log(`   Mensagem: ${error.response?.data?.error || error.message}`);
        
        if (error.response?.status === 404) {
          console.log('   💡 Rota não encontrada - pode precisar ser implementada');
        } else if (error.response?.status === 403) {
          console.log('   🔒 Acesso negado - verificar autenticação');
        } else if (error.response?.status === 401) {
          console.log('   🔐 Não autorizado - verificar token');
        }
      }
    }
    
    // 3. Testar atualização de perfil
    console.log('\n3. Testando atualização de perfil...');
    
    try {
      const updateData = {
        specialization: 'Cardiologia Atualizada',
        licenseNumber: 'CRM-12345-SP',
        biography: 'Médico especialista em cardiologia com experiência em cirurgias.',
        experienceYears: 10,
        consultationFee: 200
      };
      
      const updateResponse = await axios.put(`${BASE_URL}/api/doctors/profile`, updateData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'x-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      if (updateResponse.status >= 200 && updateResponse.status < 300) {
        console.log('✅ Atualização de perfil bem-sucedida');
        console.log('   Dados atualizados:', updateResponse.data);
      } else {
        console.log('❌ Falha na atualização de perfil');
      }
      
    } catch (updateError) {
      console.log('❌ Erro na atualização de perfil:', updateError.response?.data || updateError.message);
    }
    
    // 4. Verificar se o perfil foi atualizado
    console.log('\n4. Verificando perfil atualizado...');
    
    try {
      const verifyResponse = await axios.get(`${BASE_URL}/api/doctors/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'x-auth-token': authToken
        },
        withCredentials: true
      });
      
      if (verifyResponse.status === 200) {
        console.log('✅ Perfil verificado após atualização');
        console.log('   Especialização:', verifyResponse.data.specialization);
        console.log('   CRM:', verifyResponse.data.licenseNumber);
        console.log('   Biografia:', verifyResponse.data.biography);
      }
      
    } catch (verifyError) {
      console.log('❌ Erro ao verificar perfil:', verifyError.response?.data || verifyError.message);
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.response?.data || error.message);
  }
}

// Executar testes
testFrontendDoctorRoutes().catch(console.error); 