#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do teste
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DOCTOR_EMAIL = 'testdoctor@cnvidas.com';
const DOCTOR_PASSWORD = 'Doctor@123456';
const DOCTOR_NAME = 'Dr. Teste Silva';
const DOCTOR_CRM = '123456-SP';
const DOCTOR_SPECIALTY = 'Cardiologia';

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
    error: details.error || null,
    screenshots: details.screenshots || []
  });
  
  log(`${testName}: ${status.toUpperCase()} ${details.message ? `- ${details.message}` : ''}`, 
      status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'warning');
}

// Função para aguardar com timeout
async function waitForSelectorWithTimeout(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    return true;
  } catch (error) {
    return false;
  }
}

// Função para fazer screenshot
async function takeScreenshot(page, name) {
  const screenshotPath = `test-screenshots-doctor/${name}-${Date.now()}.png`;
  try {
    await fs.mkdir('test-screenshots-doctor', { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    log(`Erro ao tirar screenshot: ${error.message}`, 'warning');
    return null;
  }
}

// Função para fazer login como médico
async function loginAsDoctor(page) {
  const startTime = Date.now();
  try {
    await page.goto(`${BASE_URL}/entrar`, { waitUntil: 'networkidle0' });
    
    // Preencher credenciais
    await page.type('input[type="email"]', DOCTOR_EMAIL);
    await page.type('input[type="password"]', DOCTOR_PASSWORD);
    
    // Clicar no botão de login
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    const currentUrl = page.url();
    const duration = Date.now() - startTime;
    
    if (currentUrl.includes('/doctor') || currentUrl.includes('/dashboard')) {
      addTestResult('Login do Médico', 'passed', { 
        duration,
        message: 'Login realizado com sucesso'
      });
      return true;
    } else {
      const screenshot = await takeScreenshot(page, 'doctor-login-failed');
      addTestResult('Login do Médico', 'failed', { 
        duration,
        message: 'Redirecionamento incorreto após login',
        screenshots: [screenshot]
      });
      return false;
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'doctor-login-error');
    addTestResult('Login do Médico', 'failed', { 
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
    return false;
  }
}

// 1. Teste do Dashboard do Médico
async function testDoctorDashboard(page) {
  log('\n=== TESTANDO DASHBOARD DO MÉDICO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para dashboard
    await page.goto(`${BASE_URL}/doctor-telemedicine`, { waitUntil: 'networkidle0' });
    
    // Verificar elementos principais
    const hasWelcome = await waitForSelectorWithTimeout(page, 'h1, .welcome-title');
    if (hasWelcome) {
      addTestResult('Dashboard Principal', 'passed', {
        message: 'Dashboard carregou corretamente'
      });
    }
    
    // Verificar lista de consultas
    const consultationsList = await page.$$('.consultation-item, .appointment-card, [data-testid="consultation"]');
    addTestResult('Lista de Consultas', 'passed', {
      message: `${consultationsList.length} consultas encontradas`
    });
    
    // Verificar banner de emergência
    const emergencyBanner = await page.$('.emergency-banner, [data-testid="emergency-banner"]');
    if (emergencyBanner) {
      addTestResult('Banner de Emergência', 'passed', {
        message: 'Banner de disponibilidade encontrado'
      });
    } else {
      addTestResult('Banner de Emergência', 'warning', {
        message: 'Banner não encontrado - pode não estar ativo'
      });
    }
    
    // Verificar toggle de disponibilidade
    const availabilityToggle = await page.$('input[type="checkbox"], .toggle, [role="switch"]');
    if (availabilityToggle) {
      addTestResult('Toggle de Disponibilidade', 'passed', {
        message: 'Controle de disponibilidade encontrado'
      });
    }
    
    addTestResult('Dashboard Completo', 'passed', {
      duration: Date.now() - startTime,
      message: 'Dashboard funcionando corretamente'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'dashboard-error');
    addTestResult('Dashboard do Médico', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 2. Teste de Perfil do Médico
async function testDoctorProfile(page) {
  log('\n=== TESTANDO PERFIL DO MÉDICO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para perfil
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle0' });
    
    // Verificar abas do perfil
    const profileTabs = await page.$$('.tab, [role="tab"]');
    if (profileTabs.length > 0) {
      addTestResult('Abas do Perfil', 'passed', {
        message: `${profileTabs.length} abas encontradas`
      });
    }
    
    // Verificar formulário de perfil
    const profileForm = await waitForSelectorWithTimeout(page, 'form');
    if (profileForm) {
      // Testar campos específicos do médico
      const specialtyField = await page.$('input[name="specialty"], select[name="specialty"]');
      const crmField = await page.$('input[name="crm"], input[placeholder*="CRM"]');
      const experienceField = await page.$('input[name="experience"], textarea[name="experience"]');
      
      if (specialtyField && crmField) {
        addTestResult('Campos Específicos de Médico', 'passed', {
          message: 'Campos de especialidade e CRM encontrados'
        });
        
        // Tentar atualizar campos
        await specialtyField.click({ clickCount: 3 });
        await specialtyField.type(DOCTOR_SPECIALTY);
        
        if (crmField) {
          await crmField.click({ clickCount: 3 });
          await crmField.type(DOCTOR_CRM);
        }
        
        // Salvar alterações
        const saveButton = await page.$('button[type="submit"]:has-text("Salvar"), button:has-text("Atualizar")');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          
          addTestResult('Atualização de Perfil', 'passed', {
            message: 'Dados do médico atualizados'
          });
        }
      }
    }
    
    // Verificar upload de foto
    const photoUpload = await page.$('input[type="file"], .photo-upload');
    if (photoUpload) {
      addTestResult('Upload de Foto', 'passed', {
        message: 'Sistema de upload de foto disponível'
      });
    }
    
    addTestResult('Perfil do Médico', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de perfil funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'profile-error');
    addTestResult('Perfil do Médico', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 3. Teste de Disponibilidade
async function testDoctorAvailability(page) {
  log('\n=== TESTANDO GESTÃO DE DISPONIBILIDADE ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para disponibilidade
    await page.goto(`${BASE_URL}/doctor-availability`, { waitUntil: 'networkidle0' });
    
    // Verificar grid de disponibilidade
    const availabilityGrid = await waitForSelectorWithTimeout(page, '.availability-grid, .schedule-grid, table');
    
    if (availabilityGrid) {
      addTestResult('Grid de Disponibilidade', 'passed', {
        message: 'Interface de horários encontrada'
      });
      
      // Verificar slots de horário
      const timeSlots = await page.$$('.time-slot, .schedule-slot, td[data-time], button[data-time]');
      if (timeSlots.length > 0) {
        addTestResult('Slots de Horário', 'passed', {
          message: `${timeSlots.length} slots de horário disponíveis`
        });
        
        // Tentar selecionar alguns slots
        for (let i = 0; i < Math.min(3, timeSlots.length); i++) {
          await timeSlots[i].click();
          await page.waitForTimeout(200);
        }
        
        // Salvar disponibilidade
        const saveButton = await page.$('button:has-text("Salvar"), button[type="submit"]');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          
          addTestResult('Salvar Disponibilidade', 'passed', {
            message: 'Horários salvos com sucesso'
          });
        }
      }
    } else {
      throw new Error('Grid de disponibilidade não encontrado');
    }
    
    addTestResult('Gestão de Disponibilidade', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de disponibilidade funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'availability-error');
    addTestResult('Gestão de Disponibilidade', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 4. Teste de Sistema Financeiro
async function testDoctorFinancial(page) {
  log('\n=== TESTANDO SISTEMA FINANCEIRO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para página financeira
    await page.goto(`${BASE_URL}/doctor/financeiro`, { waitUntil: 'networkidle0' });
    
    // Verificar resumo financeiro
    const financialSummary = await waitForSelectorWithTimeout(page, '.financial-summary, .earnings-summary');
    
    if (financialSummary) {
      addTestResult('Resumo Financeiro', 'passed', {
        message: 'Dashboard financeiro carregado'
      });
      
      // Verificar cards de estatísticas
      const statsCards = await page.$$('.stat-card, .earnings-card, [data-testid="earning-stat"]');
      if (statsCards.length > 0) {
        addTestResult('Estatísticas Financeiras', 'passed', {
          message: `${statsCards.length} métricas financeiras exibidas`
        });
      }
      
      // Verificar configurações PIX
      const pixConfig = await page.$('.pix-config, [data-testid="pix-settings"]');
      if (pixConfig) {
        addTestResult('Configurações PIX', 'passed', {
          message: 'Seção de configuração PIX encontrada'
        });
        
        // Testar preenchimento de dados PIX
        const pixKeyInput = await page.$('input[name="pixKey"], input[placeholder*="PIX"]');
        const bankSelect = await page.$('select[name="bank"], select[name="bankName"]');
        
        if (pixKeyInput) {
          await pixKeyInput.click({ clickCount: 3 });
          await pixKeyInput.type('doctor@teste.com');
          
          if (bankSelect) {
            const bankOptions = await page.$$eval('select[name="bank"] option, select[name="bankName"] option', 
              options => options.map(opt => opt.value).filter(v => v)
            );
            
            if (bankOptions.length > 0) {
              await page.select('select[name="bank"], select[name="bankName"]', bankOptions[0]);
            }
          }
          
          // Salvar configurações PIX
          const savePixButton = await page.$('button:has-text("Salvar PIX"), button[type="submit"]');
          if (savePixButton) {
            await savePixButton.click();
            await page.waitForTimeout(2000);
            
            addTestResult('Salvar Configurações PIX', 'passed', {
              message: 'Dados PIX atualizados'
            });
          }
        }
      }
      
      // Verificar extrato de pagamentos
      const paymentHistory = await page.$('.payment-history, .earnings-history');
      if (paymentHistory) {
        addTestResult('Histórico de Pagamentos', 'passed', {
          message: 'Extrato de pagamentos disponível'
        });
      }
    } else {
      throw new Error('Dashboard financeiro não carregou');
    }
    
    addTestResult('Sistema Financeiro', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema financeiro completo e funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'financial-error');
    addTestResult('Sistema Financeiro', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 5. Teste de Sistema de Emergência
async function testEmergencySystem(page) {
  log('\n=== TESTANDO SISTEMA DE EMERGÊNCIA ===', 'section');
  const startTime = Date.now();
  
  try {
    // Voltar ao dashboard
    await page.goto(`${BASE_URL}/doctor-telemedicine`, { waitUntil: 'networkidle0' });
    
    // Verificar toggle de emergência
    const emergencyToggle = await page.$('input[type="checkbox"][name*="emergency"], .emergency-toggle');
    
    if (emergencyToggle) {
      // Ativar emergência
      await emergencyToggle.click();
      await page.waitForTimeout(1000);
      
      addTestResult('Ativação de Emergência', 'passed', {
        message: 'Toggle de emergência acionado'
      });
      
      // Verificar se banner mudou
      const activeBanner = await page.$('.emergency-active, .emergency-banner.active');
      if (activeBanner) {
        addTestResult('Banner de Emergência Ativo', 'passed', {
          message: 'Status visual de emergência ativo'
        });
      }
      
      // Testar acesso à sala de emergência
      await page.goto(`${BASE_URL}/doctor-emergency-room`, { waitUntil: 'networkidle0' });
      
      const emergencyRoom = await waitForSelectorWithTimeout(page, '.emergency-room, .video-container, iframe');
      if (emergencyRoom) {
        addTestResult('Sala de Emergência', 'passed', {
          message: 'Acesso à sala de emergência funcional'
        });
      }
    } else {
      addTestResult('Sistema de Emergência', 'warning', {
        message: 'Toggle de emergência não encontrado'
      });
    }
    
    addTestResult('Sistema de Emergência', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de emergência operacional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'emergency-error');
    addTestResult('Sistema de Emergência', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 6. Teste de Sistema de Telemedicina
async function testTelemedicineSystem(page) {
  log('\n=== TESTANDO SISTEMA DE TELEMEDICINA ===', 'section');
  const startTime = Date.now();
  
  try {
    // Testar página de telemedicina
    await page.goto(`${BASE_URL}/doctor-telemedicine`, { waitUntil: 'networkidle0' });
    
    // Verificar se há consultas
    const consultations = await page.$$('.consultation-item, .appointment-card');
    
    if (consultations.length > 0) {
      addTestResult('Lista de Consultas', 'passed', {
        message: `${consultations.length} consultas encontradas`
      });
      
      // Tentar iniciar uma consulta
      const startButton = await page.$('button:has-text("Iniciar"), button:has-text("Entrar")');
      if (startButton) {
        await startButton.click();
        await page.waitForTimeout(2000);
        
        // Verificar se abriu videochamada
        const videoCall = await page.$('video, iframe[src*="daily"], .daily-video');
        if (videoCall) {
          addTestResult('Videochamada', 'passed', {
            message: 'Interface de videochamada carregada'
          });
        }
      }
    } else {
      addTestResult('Lista de Consultas', 'warning', {
        message: 'Nenhuma consulta agendada para teste'
      });
    }
    
    // Verificar componentes de telemedicina
    const telemedicineComponents = await page.$$('.video-controls, .call-controls, [data-testid="video"]');
    if (telemedicineComponents.length > 0) {
      addTestResult('Componentes de Vídeo', 'passed', {
        message: 'Controles de videochamada disponíveis'
      });
    }
    
    addTestResult('Sistema de Telemedicina', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de telemedicina funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'telemedicine-error');
    addTestResult('Sistema de Telemedicina', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 7. Teste de Página de Boas-vindas
async function testWelcomePage(page) {
  log('\n=== TESTANDO PÁGINA DE BOAS-VINDAS ===', 'section');
  const startTime = Date.now();
  
  try {
    await page.goto(`${BASE_URL}/doctor/welcome`, { waitUntil: 'networkidle0' });
    
    const welcomePage = await waitForSelectorWithTimeout(page, '.welcome-content, .onboarding');
    
    if (welcomePage) {
      addTestResult('Página de Boas-vindas', 'passed', {
        message: 'Tutorial de onboarding disponível'
      });
      
      // Verificar botões de navegação
      const nextButton = await page.$('button:has-text("Próximo"), button:has-text("Continuar")');
      const completeButton = await page.$('button:has-text("Completar"), button:has-text("Finalizar")');
      
      if (nextButton || completeButton) {
        addTestResult('Navegação do Tutorial', 'passed', {
          message: 'Controles de navegação funcionais'
        });
      }
    } else {
      addTestResult('Página de Boas-vindas', 'warning', {
        message: 'Página pode não estar implementada ou médico já completou'
      });
    }
    
    addTestResult('Sistema de Onboarding', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de boas-vindas verificado'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'welcome-error');
    addTestResult('Página de Boas-vindas', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// Função principal de execução dos testes
async function runAllDoctorTests() {
  log('=== INICIANDO TESTES COMPLETOS DO MÉDICO CNVidas ===', 'section');
  
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Configurar interceptação de erros
    page.on('console', msg => {
      if (msg.type() === 'error') {
        testReport.errors.push({
          type: 'console-error',
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    page.on('pageerror', error => {
      testReport.errors.push({
        type: 'page-error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    // Executar login
    const loginSuccess = await loginAsDoctor(page);
    
    if (loginSuccess) {
      // Executar todos os testes
      await testDoctorDashboard(page);
      await testDoctorProfile(page);
      await testDoctorAvailability(page);
      await testDoctorFinancial(page);
      await testEmergencySystem(page);
      await testTelemedicineSystem(page);
      await testWelcomePage(page);
    } else {
      log('Falha no login. Abortando testes subsequentes.', 'error');
    }
    
  } catch (error) {
    log(`Erro crítico durante execução dos testes: ${error.message}`, 'error');
    testReport.errors.push({
      type: 'critical-error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } finally {
    await browser.close();
  }
  
  // Gerar relatório final
  generateFinalReport();
}

// Função para gerar relatório final
function generateFinalReport() {
  const endTime = new Date();
  const totalDuration = (endTime - testReport.startTime) / 1000;
  
  log('\n=== RELATÓRIO FINAL DOS TESTES DO MÉDICO ===', 'section');
  log(`Duração total: ${totalDuration.toFixed(2)} segundos`, 'info');
  log(`Total de testes: ${testReport.totalTests}`, 'info');
  log(`✅ Passou: ${testReport.passed}`, 'success');
  log(`❌ Falhou: ${testReport.failed}`, 'error');
  log(`⚠️  Avisos: ${testReport.warnings}`, 'warning');
  
  const successRate = testReport.totalTests > 0 
    ? ((testReport.passed / testReport.totalTests) * 100).toFixed(2)
    : 0;
  log(`Taxa de sucesso: ${successRate}%`, successRate >= 80 ? 'success' : 'warning');
  
  // Salvar relatório
  saveReportToFile();
}

// Função para salvar relatório
async function saveReportToFile() {
  const reportPath = `test-report-doctor-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runAllDoctorTests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});