require('dotenv').config();
const axios = require('axios');

const TEST_EMAIL = 'patient-test@example.com';
const TEST_PASSWORD = 'test123';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(test, details = '') {
  log(`✅ ${test}${details ? ': ' + details : ''}`, 'green');
}

function logError(test, error) {
  log(`❌ ${test}: ${error}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Função para fazer requisições à API
async function apiRequest(method, endpoint, data = null, token = null) {
  const url = `http://localhost:3000${endpoint}`;
  const config = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}`, 'x-auth-token': token })
    },
    ...(data && { data }),
    validateStatus: () => true // Não lançar erro em status HTTP
  };

  try {
    const response = await axios(config);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message
    };
  }
}

// Testes principais
async function runTests() {
  let authToken = null;
  let userId = null;
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: []
  };

  function recordTest(passed, testName, details) {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      logSuccess(testName, details);
    } else {
      testResults.failed++;
      logError(testName, details);
    }
  }

  try {
    // 1. LOGIN DO PACIENTE
    logSection('1. TESTE DE LOGIN DO PACIENTE');
    
    const loginResponse = await apiRequest('POST', '/api/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (loginResponse.ok && loginResponse.data.token) {
      authToken = loginResponse.data.token;
      userId = loginResponse.data.user.id;
      recordTest(true, 'Login do paciente', `UserId: ${userId}`);
    } else {
      recordTest(false, 'Login do paciente', loginResponse.data.message || 'Falha no login');
      // Tentar criar o usuário de teste
      log('Tentando criar usuário de teste...', 'yellow');
      const signupResponse = await apiRequest('POST', '/api/auth/signup', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        role: 'patient',
        fullName: 'Paciente Teste'
      });
      
      if (signupResponse.ok) {
        authToken = signupResponse.data.token;
        userId = signupResponse.data.user.id;
        recordTest(true, 'Criação de usuário de teste', `UserId: ${userId}`);
      }
    }

    if (!authToken) {
      log('Não foi possível autenticar. Abortando testes.', 'red');
      return;
    }

    // 2. LISTAGEM DE MÉDICOS
    logSection('2. TESTE DE LISTAGEM DE MÉDICOS');
    
    // Testar endpoint de listagem
    const doctorsResponse = await apiRequest('GET', '/api/doctors', null, authToken);
    
    if (doctorsResponse.ok) {
      const doctorsList = Array.isArray(doctorsResponse.data) ? doctorsResponse.data : [];
      recordTest(doctorsList.length > 0, 'Listagem de médicos', `${doctorsList.length} médicos encontrados`);
      
      if (doctorsList.length === 0) {
        testResults.warnings.push('Nenhum médico cadastrado no sistema');
      }
    } else {
      recordTest(false, 'Endpoint de listagem de médicos', 
        doctorsResponse.error || doctorsResponse.data?.error || 'Erro na API');
    }

    // 3. MÉDICOS DISPONÍVEIS PARA EMERGÊNCIA
    logSection('3. TESTE DE MÉDICOS DE EMERGÊNCIA');
    
    // Testar endpoint
    const emergencyCheckResponse = await apiRequest('GET', '/api/emergency/patient/check-doctors', null, authToken);
    
    if (emergencyCheckResponse.ok) {
      const available = emergencyCheckResponse.data.doctorsAvailable;
      const count = emergencyCheckResponse.data.count;
      recordTest(available, 'Verificação de médicos de emergência', `${count} médicos disponíveis`);
      
      if (!available) {
        testResults.warnings.push('Nenhum médico disponível para emergência');
      }
    } else {
      recordTest(false, 'Endpoint de médicos de emergência', 
        emergencyCheckResponse.error || emergencyCheckResponse.data?.error || 'Erro na API');
    }

    // 4. LISTAGEM DE SERVIÇOS
    logSection('4. TESTE DE LISTAGEM DE SERVIÇOS');
    
    // Testar endpoint
    const servicesResponse = await apiRequest('GET', '/api/services', null, authToken);
    
    if (servicesResponse.ok) {
      const servicesList = Array.isArray(servicesResponse.data) ? servicesResponse.data : [];
      recordTest(servicesList.length > 0, 'Listagem de serviços', `${servicesList.length} serviços encontrados`);
      
      if (servicesList.length === 0) {
        testResults.warnings.push('Nenhum serviço cadastrado no sistema');
      }
    } else {
      recordTest(false, 'Endpoint de serviços', 
        servicesResponse.error || servicesResponse.data?.error || 'Erro na API');
    }

    // 5. GERAÇÃO DE QR CODE
    logSection('5. TESTE DE QR CODE');
    
    const qrResponse = await apiRequest('GET', '/api/qr/generate', null, authToken);
    
    if (qrResponse.ok) {
      recordTest(!!qrResponse.data.qrCode, 'Geração de QR Code', 
        qrResponse.data.qrCode ? 'QR Code gerado com sucesso' : 'QR Code vazio');
    } else {
      recordTest(false, 'Endpoint de QR Code', 
        qrResponse.error || qrResponse.data?.error || 'Erro na API');
    }

    // 6. MÉTODOS DE PAGAMENTO
    logSection('6. TESTE DE MÉTODOS DE PAGAMENTO');
    
    // Verificar listagem
    const paymentMethodsResponse = await apiRequest('GET', '/api/payments/methods', null, authToken);
    
    if (paymentMethodsResponse.ok) {
      const methods = Array.isArray(paymentMethodsResponse.data) ? paymentMethodsResponse.data : [];
      recordTest(true, 'Listagem de métodos de pagamento', `${methods.length} métodos encontrados`);
    } else {
      recordTest(false, 'Listagem de métodos de pagamento', 
        paymentMethodsResponse.error || paymentMethodsResponse.data?.error || 'Erro na API');
    }

    // 7. PLANOS DE ASSINATURA
    logSection('7. TESTE DE PLANOS DE ASSINATURA');
    
    // Verificar plano atual
    const currentPlanResponse = await apiRequest('GET', '/api/subscription/current', null, authToken);
    
    if (currentPlanResponse.ok) {
      recordTest(true, 'Verificação de plano atual', 
        `Plano: ${currentPlanResponse.data.plan || 'Nenhum'}`);
    } else {
      recordTest(false, 'Verificação de plano atual', 
        currentPlanResponse.error || currentPlanResponse.data?.error || 'Erro na API');
    }

    // 8. ATUALIZAÇÃO DE PERFIL
    logSection('8. TESTE DE ATUALIZAÇÃO DE PERFIL');
    
    // Buscar perfil atual
    const profileResponse = await apiRequest('GET', '/api/user/profile', null, authToken);
    
    if (profileResponse.ok) {
      recordTest(true, 'Busca de perfil', `Nome: ${profileResponse.data.fullName || 'Não definido'}`);
      
      // Tentar atualizar
      const updateData = {
        fullName: 'Paciente Teste Atualizado',
        phone: '11999999999'
      };
      
      const updateResponse = await apiRequest('PUT', '/api/user/profile', updateData, authToken);
      
      if (updateResponse.ok) {
        // Verificar se foi salvo
        const verifyResponse = await apiRequest('GET', '/api/user/profile', null, authToken);
        const updated = verifyResponse.ok && verifyResponse.data.fullName === updateData.fullName;
        recordTest(updated, 'Atualização de perfil', 
          updated ? 'Perfil atualizado com sucesso' : 'Alterações não foram salvas');
        
        if (!updated) {
          testResults.warnings.push('Perfil não está sendo salvo corretamente');
        }
      } else {
        recordTest(false, 'Atualização de perfil', 
          updateResponse.error || updateResponse.data?.error || 'Erro na API');
      }
    } else {
      recordTest(false, 'Busca de perfil', 
        profileResponse.error || profileResponse.data?.error || 'Erro na API');
    }

    // 9. CONSULTAS DO PACIENTE
    logSection('9. TESTE DE CONSULTAS DO PACIENTE');
    
    const appointmentsResponse = await apiRequest('GET', '/api/appointments', null, authToken);
    
    if (appointmentsResponse.ok) {
      const appointmentsList = Array.isArray(appointmentsResponse.data) ? appointmentsResponse.data : [];
      recordTest(true, 'Listagem de consultas', `${appointmentsList.length} consultas encontradas`);
    } else {
      recordTest(false, 'Listagem de consultas', 
        appointmentsResponse.error || appointmentsResponse.data?.error || 'Erro na API');
    }

    // RESUMO DOS TESTES
    logSection('RESUMO DOS TESTES');
    log(`Total de testes: ${testResults.total}`, 'blue');
    logSuccess(`Testes aprovados: ${testResults.passed}`);
    if (testResults.failed > 0) {
      logError(`Testes falhados: ${testResults.failed}`);
    }
    
    if (testResults.warnings.length > 0) {
      log('\nAvisos importantes:', 'yellow');
      testResults.warnings.forEach(warning => {
        logWarning(warning);
      });
    }

    // DIAGNÓSTICO E SOLUÇÕES
    if (testResults.failed > 0 || testResults.warnings.length > 0) {
      logSection('DIAGNÓSTICO E SOLUÇÕES PROPOSTAS');
      
      log('\nProblemas identificados e soluções:', 'magenta');
      
      // Análise específica de cada problema
      if (testResults.warnings.includes('Nenhum médico cadastrado no sistema')) {
        log('\n📌 PROBLEMA: Nenhum médico cadastrado', 'yellow');
        log('   SOLUÇÃO: Criar script para popular médicos de teste no banco', 'cyan');
      }
      
      if (testResults.warnings.includes('Nenhum médico disponível para emergência')) {
        log('\n📌 PROBLEMA: Médicos não disponíveis para emergência', 'yellow');
        log('   SOLUÇÃO: Configurar availabilitySlots para médicos existentes', 'cyan');
      }
      
      if (testResults.warnings.includes('Nenhum serviço cadastrado no sistema')) {
        log('\n📌 PROBLEMA: Nenhum serviço cadastrado', 'yellow');
        log('   SOLUÇÃO: Criar serviços de parceiros no banco', 'cyan');
      }
      
      if (testResults.warnings.includes('Perfil não está sendo salvo corretamente')) {
        log('\n📌 PROBLEMA: Atualização de perfil não persiste', 'yellow');
        log('   SOLUÇÃO: Verificar endpoint PUT /api/user/profile', 'cyan');
      }
      
      // Plano de ação
      log('\n📋 PLANO DE AÇÃO:', 'magenta');
      log('1. Criar dados de teste (médicos, serviços, disponibilidade)');
      log('2. Verificar e corrigir endpoints que retornam erro');
      log('3. Implementar QR Code se não existir');
      log('4. Revisar lógica de atualização de perfil');
      log('5. Verificar integração com Stripe para pagamentos');
    }

  } catch (error) {
    logError('Erro durante os testes', error.message);
    console.error(error);
  } finally {
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

// Aguardar um segundo para garantir que o servidor está pronto
setTimeout(() => {
  runTests().catch(console.error);
}, 1000); 