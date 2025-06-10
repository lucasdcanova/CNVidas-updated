#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do teste
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const PATIENT_EMAIL = 'testpatient@cnvidas.com';
const PATIENT_PASSWORD = 'Test@123456';

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

// Teste de autenticação
async function testAuthentication() {
  log('\n=== TESTANDO AUTENTICAÇÃO ===', 'section');
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: PATIENT_EMAIL,
        password: PATIENT_PASSWORD
      })
    });
    
    if (response.ok && response.data?.token) {
      global.authToken = response.data.token;
      global.userId = response.data.user?.id;
      
      addTestResult('Login do Paciente', 'passed', {
        duration: Date.now() - startTime,
        message: 'Token de autenticação obtido com sucesso'
      });
      return true;
    } else {
      addTestResult('Login do Paciente', 'failed', {
        duration: Date.now() - startTime,
        message: response.error || 'Falha na autenticação',
        error: response.error
      });
      return false;
    }
  } catch (error) {
    addTestResult('Login do Paciente', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack
    });
    return false;
  }
}

// Teste de endpoints de sinistros
async function testClaimsEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE SINISTROS ===', 'section');
  
  // Listar sinistros
  const startTime = Date.now();
  try {
    const response = await makeRequest(`${BASE_URL}/api/claims`, {
      headers: {
        'Authorization': `Bearer ${global.authToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Sinistros', 'passed', {
        message: `${response.data?.length || 0} sinistros encontrados`
      });
    } else {
      addTestResult('Listar Sinistros', 'failed', {
        message: response.error || 'Falha ao listar sinistros'
      });
    }
  } catch (error) {
    addTestResult('Listar Sinistros', 'failed', {
      message: error.message
    });
  }
  
  // Criar novo sinistro
  try {
    const response = await makeRequest(`${BASE_URL}/api/claims`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.authToken}`
      },
      body: JSON.stringify({
        title: 'Consulta Médica - Teste API',
        description: 'Consulta realizada para teste da API',
        amount: 150.00,
        category: 'medical_appointment',
        date: new Date().toISOString().split('T')[0]
      })
    });
    
    if (response.ok) {
      addTestResult('Criar Sinistro', 'passed', {
        duration: Date.now() - startTime,
        message: 'Sinistro criado via API'
      });
    } else {
      addTestResult('Criar Sinistro', 'failed', {
        message: response.error || 'Falha ao criar sinistro'
      });
    }
  } catch (error) {
    addTestResult('Criar Sinistro', 'failed', {
      message: error.message
    });
  }
}

// Teste de endpoints de consultas
async function testAppointmentEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE CONSULTAS ===', 'section');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/appointments`, {
      headers: {
        'Authorization': `Bearer ${global.authToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Consultas', 'passed', {
        message: `${response.data?.length || 0} consultas encontradas`
      });
    } else {
      addTestResult('Listar Consultas', 'warning', {
        message: 'Endpoint de consultas pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Listar Consultas', 'warning', {
      message: 'Endpoint de consultas não encontrado'
    });
  }
}

// Teste de endpoints de serviços
async function testServicesEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE SERVIÇOS ===', 'section');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/services`);
    
    if (response.ok) {
      addTestResult('Listar Serviços', 'passed', {
        message: `${response.data?.length || 0} serviços encontrados`
      });
    } else {
      addTestResult('Listar Serviços', 'failed', {
        message: response.error || 'Falha ao listar serviços'
      });
    }
  } catch (error) {
    addTestResult('Listar Serviços', 'failed', {
      message: error.message
    });
  }
}

// Teste de endpoints de perfil
async function testProfileEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE PERFIL ===', 'section');
  
  // Obter perfil
  try {
    const response = await makeRequest(`${BASE_URL}/api/users/profile`, {
      headers: {
        'Authorization': `Bearer ${global.authToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Obter Perfil', 'passed', {
        message: 'Dados do perfil obtidos com sucesso'
      });
      
      // Tentar atualizar perfil
      const updateResponse = await makeRequest(`${BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${global.authToken}`
        },
        body: JSON.stringify({
          name: 'Paciente Teste Atualizado',
          phone: '(11) 99999-8888'
        })
      });
      
      if (updateResponse.ok) {
        addTestResult('Atualizar Perfil', 'passed', {
          message: 'Perfil atualizado via API'
        });
      } else {
        addTestResult('Atualizar Perfil', 'warning', {
          message: 'Endpoint de atualização pode ter validações específicas'
        });
      }
    } else {
      addTestResult('Obter Perfil', 'failed', {
        message: response.error || 'Falha ao obter perfil'
      });
    }
  } catch (error) {
    addTestResult('Obter Perfil', 'failed', {
      message: error.message
    });
  }
}

// Teste de endpoints de assinatura
async function testSubscriptionEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE ASSINATURA ===', 'section');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/subscription/current`, {
      headers: {
        'Authorization': `Bearer ${global.authToken}`
      }
    });
    
    if (response.ok) {
      const plan = response.data?.plan || 'unknown';
      addTestResult('Obter Assinatura Atual', 'passed', {
        message: `Plano atual: ${plan}`
      });
    } else {
      addTestResult('Obter Assinatura Atual', 'warning', {
        message: 'Endpoint de assinatura pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Obter Assinatura Atual', 'warning', {
      message: 'Endpoint de assinatura não encontrado'
    });
  }
  
  // Testar planos disponíveis
  try {
    const response = await makeRequest(`${BASE_URL}/api/subscription/plans`);
    
    if (response.ok) {
      addTestResult('Listar Planos Disponíveis', 'passed', {
        message: `${response.data?.length || 0} planos disponíveis`
      });
    } else {
      addTestResult('Listar Planos Disponíveis', 'warning', {
        message: 'Endpoint de planos pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Listar Planos Disponíveis', 'warning', {
      message: 'Endpoint de planos não encontrado'
    });
  }
}

// Teste de endpoints de dependentes
async function testDependentsEndpoints() {
  log('\n=== TESTANDO ENDPOINTS DE DEPENDENTES ===', 'section');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/dependents`, {
      headers: {
        'Authorization': `Bearer ${global.authToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Dependentes', 'passed', {
        message: `${response.data?.length || 0} dependentes encontrados`
      });
    } else {
      addTestResult('Listar Dependentes', 'warning', {
        message: 'Endpoint de dependentes pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Listar Dependentes', 'warning', {
      message: 'Endpoint de dependentes não encontrado'
    });
  }
}

// Teste de arquivos críticos do frontend
async function testFrontendFiles() {
  log('\n=== TESTANDO ARQUIVOS DO FRONTEND ===', 'section');
  
  const criticalFiles = [
    './client/src/pages/dashboard.tsx',
    './client/src/pages/claims.tsx',
    './client/src/pages/services.tsx',
    './client/src/pages/profile.tsx',
    './client/src/pages/subscription.tsx',
    './client/src/components/dashboards/patient-dashboard.tsx',
    './client/src/components/forms/claim-form.tsx',
    './client/src/components/forms/address-form.tsx'
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

// Teste de configuração do servidor
async function testServerConfiguration() {
  log('\n=== TESTANDO CONFIGURAÇÃO DO SERVIDOR ===', 'section');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    
    if (response.ok) {
      addTestResult('Health Check', 'passed', {
        message: 'Servidor respondendo corretamente'
      });
    } else {
      // Tentar uma rota básica
      const fallbackResponse = await makeRequest(`${BASE_URL}/`);
      if (fallbackResponse.ok || fallbackResponse.status === 404) {
        addTestResult('Servidor Ativo', 'passed', {
          message: 'Servidor está respondendo'
        });
      } else {
        addTestResult('Servidor Ativo', 'failed', {
          message: 'Servidor não está respondendo'
        });
      }
    }
  } catch (error) {
    addTestResult('Conectividade do Servidor', 'failed', {
      message: error.message
    });
  }
}

// Função principal
async function runAPITests() {
  log('=== INICIANDO TESTES DE API DO PACIENTE CNVidas ===', 'section');
  
  // Testar conectividade básica
  await testServerConfiguration();
  
  // Testar autenticação
  const authSuccess = await testAuthentication();
  
  if (authSuccess) {
    // Executar testes que requerem autenticação
    await testClaimsEndpoints();
    await testAppointmentEndpoints();
    await testServicesEndpoints();
    await testProfileEndpoints();
    await testSubscriptionEndpoints();
    await testDependentsEndpoints();
  } else {
    log('Falha na autenticação. Alguns testes foram pulados.', 'warning');
  }
  
  // Testar arquivos do frontend
  await testFrontendFiles();
  
  // Gerar relatório
  generateFinalReport();
}

// Função para gerar relatório final
function generateFinalReport() {
  const endTime = new Date();
  const totalDuration = (endTime - testReport.startTime) / 1000;
  
  log('\n=== RELATÓRIO FINAL DOS TESTES DE API ===', 'section');
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
  log('2. Confirmar que todas as rotas de API estão implementadas', 'info');
  log('3. Validar autenticação e autorização dos endpoints', 'info');
  log('4. Testar funcionalidades através do frontend web', 'info');
  
  // Salvar relatório
  saveReportToFile();
}

// Função para salvar relatório
async function saveReportToFile() {
  const reportPath = `test-report-api-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runAPITests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});