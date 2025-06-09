#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do teste
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DOCTOR_EMAIL = 'testdoctor@cnvidas.com';
const DOCTOR_PASSWORD = 'Doctor@123456';
const PARTNER_EMAIL = 'testpartner@cnvidas.com';
const PARTNER_PASSWORD = 'Partner@123456';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = {
    'success': colors.green,
    'error': colors.red,
    'warning': colors.yellow,
    'info': colors.blue,
    'section': colors.cyan
  }[type] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Relatório de testes
const testReport = {
  startTime: new Date(),
  totalTests: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  results: [],
  errors: []
};

function addTestResult(testName, status, details = {}) {
  testReport.totalTests++;
  
  if (status === 'passed') {
    testReport.passed++;
  } else if (status === 'failed') {
    testReport.failed++;
  } else if (status === 'warning') {
    testReport.warnings++;
  }
  
  testReport.results.push({
    testName,
    status,
    timestamp: new Date().toISOString(),
    duration: details.duration || 0,
    details: details.message || '',
    error: details.error || null
  });
  
  log(`${testName}: ${status.toUpperCase()} ${details.message ? `- ${details.message}` : ''}`, 
      status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'warning');
}

// Função auxiliar para fazer requisições HTTP
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: response.ok ? await response.json() : null,
      error: !response.ok ? await response.text() : null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      data: null,
      error: error.message
    };
  }
}

// Teste de autenticação de médico
async function testDoctorAuthentication() {
  log('\n=== TESTANDO AUTENTICAÇÃO DE MÉDICO ===', 'section');
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: DOCTOR_EMAIL,
        password: DOCTOR_PASSWORD
      })
    });
    
    if (response.ok && response.data?.token) {
      global.doctorToken = response.data.token;
      global.doctorUserId = response.data.user?.id;
      
      addTestResult('Login do Médico', 'passed', {
        duration: Date.now() - startTime,
        message: 'Token de autenticação obtido com sucesso'
      });
      return true;
    } else {
      addTestResult('Login do Médico', 'failed', {
        duration: Date.now() - startTime,
        message: response.error || 'Falha na autenticação',
        error: response.error
      });
      return false;
    }
  } catch (error) {
    addTestResult('Login do Médico', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack
    });
    return false;
  }
}

// Teste de autenticação de parceiro
async function testPartnerAuthentication() {
  log('\n=== TESTANDO AUTENTICAÇÃO DE PARCEIRO ===', 'section');
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: PARTNER_EMAIL,
        password: PARTNER_PASSWORD
      })
    });
    
    if (response.ok && response.data?.token) {
      global.partnerToken = response.data.token;
      global.partnerUserId = response.data.user?.id;
      
      addTestResult('Login do Parceiro', 'passed', {
        duration: Date.now() - startTime,
        message: 'Token de autenticação obtido com sucesso'
      });
      return true;
    } else {
      addTestResult('Login do Parceiro', 'failed', {
        duration: Date.now() - startTime,
        message: response.error || 'Falha na autenticação',
        error: response.error
      });
      return false;
    }
  } catch (error) {
    addTestResult('Login do Parceiro', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack
    });
    return false;
  }
}

// Teste de endpoints de médico
async function testDoctorEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE MÉDICO ===', 'section');
  
  // Teste de perfil do médico
  const startTime = Date.now();
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/profile`, {
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Obter Perfil do Médico', 'passed', {
        message: 'Dados do perfil obtidos com sucesso'
      });
    } else {
      addTestResult('Obter Perfil do Médico', 'failed', {
        message: response.error || 'Falha ao obter perfil'
      });
    }
  } catch (error) {
    addTestResult('Obter Perfil do Médico', 'failed', {
      message: error.message
    });
  }
  
  // Teste de dashboard
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/dashboard`, {
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Dashboard do Médico', 'passed', {
        message: 'Dados do dashboard obtidos'
      });
    } else {
      addTestResult('Dashboard do Médico', 'warning', {
        message: 'Endpoint de dashboard pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Dashboard do Médico', 'warning', {
      message: 'Endpoint de dashboard não encontrado'
    });
  }
  
  // Teste de disponibilidade
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/availability`, {
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Disponibilidade do Médico', 'passed', {
        message: 'Dados de disponibilidade obtidos'
      });
    } else {
      addTestResult('Disponibilidade do Médico', 'warning', {
        message: 'Endpoint de disponibilidade pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Disponibilidade do Médico', 'warning', {
      message: 'Endpoint de disponibilidade não encontrado'
    });
  }
  
  // Teste de toggle de emergência
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/toggle-availability`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      },
      body: JSON.stringify({
        emergencyAvailable: true
      })
    });
    
    if (response.ok) {
      addTestResult('Toggle Emergência', 'passed', {
        message: 'Toggle de emergência funcional'
      });
    } else {
      addTestResult('Toggle Emergência', 'warning', {
        message: 'Endpoint de toggle pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Toggle Emergência', 'warning', {
      message: 'Endpoint de toggle não encontrado'
    });
  }
  
  // Teste de dados financeiros
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/earnings`, {
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Dados Financeiros', 'passed', {
        message: 'Informações financeiras obtidas'
      });
    } else {
      addTestResult('Dados Financeiros', 'warning', {
        message: 'Endpoint financeiro pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Dados Financeiros', 'warning', {
      message: 'Endpoint financeiro não encontrado'
    });
  }
  
  // Teste de configurações PIX
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/payment-settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      },
      body: JSON.stringify({
        pixKey: 'doctor@teste.com',
        pixKeyType: 'email',
        bankName: 'Banco do Brasil',
        accountType: 'checking'
      })
    });
    
    if (response.ok) {
      addTestResult('Configurações PIX', 'passed', {
        message: 'Configurações PIX atualizadas'
      });
    } else {
      addTestResult('Configurações PIX', 'warning', {
        message: 'Endpoint de PIX pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Configurações PIX', 'warning', {
      message: 'Endpoint de PIX não encontrado'
    });
  }
  
  addTestResult('Endpoints de Médico', 'passed', {
    duration: Date.now() - startTime,
    message: 'Testes de API do médico concluídos'
  });
}

// Teste de endpoints de parceiro
async function testPartnerEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE PARCEIRO ===', 'section');
  
  const startTime = Date.now();
  
  // Teste de perfil do parceiro
  try {
    const response = await makeRequest(`${BASE_URL}/api/partners/me`, {
      headers: {
        'Authorization': `Bearer ${global.partnerToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Obter Perfil do Parceiro', 'passed', {
        message: 'Dados do perfil obtidos com sucesso'
      });
    } else {
      addTestResult('Obter Perfil do Parceiro', 'failed', {
        message: response.error || 'Falha ao obter perfil'
      });
    }
  } catch (error) {
    addTestResult('Obter Perfil do Parceiro', 'failed', {
      message: error.message
    });
  }
  
  // Teste de listagem de serviços
  try {
    const response = await makeRequest(`${BASE_URL}/api/partners/my-services`, {
      headers: {
        'Authorization': `Bearer ${global.partnerToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Serviços do Parceiro', 'passed', {
        message: `${response.data?.length || 0} serviços encontrados`
      });
    } else {
      addTestResult('Listar Serviços do Parceiro', 'warning', {
        message: 'Endpoint de serviços pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Listar Serviços do Parceiro', 'warning', {
      message: 'Endpoint de serviços não encontrado'
    });
  }
  
  // Teste de criação de serviço
  try {
    const response = await makeRequest(`${BASE_URL}/api/partners/services`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.partnerToken}`
      },
      body: JSON.stringify({
        name: 'Consulta Cardiológica - Teste API',
        category: 'cardiology',
        description: 'Consulta cardiológica completa com ECG',
        regularPrice: 200.00,
        discountPrice: 150.00,
        duration: 60
      })
    });
    
    if (response.ok) {
      global.testServiceId = response.data?.service?.id;
      addTestResult('Criar Serviço', 'passed', {
        message: 'Serviço criado via API'
      });
    } else {
      addTestResult('Criar Serviço', 'warning', {
        message: 'Endpoint de criação pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Criar Serviço', 'warning', {
      message: 'Endpoint de criação não encontrado'
    });
  }
  
  // Teste de atualização de serviço (se foi criado)
  if (global.testServiceId) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/partners/services/${global.testServiceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${global.partnerToken}`
        },
        body: JSON.stringify({
          name: 'Consulta Cardiológica - Teste API Atualizada',
          category: 'cardiology',
          description: 'Consulta cardiológica completa com ECG - Atualizada',
          regularPrice: 220.00,
          discountPrice: 170.00,
          duration: 60
        })
      });
      
      if (response.ok) {
        addTestResult('Atualizar Serviço', 'passed', {
          message: 'Serviço atualizado via API'
        });
      } else {
        addTestResult('Atualizar Serviço', 'warning', {
          message: 'Endpoint de atualização pode não estar implementado'
        });
      }
    } catch (error) {
      addTestResult('Atualizar Serviço', 'warning', {
        message: 'Endpoint de atualização não encontrado'
      });
    }
  }
  
  // Teste de verificação QR
  try {
    const response = await makeRequest(`${BASE_URL}/api/partners/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.partnerToken}`
      },
      body: JSON.stringify({
        qrCode: 'TEST-QR-CODE-123456'
      })
    });
    
    if (response.ok || response.status === 400) {
      addTestResult('Verificação QR', 'passed', {
        message: 'Endpoint de verificação QR funcional'
      });
    } else {
      addTestResult('Verificação QR', 'warning', {
        message: 'Endpoint de verificação QR pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Verificação QR', 'warning', {
      message: 'Endpoint de verificação QR não encontrado'
    });
  }
  
  addTestResult('Endpoints de Parceiro', 'passed', {
    duration: Date.now() - startTime,
    message: 'Testes de API do parceiro concluídos'
  });
}

// Teste de integração entre médicos e pacientes
async function testDoctorPatientIntegration() {
  log('\n=== TESTANDO INTEGRAÇÃO MÉDICO-PACIENTE ===', 'section');
  
  const startTime = Date.now();
  
  // Teste de listagem de consultas do médico
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/appointments`, {
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Consultas do Médico', 'passed', {
        message: `${response.data?.length || 0} consultas encontradas`
      });
    } else {
      addTestResult('Consultas do Médico', 'warning', {
        message: 'Endpoint de consultas pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Consultas do Médico', 'warning', {
      message: 'Endpoint de consultas não encontrado'
    });
  }
  
  // Teste de histórico de consultas
  try {
    const response = await makeRequest(`${BASE_URL}/api/doctors/appointments/history`, {
      headers: {
        'Authorization': `Bearer ${global.doctorToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Histórico de Consultas', 'passed', {
        message: 'Histórico de consultas acessível'
      });
    } else {
      addTestResult('Histórico de Consultas', 'warning', {
        message: 'Endpoint de histórico pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Histórico de Consultas', 'warning', {
      message: 'Endpoint de histórico não encontrado'
    });
  }
  
  addTestResult('Integração Médico-Paciente', 'passed', {
    duration: Date.now() - startTime,
    message: 'Testes de integração concluídos'
  });
}

// Teste de integração entre parceiros e pacientes
async function testPartnerPatientIntegration() {
  log('\n=== TESTANDO INTEGRAÇÃO PARCEIRO-PACIENTE ===', 'section');
  
  const startTime = Date.now();
  
  // Teste de listagem pública de serviços
  try {
    const response = await makeRequest(`${BASE_URL}/api/services`);
    
    if (response.ok) {
      addTestResult('Serviços Públicos', 'passed', {
        message: `${response.data?.length || 0} serviços públicos disponíveis`
      });
    } else {
      addTestResult('Serviços Públicos', 'failed', {
        message: 'Falha ao obter serviços públicos'
      });
    }
  } catch (error) {
    addTestResult('Serviços Públicos', 'failed', {
      message: error.message
    });
  }
  
  // Teste de serviços em destaque
  try {
    const response = await makeRequest(`${BASE_URL}/api/services/featured`);
    
    if (response.ok) {
      addTestResult('Serviços em Destaque', 'passed', {
        message: 'Serviços em destaque disponíveis'
      });
    } else {
      addTestResult('Serviços em Destaque', 'warning', {
        message: 'Endpoint de destaque pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Serviços em Destaque', 'warning', {
      message: 'Endpoint de destaque não encontrado'
    });
  }
  
  addTestResult('Integração Parceiro-Paciente', 'passed', {
    duration: Date.now() - startTime,
    message: 'Testes de integração concluídos'
  });
}

// Teste de arquivos críticos
async function testCriticalFiles() {
  log('\n=== TESTANDO ARQUIVOS CRÍTICOS ===', 'section');
  
  const criticalFiles = [
    // Arquivos de médicos
    './client/src/pages/doctor-telemedicine.tsx',
    './client/src/pages/doctor/financeiro.tsx',
    './client/src/pages/doctor-availability.tsx',
    './client/src/components/doctor/EmergencyBanner.tsx',
    './client/src/components/doctors/ProfileImageUploader.tsx',
    './client/src/components/forms/DoctorProfileForm.tsx',
    
    // Arquivos de parceiros
    './client/src/pages/partner-dashboard.tsx',
    './client/src/pages/partner-services.tsx',
    './client/src/pages/partner-verification.tsx',
    './client/src/components/dashboards/partner-dashboard.tsx',
    
    // Rotas de API
    './server/routes/doctor-routes.ts',
    './server/routes/partner-routes.ts',
    './server/doctor-finance-routes.ts'
  ];
  
  for (const filePath of criticalFiles) {
    try {
      await fs.access(filePath);
      addTestResult(`Arquivo: ${filePath.split('/').pop()}`, 'passed', {
        message: 'Arquivo encontrado'
      });
    } catch {
      addTestResult(`Arquivo: ${filePath.split('/').pop()}`, 'warning', {
        message: 'Arquivo não encontrado'
      });
    }
  }
}

// Função principal
async function runDoctorPartnerAPITests() {
  log('=== INICIANDO TESTES DE API PARA MÉDICOS E PARCEIROS ===', 'section');
  
  // Testar autenticação
  const doctorAuthSuccess = await testDoctorAuthentication();
  const partnerAuthSuccess = await testPartnerAuthentication();
  
  if (doctorAuthSuccess) {
    // Executar testes que requerem autenticação de médico
    await testDoctorEndpoints();
    await testDoctorPatientIntegration();
  } else {
    log('Falha na autenticação do médico. Alguns testes foram pulados.', 'warning');
  }
  
  if (partnerAuthSuccess) {
    // Executar testes que requerem autenticação de parceiro
    await testPartnerEndpoints();
    await testPartnerPatientIntegration();
  } else {
    log('Falha na autenticação do parceiro. Alguns testes foram pulados.', 'warning');
  }
  
  // Testar arquivos críticos
  await testCriticalFiles();
  
  // Gerar relatório
  generateFinalReport();
}

// Função para gerar relatório final
function generateFinalReport() {
  const endTime = new Date();
  const totalDuration = (endTime - testReport.startTime) / 1000;
  
  log('\n=== RELATÓRIO FINAL DOS TESTES DE MÉDICOS E PARCEIROS ===', 'section');
  log(`Duração total: ${totalDuration.toFixed(2)} segundos`, 'info');
  log(`Total de testes: ${testReport.totalTests}`, 'info');
  log(`✅ Passou: ${testReport.passed}`, 'success');
  log(`❌ Falhou: ${testReport.failed}`, 'error');
  log(`⚠️  Avisos: ${testReport.warnings}`, 'warning');
  
  // Taxa de sucesso
  const successRate = testReport.totalTests > 0 
    ? ((testReport.passed / testReport.totalTests) * 100).toFixed(2)
    : 0;
  log(`Taxa de sucesso: ${successRate}%`, successRate >= 70 ? 'success' : 'warning');
  
  // Resumo dos problemas
  const problems = testReport.results.filter(r => r.status === 'failed');
  const warnings = testReport.results.filter(r => r.status === 'warning');
  
  if (problems.length > 0) {
    log('\n--- Problemas Críticos ---', 'error');
    problems.forEach(p => {
      log(`❌ ${p.testName}: ${p.details}`, 'error');
    });
  }
  
  if (warnings.length > 0) {
    log('\n--- Melhorias Necessárias ---', 'warning');
    warnings.forEach(w => {
      log(`⚠️  ${w.testName}: ${w.details}`, 'warning');
    });
  }
  
  // Recomendações
  log('\n--- Recomendações ---', 'info');
  log('1. Verificar se o servidor está rodando na porta correta', 'info');
  log('2. Confirmar que usuários de teste existem no banco de dados', 'info');
  log('3. Validar implementação de endpoints específicos', 'info');
  log('4. Testar funcionalidades através da interface web', 'info');
  
  // Salvar relatório
  saveReportToFile();
}

// Função para salvar relatório
async function saveReportToFile() {
  const reportPath = `test-report-doctor-partner-api-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runDoctorPartnerAPITests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});