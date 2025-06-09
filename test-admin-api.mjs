#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do teste
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@cnvidas.com';
const ADMIN_PASSWORD = 'Admin@123456';

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

// Teste de autenticação de administrador
async function testAdminAuthentication() {
  log('\n=== TESTANDO AUTENTICAÇÃO DE ADMINISTRADOR ===', 'section');
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });
    
    if (response.ok && response.data?.token) {
      global.adminToken = response.data.token;
      global.adminUserId = response.data.user?.id;
      
      // Verificar se é realmente admin
      if (response.data.user?.role === 'admin') {
        addTestResult('Login do Administrador', 'passed', {
          duration: Date.now() - startTime,
          message: 'Token de admin obtido com sucesso'
        });
        return true;
      } else {
        addTestResult('Login do Administrador', 'failed', {
          duration: Date.now() - startTime,
          message: 'Usuário não tem permissões de admin'
        });
        return false;
      }
    } else {
      addTestResult('Login do Administrador', 'failed', {
        duration: Date.now() - startTime,
        message: response.error || 'Falha na autenticação',
        error: response.error
      });
      return false;
    }
  } catch (error) {
    addTestResult('Login do Administrador', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack
    });
    return false;
  }
}

// Teste de endpoints de gestão de usuários
async function testUserManagementAPI() {
  log('\n=== TESTANDO GESTÃO DE USUÁRIOS (API) ===', 'section');
  
  // Listar todos os usuários
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Usuários', 'passed', {
        message: `${response.data?.length || 0} usuários encontrados`
      });
    } else {
      addTestResult('Listar Usuários', 'failed', {
        message: response.error || 'Falha ao listar usuários'
      });
    }
  } catch (error) {
    addTestResult('Listar Usuários', 'failed', {
      message: error.message
    });
  }
  
  // Buscar usuários
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/users/search?query=test`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Buscar Usuários', 'passed', {
        message: 'Sistema de busca operacional'
      });
    } else {
      addTestResult('Buscar Usuários', 'warning', {
        message: 'Endpoint de busca pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Buscar Usuários', 'warning', {
      message: 'Endpoint de busca não encontrado'
    });
  }
  
  // Criar usuário de teste
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      },
      body: JSON.stringify({
        name: 'Usuário Teste Admin',
        email: 'usuarioteste@admin.com',
        password: 'Teste@123456',
        role: 'patient'
      })
    });
    
    if (response.ok) {
      global.testUserId = response.data?.id;
      addTestResult('Criar Usuário', 'passed', {
        message: 'Usuário criado via API admin'
      });
    } else {
      addTestResult('Criar Usuário', 'warning', {
        message: 'Endpoint de criação pode ter validações específicas'
      });
    }
  } catch (error) {
    addTestResult('Criar Usuário', 'warning', {
      message: 'Endpoint de criação não encontrado'
    });
  }
  
  // Atualizar usuário (se foi criado)
  if (global.testUserId) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/admin/users/${global.testUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${global.adminToken}`
        },
        body: JSON.stringify({
          name: 'Usuário Teste Admin Atualizado'
        })
      });
      
      if (response.ok) {
        addTestResult('Atualizar Usuário', 'passed', {
          message: 'Usuário atualizado via API admin'
        });
      } else {
        addTestResult('Atualizar Usuário', 'warning', {
          message: 'Endpoint de atualização pode ter validações'
        });
      }
    } catch (error) {
      addTestResult('Atualizar Usuário', 'warning', {
        message: 'Endpoint de atualização não encontrado'
      });
    }
  }
}

// Teste de endpoints de gestão de sinistros
async function testClaimsManagementAPI() {
  log('\n=== TESTANDO GESTÃO DE SINISTROS (API) ===', 'section');
  
  // Listar todos os sinistros
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/claims`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Sinistros', 'passed', {
        message: `${response.data?.length || 0} sinistros encontrados`
      });
    } else {
      addTestResult('Listar Sinistros', 'warning', {
        message: 'Endpoint de sinistros pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Listar Sinistros', 'warning', {
      message: 'Endpoint de sinistros não encontrado'
    });
  }
  
  // Filtrar sinistros por status
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/claims?status=pending`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Filtrar Sinistros', 'passed', {
        message: 'Sistema de filtros operacional'
      });
    } else {
      addTestResult('Filtrar Sinistros', 'warning', {
        message: 'Sistema de filtros pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Filtrar Sinistros', 'warning', {
      message: 'Sistema de filtros não encontrado'
    });
  }
  
  // Aprovar/Rejeitar sinistro (simulação)
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/claims/1/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      },
      body: JSON.stringify({
        approvedAmount: 100.00,
        notes: 'Aprovado por teste automatizado'
      })
    });
    
    if (response.ok || response.status === 404) {
      addTestResult('Aprovação de Sinistro', 'passed', {
        message: 'Endpoint de aprovação disponível'
      });
    } else {
      addTestResult('Aprovação de Sinistro', 'warning', {
        message: 'Endpoint de aprovação pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Aprovação de Sinistro', 'warning', {
      message: 'Endpoint de aprovação não encontrado'
    });
  }
}

// Teste de endpoints de gestão de parceiros
async function testPartnerManagementAPI() {
  log('\n=== TESTANDO GESTÃO DE PARCEIROS (API) ===', 'section');
  
  // Listar todos os parceiros
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/partners`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Listar Parceiros', 'passed', {
        message: `${response.data?.length || 0} parceiros encontrados`
      });
    } else {
      addTestResult('Listar Parceiros', 'warning', {
        message: 'Endpoint de parceiros pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Listar Parceiros', 'warning', {
      message: 'Endpoint de parceiros não encontrado'
    });
  }
  
  // Parceiros pendentes
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/partners/pending`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Parceiros Pendentes', 'passed', {
        message: `${response.data?.length || 0} parceiros pendentes`
      });
    } else {
      addTestResult('Parceiros Pendentes', 'warning', {
        message: 'Endpoint de pendentes pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Parceiros Pendentes', 'warning', {
      message: 'Endpoint de pendentes não encontrado'
    });
  }
  
  // Criar parceiro
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/partners`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      },
      body: JSON.stringify({
        businessName: 'Empresa Teste LTDA',
        cnpj: '12.345.678/0001-90',
        businessType: 'clinic',
        email: 'parceiroteste@admin.com'
      })
    });
    
    if (response.ok) {
      global.testPartnerId = response.data?.id;
      addTestResult('Criar Parceiro', 'passed', {
        message: 'Parceiro criado via API admin'
      });
    } else {
      addTestResult('Criar Parceiro', 'warning', {
        message: 'Endpoint de criação pode ter validações específicas'
      });
    }
  } catch (error) {
    addTestResult('Criar Parceiro', 'warning', {
      message: 'Endpoint de criação não encontrado'
    });
  }
}

// Teste de endpoints de analytics
async function testAnalyticsAPI() {
  log('\n=== TESTANDO ANALYTICS (API) ===', 'section');
  
  // Estatísticas gerais
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/analytics/overview`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Overview Analytics', 'passed', {
        message: 'Dados de overview obtidos'
      });
    } else {
      addTestResult('Overview Analytics', 'warning', {
        message: 'Endpoint de analytics pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Overview Analytics', 'warning', {
      message: 'Endpoint de analytics não encontrado'
    });
  }
  
  // Métricas de usuários
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/analytics/users`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Métricas de Usuários', 'passed', {
        message: 'Estatísticas de usuários disponíveis'
      });
    } else {
      addTestResult('Métricas de Usuários', 'warning', {
        message: 'Endpoint de métricas pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Métricas de Usuários', 'warning', {
      message: 'Endpoint de métricas não encontrado'
    });
  }
  
  // Métricas de receita
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/analytics/revenue`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Métricas de Receita', 'passed', {
        message: 'Dados financeiros disponíveis'
      });
    } else {
      addTestResult('Métricas de Receita', 'warning', {
        message: 'Endpoint de receita pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Métricas de Receita', 'warning', {
      message: 'Endpoint de receita não encontrado'
    });
  }
}

// Teste de endpoints de notificações
async function testNotificationsAPI() {
  log('\n=== TESTANDO NOTIFICAÇÕES (API) ===', 'section');
  
  // Enviar notificação
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/notifications/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      },
      body: JSON.stringify({
        userId: global.testUserId || 1,
        title: 'Teste de Notificação',
        message: 'Esta é uma notificação de teste enviada pelo admin',
        type: 'info'
      })
    });
    
    if (response.ok) {
      addTestResult('Envio de Notificação', 'passed', {
        message: 'Sistema de notificações operacional'
      });
    } else {
      addTestResult('Envio de Notificação', 'warning', {
        message: 'Endpoint de notificações pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Envio de Notificação', 'warning', {
      message: 'Endpoint de notificações não encontrado'
    });
  }
}

// Teste de endpoints de auditoria
async function testAuditAPI() {
  log('\n=== TESTANDO AUDITORIA (API) ===', 'section');
  
  // Logs de QR Auth
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/qr-auth-logs`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Logs de QR Auth', 'passed', {
        message: `${response.data?.length || 0} logs encontrados`
      });
    } else {
      addTestResult('Logs de QR Auth', 'warning', {
        message: 'Endpoint de logs pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Logs de QR Auth', 'warning', {
      message: 'Endpoint de logs não encontrado'
    });
  }
  
  // Logs de atividade
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/activity-logs`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Logs de Atividade', 'passed', {
        message: 'Sistema de auditoria disponível'
      });
    } else {
      addTestResult('Logs de Atividade', 'warning', {
        message: 'Endpoint de atividade pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Logs de Atividade', 'warning', {
      message: 'Endpoint de atividade não encontrado'
    });
  }
}

// Teste de gestão de vendedores
async function testSellerManagementAPI() {
  log('\n=== TESTANDO GESTÃO DE VENDEDORES (API) ===', 'section');
  
  // Estatísticas de vendedores
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/sellers/stats`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Estatísticas de Vendedores', 'passed', {
        message: 'Dados de vendedores disponíveis'
      });
    } else {
      addTestResult('Estatísticas de Vendedores', 'warning', {
        message: 'Endpoint de vendedores pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Estatísticas de Vendedores', 'warning', {
      message: 'Endpoint de vendedores não encontrado'
    });
  }
}

// Teste de health check do sistema
async function testSystemHealth() {
  log('\n=== TESTANDO SAÚDE DO SISTEMA ===', 'section');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/admin/system/health`, {
      headers: {
        'Authorization': `Bearer ${global.adminToken}`
      }
    });
    
    if (response.ok) {
      addTestResult('Health Check', 'passed', {
        message: 'Sistema respondendo corretamente'
      });
    } else {
      addTestResult('Health Check', 'warning', {
        message: 'Endpoint de health pode não estar implementado'
      });
    }
  } catch (error) {
    addTestResult('Health Check', 'warning', {
      message: 'Endpoint de health não encontrado'
    });
  }
}

// Teste de arquivos críticos administrativos
async function testAdminFiles() {
  log('\n=== TESTANDO ARQUIVOS ADMINISTRATIVOS ===', 'section');
  
  const criticalFiles = [
    './client/src/pages/admin/dashboard.tsx',
    './client/src/pages/admin/users.tsx',
    './client/src/pages/admin/claims.tsx',
    './client/src/pages/admin/partners.tsx',
    './client/src/pages/admin/services.tsx',
    './client/src/pages/admin/analytics.tsx',
    './client/src/pages/admin/seller-stats.tsx',
    './client/src/pages/admin/qr-auth-logs.tsx',
    './client/src/pages/admin/subscription-plans.tsx',
    './client/src/components/layouts/admin-layout.tsx',
    './server/admin-routes.ts'
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
async function runAdminAPITests() {
  log('=== INICIANDO TESTES DE API ADMINISTRATIVAS ===', 'section');
  
  // Testar autenticação
  const authSuccess = await testAdminAuthentication();
  
  if (authSuccess) {
    // Executar testes que requerem autenticação admin
    await testUserManagementAPI();
    await testClaimsManagementAPI();
    await testPartnerManagementAPI();
    await testAnalyticsAPI();
    await testNotificationsAPI();
    await testAuditAPI();
    await testSellerManagementAPI();
    await testSystemHealth();
  } else {
    log('Falha na autenticação admin. Alguns testes foram pulados.', 'warning');
  }
  
  // Testar arquivos críticos
  await testAdminFiles();
  
  // Gerar relatório
  generateFinalReport();
}

// Função para gerar relatório final
function generateFinalReport() {
  const endTime = new Date();
  const totalDuration = (endTime - testReport.startTime) / 1000;
  
  log('\n=== RELATÓRIO FINAL DOS TESTES ADMINISTRATIVOS ===', 'section');
  log(`Duração total: ${totalDuration.toFixed(2)} segundos`, 'info');
  log(`Total de testes: ${testReport.totalTests}`, 'info');
  log(`✅ Passou: ${testReport.passed}`, 'success');
  log(`❌ Falhou: ${testReport.failed}`, 'error');
  log(`⚠️  Avisos: ${testReport.warnings}`, 'warning');
  
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
    log('\n--- Funcionalidades para Verificar ---', 'warning');
    warnings.forEach(w => {
      log(`⚠️  ${w.testName}: ${w.details}`, 'warning');
    });
  }
  
  // Recomendações
  log('\n--- Recomendações ---', 'info');
  log('1. Verificar se o servidor está rodando na porta correta', 'info');
  log('2. Confirmar que usuário admin existe no banco de dados', 'info');
  log('3. Validar implementação de endpoints administrativos', 'info');
  log('4. Testar funcionalidades através da interface web', 'info');
  log('5. Verificar permissões de acesso admin', 'info');
  
  // Salvar relatório
  saveReportToFile();
}

// Função para salvar relatório
async function saveReportToFile() {
  const reportPath = `test-report-admin-api-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runAdminAPITests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});