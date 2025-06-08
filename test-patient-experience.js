import dotenv from 'dotenv';
import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { doctors, users, services, appointments, doctorAvailability } from './shared/schema.js';
import { eq, and, gte } from 'drizzle-orm';

dotenv.config();

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
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}`, 'x-auth-token': token })
    },
    ...(data && { body: JSON.stringify(data) })
  };

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");
    let responseData;
    
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      data: responseData
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
    
    // Verificar médicos no banco diretamente
    const doctorsInDb = await db.select({
      doctor: doctors,
      user: users
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id));
    
    log(`Médicos no banco de dados: ${doctorsInDb.length}`, 'blue');
    
    // Testar endpoint de listagem
    const doctorsResponse = await apiRequest('GET', '/api/doctors', null, authToken);
    
    if (doctorsResponse.ok) {
      const doctorsList = Array.isArray(doctorsResponse.data) ? doctorsResponse.data : [];
      recordTest(doctorsList.length > 0, 'Listagem de médicos', `${doctorsList.length} médicos encontrados`);
      
      if (doctorsList.length === 0 && doctorsInDb.length > 0) {
        logWarning('Existem médicos no banco mas não estão sendo retornados pela API');
        testResults.warnings.push('API não retorna médicos existentes');
      }
    } else {
      recordTest(false, 'Endpoint de listagem de médicos', doctorsResponse.error || 'Erro na API');
    }

    // 3. MÉDICOS DISPONÍVEIS PARA EMERGÊNCIA
    logSection('3. TESTE DE MÉDICOS DE EMERGÊNCIA');
    
    // Verificar disponibilidade no banco
    const now = new Date();
    const availableDoctorsInDb = await db.select({
      availability: doctorAvailability,
      doctor: doctors,
      user: users
    })
    .from(doctorAvailability)
    .innerJoin(doctors, eq(doctorAvailability.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(
      and(
        eq(doctorAvailability.isAvailable, true),
        eq(doctorAvailability.dayOfWeek, now.getDay()),
        gte(doctorAvailability.endTime, now.toTimeString().slice(0, 8))
      )
    );
    
    log(`Médicos disponíveis no banco: ${availableDoctorsInDb.length}`, 'blue');
    
    // Testar endpoint
    const emergencyCheckResponse = await apiRequest('GET', '/api/emergency/patient/check-doctors', null, authToken);
    
    if (emergencyCheckResponse.ok) {
      const available = emergencyCheckResponse.data.doctorsAvailable;
      const count = emergencyCheckResponse.data.count;
      recordTest(available, 'Verificação de médicos de emergência', `${count} médicos disponíveis`);
      
      if (!available && availableDoctorsInDb.length > 0) {
        logWarning('Existem médicos disponíveis no banco mas não estão sendo retornados');
        testResults.warnings.push('Médicos de emergência não detectados pela API');
      }
    } else {
      recordTest(false, 'Endpoint de médicos de emergência', emergencyCheckResponse.error || 'Erro na API');
    }

    // 4. LISTAGEM DE SERVIÇOS
    logSection('4. TESTE DE LISTAGEM DE SERVIÇOS');
    
    // Verificar serviços no banco
    const servicesInDb = await db.select().from(services);
    log(`Serviços no banco de dados: ${servicesInDb.length}`, 'blue');
    
    // Testar endpoint
    const servicesResponse = await apiRequest('GET', '/api/services', null, authToken);
    
    if (servicesResponse.ok) {
      const servicesList = Array.isArray(servicesResponse.data) ? servicesResponse.data : [];
      recordTest(servicesList.length > 0, 'Listagem de serviços', `${servicesList.length} serviços encontrados`);
      
      if (servicesList.length === 0 && servicesInDb.length > 0) {
        logWarning('Existem serviços no banco mas não estão sendo retornados');
        testResults.warnings.push('Serviços não retornados pela API');
      }
    } else {
      recordTest(false, 'Endpoint de serviços', servicesResponse.error || 'Erro na API');
    }

    // 5. GERAÇÃO DE QR CODE
    logSection('5. TESTE DE QR CODE');
    
    const qrResponse = await apiRequest('GET', '/api/qr/generate', null, authToken);
    
    if (qrResponse.ok) {
      recordTest(!!qrResponse.data.qrCode, 'Geração de QR Code', 
        qrResponse.data.qrCode ? 'QR Code gerado com sucesso' : 'QR Code vazio');
    } else {
      recordTest(false, 'Endpoint de QR Code', qrResponse.error || qrResponse.data.error || 'Erro na API');
    }

    // 6. MÉTODOS DE PAGAMENTO
    logSection('6. TESTE DE MÉTODOS DE PAGAMENTO');
    
    // Verificar listagem
    const paymentMethodsResponse = await apiRequest('GET', '/api/payments/methods', null, authToken);
    
    if (paymentMethodsResponse.ok) {
      const methods = Array.isArray(paymentMethodsResponse.data) ? paymentMethodsResponse.data : [];
      recordTest(true, 'Listagem de métodos de pagamento', `${methods.length} métodos encontrados`);
    } else {
      recordTest(false, 'Listagem de métodos de pagamento', paymentMethodsResponse.error || 'Erro na API');
    }

    // 7. PLANOS DE ASSINATURA
    logSection('7. TESTE DE PLANOS DE ASSINATURA');
    
    // Verificar plano atual
    const currentPlanResponse = await apiRequest('GET', '/api/subscription/current', null, authToken);
    
    if (currentPlanResponse.ok) {
      recordTest(true, 'Verificação de plano atual', 
        `Plano: ${currentPlanResponse.data.plan || 'Nenhum'}`);
    } else {
      recordTest(false, 'Verificação de plano atual', currentPlanResponse.error || 'Erro na API');
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
        recordTest(false, 'Atualização de perfil', updateResponse.error || 'Erro na API');
      }
    } else {
      recordTest(false, 'Busca de perfil', profileResponse.error || 'Erro na API');
    }

    // 9. CONSULTAS DO PACIENTE
    logSection('9. TESTE DE CONSULTAS DO PACIENTE');
    
    const appointmentsResponse = await apiRequest('GET', '/api/appointments', null, authToken);
    
    if (appointmentsResponse.ok) {
      const appointmentsList = Array.isArray(appointmentsResponse.data) ? appointmentsResponse.data : [];
      recordTest(true, 'Listagem de consultas', `${appointmentsList.length} consultas encontradas`);
    } else {
      recordTest(false, 'Listagem de consultas', appointmentsResponse.error || 'Erro na API');
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

    // DIAGNÓSTICO ADICIONAL
    if (testResults.failed > 0 || testResults.warnings.length > 0) {
      logSection('DIAGNÓSTICO ADICIONAL');
      
      // Verificar configurações do banco
      const doctorCount = await db.select({ count: count() }).from(doctors);
      const serviceCount = await db.select({ count: count() }).from(services);
      const userCount = await db.select({ count: count() }).from(users);
      
      log('Contadores do banco de dados:', 'blue');
      log(`- Usuários: ${userCount[0].count}`);
      log(`- Médicos: ${doctorCount[0].count}`);
      log(`- Serviços: ${serviceCount[0].count}`);
      
      // Sugestões de correção
      log('\nSugestões de correção:', 'magenta');
      
      if (doctorCount[0].count === 0) {
        log('1. Criar médicos de teste no banco de dados');
      }
      
      if (serviceCount[0].count === 0) {
        log('2. Criar serviços no banco de dados');
      }
      
      log('3. Verificar as rotas da API e middleware de autenticação');
      log('4. Verificar se os endpoints estão retornando os dados corretos');
      log('5. Revisar a lógica de disponibilidade de médicos de emergência');
      log('6. Verificar a implementação do QR Code');
      log('7. Revisar o processo de atualização de perfil');
    }

  } catch (error) {
    logError('Erro durante os testes', error.message);
    console.error(error);
  } finally {
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

// Executar testes
runTests().catch(console.error); 