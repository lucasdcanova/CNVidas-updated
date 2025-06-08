const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function runPatientTests() {
  console.log('🧪 EXECUTANDO TESTES FINAIS DA EXPERIÊNCIA DO PACIENTE\n');
  
  let authToken = null;
  let testResults = {
    login: false,
    doctors: false,
    services: false,
    emergency: false,
    qrGenerate: false,
    qrVerify: false,
    profile: false
  };

  try {
    // 1. Teste de Login
    console.log('1️⃣ Testando LOGIN...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'patient-test@example.com',
        password: 'test123'
      });
      
      if (loginResponse.data.token && loginResponse.data.user) {
        authToken = loginResponse.data.token;
        testResults.login = true;
        console.log('   ✅ Login funcionando - Token obtido');
        console.log(`   👤 Usuário: ${loginResponse.data.user.fullName} (${loginResponse.data.user.role})`);
      } else {
        console.log('   ❌ Login falhou - Resposta inválida');
      }
    } catch (error) {
      console.log('   ❌ Login falhou:', error.response?.data?.error || error.message);
    }

    // 2. Teste de Listagem de Médicos
    console.log('\n2️⃣ Testando LISTAGEM DE MÉDICOS...');
    try {
      const doctorsResponse = await axios.get(`${BASE_URL}/api/doctors`);
      
      if (doctorsResponse.data && Array.isArray(doctorsResponse.data)) {
        testResults.doctors = true;
        console.log(`   ✅ Médicos carregados - Total: ${doctorsResponse.data.length}`);
        
        const emergencyDoctors = doctorsResponse.data.filter(d => d.availableForEmergency);
        console.log(`   🚨 Médicos de emergência: ${emergencyDoctors.length}`);
      } else {
        console.log('   ❌ Falha ao carregar médicos - Resposta inválida');
      }
    } catch (error) {
      console.log('   ❌ Falha ao carregar médicos:', error.response?.data?.error || error.message);
    }

    // 3. Teste de Listagem de Serviços
    console.log('\n3️⃣ Testando LISTAGEM DE SERVIÇOS...');
    try {
      const servicesResponse = await axios.get(`${BASE_URL}/api/services`);
      
      if (servicesResponse.data && Array.isArray(servicesResponse.data)) {
        testResults.services = true;
        console.log(`   ✅ Serviços carregados - Total: ${servicesResponse.data.length}`);
        
        const paidServices = servicesResponse.data.filter(s => s.price > 0);
        console.log(`   💰 Serviços pagos: ${paidServices.length}`);
      } else {
        console.log('   ❌ Falha ao carregar serviços - Resposta inválida');
      }
    } catch (error) {
      console.log('   ❌ Falha ao carregar serviços:', error.response?.data?.error || error.message);
    }

    // 4. Teste de Verificação de Emergência
    console.log('\n4️⃣ Testando VERIFICAÇÃO DE EMERGÊNCIA...');
    try {
      const emergencyResponse = await axios.get(`${BASE_URL}/api/emergency/patient/check-doctors`);
      
      if (emergencyResponse.data && typeof emergencyResponse.data.doctorsAvailable === 'boolean') {
        testResults.emergency = true;
        console.log(`   ✅ Verificação de emergência funcionando`);
        console.log(`   🏥 Médicos disponíveis: ${emergencyResponse.data.doctorsAvailable ? 'Sim' : 'Não'}`);
        console.log(`   👨‍⚕️ Quantidade: ${emergencyResponse.data.count || 0}`);
        console.log(`   ⏱️ Tempo estimado: ${emergencyResponse.data.estimatedWaitTime || 'N/A'}`);
      } else {
        console.log('   ❌ Falha na verificação de emergência - Resposta inválida');
      }
    } catch (error) {
      console.log('   ❌ Falha na verificação de emergência:', error.response?.data?.error || error.message);
    }

    // 5. Teste de Geração de QR Code (requer autenticação)
    if (authToken) {
      console.log('\n5️⃣ Testando GERAÇÃO DE QR CODE...');
      try {
        const qrResponse = await axios.post(`${BASE_URL}/api/users/generate-qr`, {}, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (qrResponse.data && qrResponse.data.token) {
          testResults.qrGenerate = true;
          console.log('   ✅ QR Code gerado com sucesso');
          console.log(`   🔗 Token: ${qrResponse.data.token.substring(0, 20)}...`);
          
          // 6. Teste de Verificação de QR Code
          console.log('\n6️⃣ Testando VERIFICAÇÃO DE QR CODE...');
          try {
            const qrVerifyResponse = await axios.post(`${BASE_URL}/api/users/verify-qr`, {
              token: qrResponse.data.token
            });
            
            if (qrVerifyResponse.data && qrVerifyResponse.data.user) {
              testResults.qrVerify = true;
              console.log('   ✅ QR Code verificado com sucesso');
              console.log(`   👤 Usuário verificado: ${qrVerifyResponse.data.user.fullName}`);
            } else {
              console.log('   ❌ Falha na verificação do QR Code - Resposta inválida');
            }
          } catch (error) {
            console.log('   ❌ Falha na verificação do QR Code:', error.response?.data?.error || error.message);
          }
        } else {
          console.log('   ❌ Falha na geração do QR Code - Resposta inválida');
        }
      } catch (error) {
        console.log('   ❌ Falha na geração do QR Code:', error.response?.data?.error || error.message);
      }

      // 7. Teste de Perfil do Usuário
      console.log('\n7️⃣ Testando PERFIL DO USUÁRIO...');
      try {
        const profileResponse = await axios.get(`${BASE_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (profileResponse.data && profileResponse.data.user) {
          testResults.profile = true;
          console.log('   ✅ Perfil carregado com sucesso');
          console.log(`   📧 Email: ${profileResponse.data.user.email}`);
          console.log(`   👤 Nome: ${profileResponse.data.user.fullName}`);
          console.log(`   🎭 Role: ${profileResponse.data.user.role}`);
          console.log(`   📋 Plano: ${profileResponse.data.user.subscriptionPlan || 'N/A'}`);
        } else {
          console.log('   ❌ Falha ao carregar perfil - Resposta inválida');
        }
      } catch (error) {
        console.log('   ❌ Falha ao carregar perfil:', error.response?.data?.error || error.message);
      }
    } else {
      console.log('\n5️⃣ ❌ Pulando testes autenticados - Login falhou');
    }

    // Resumo dos resultados
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(60));
    
    const tests = [
      { name: 'Login', status: testResults.login },
      { name: 'Listagem de Médicos', status: testResults.doctors },
      { name: 'Listagem de Serviços', status: testResults.services },
      { name: 'Verificação de Emergência', status: testResults.emergency },
      { name: 'Geração de QR Code', status: testResults.qrGenerate },
      { name: 'Verificação de QR Code', status: testResults.qrVerify },
      { name: 'Perfil do Usuário', status: testResults.profile }
    ];

    let passedTests = 0;
    tests.forEach(test => {
      const icon = test.status ? '✅' : '❌';
      console.log(`${icon} ${test.name}`);
      if (test.status) passedTests++;
    });

    console.log('\n' + '='.repeat(60));
    console.log(`🎯 RESULTADO FINAL: ${passedTests}/${tests.length} testes passaram`);
    
    if (passedTests === tests.length) {
      console.log('🎉 TODOS OS TESTES PASSARAM! A experiência do paciente está funcionando!');
    } else {
      console.log(`⚠️  ${tests.length - passedTests} teste(s) ainda precisam ser corrigidos.`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro geral nos testes:', error.message);
  }
}

// Executar os testes
runPatientTests().catch(console.error); 