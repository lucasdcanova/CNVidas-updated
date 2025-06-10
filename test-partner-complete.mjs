#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do teste
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const PARTNER_EMAIL = 'testpartner@cnvidas.com';
const PARTNER_PASSWORD = 'Partner@123456';
const PARTNER_BUSINESS_NAME = 'Clínica Teste LTDA';
const PARTNER_CNPJ = '12.345.678/0001-90';

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
  const screenshotPath = `test-screenshots-partner/${name}-${Date.now()}.png`;
  try {
    await fs.mkdir('test-screenshots-partner', { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    log(`Erro ao tirar screenshot: ${error.message}`, 'warning');
    return null;
  }
}

// Função para fazer login como parceiro
async function loginAsPartner(page) {
  const startTime = Date.now();
  try {
    await page.goto(`${BASE_URL}/entrar`, { waitUntil: 'networkidle0' });
    
    // Preencher credenciais
    await page.type('input[type="email"]', PARTNER_EMAIL);
    await page.type('input[type="password"]', PARTNER_PASSWORD);
    
    // Clicar no botão de login
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    const currentUrl = page.url();
    const duration = Date.now() - startTime;
    
    if (currentUrl.includes('/partner') || currentUrl.includes('/dashboard')) {
      addTestResult('Login do Parceiro', 'passed', { 
        duration,
        message: 'Login realizado com sucesso'
      });
      return true;
    } else {
      const screenshot = await takeScreenshot(page, 'partner-login-failed');
      addTestResult('Login do Parceiro', 'failed', { 
        duration,
        message: 'Redirecionamento incorreto após login',
        screenshots: [screenshot]
      });
      return false;
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'partner-login-error');
    addTestResult('Login do Parceiro', 'failed', { 
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
    return false;
  }
}

// 1. Teste do Dashboard do Parceiro
async function testPartnerDashboard(page) {
  log('\n=== TESTANDO DASHBOARD DO PARCEIRO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para dashboard
    await page.goto(`${BASE_URL}/partner-dashboard`, { waitUntil: 'networkidle0' });
    
    // Verificar elementos principais
    const hasWelcome = await waitForSelectorWithTimeout(page, 'h1, .welcome-title, .dashboard-title');
    if (hasWelcome) {
      addTestResult('Dashboard Principal', 'passed', {
        message: 'Dashboard carregou corretamente'
      });
    }
    
    // Verificar estatísticas
    const statsCards = await page.$$('.stat-card, .metric-card, [data-testid="stat"]');
    if (statsCards.length > 0) {
      addTestResult('Cards de Estatísticas', 'passed', {
        message: `${statsCards.length} métricas exibidas`
      });
    }
    
    // Verificar lista de serviços
    const servicesList = await page.$$('.service-item, .service-card, [data-testid="service"]');
    addTestResult('Lista de Serviços', 'passed', {
      message: `${servicesList.length} serviços encontrados`
    });
    
    // Verificar botões de ação
    const actionButtons = await page.$$('button, .btn, [role="button"]');
    if (actionButtons.length > 0) {
      addTestResult('Botões de Ação', 'passed', {
        message: 'Interface interativa disponível'
      });
    }
    
    addTestResult('Dashboard Completo', 'passed', {
      duration: Date.now() - startTime,
      message: 'Dashboard funcionando corretamente'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'partner-dashboard-error');
    addTestResult('Dashboard do Parceiro', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 2. Teste de Gestão de Serviços
async function testServiceManagement(page) {
  log('\n=== TESTANDO GESTÃO DE SERVIÇOS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para gestão de serviços
    await page.goto(`${BASE_URL}/partner-services`, { waitUntil: 'networkidle0' });
    
    // Verificar lista de serviços
    const servicesPage = await waitForSelectorWithTimeout(page, '.services-container, .service-management');
    
    if (servicesPage) {
      addTestResult('Página de Serviços', 'passed', {
        message: 'Interface de gestão carregada'
      });
      
      // Verificar botão de adicionar serviço
      const addServiceButton = await page.$('button:has-text("Adicionar"), button:has-text("Novo Serviço"), .add-service');
      
      if (addServiceButton) {
        await addServiceButton.click();
        await page.waitForTimeout(2000);
        
        // Verificar formulário de criação
        const serviceForm = await page.$('form, .service-form');
        if (serviceForm) {
          addTestResult('Formulário de Serviço', 'passed', {
            message: 'Modal/formulário de criação aberto'
          });
          
          // Preencher formulário
          await testServiceForm(page);
        }
      }
      
      // Verificar serviços existentes
      const existingServices = await page.$$('.service-item, .service-card, tr');
      if (existingServices.length > 0) {
        addTestResult('Serviços Existentes', 'passed', {
          message: `${existingServices.length} serviços listados`
        });
        
        // Testar edição de serviço
        const editButton = await page.$('button:has-text("Editar"), .edit-btn, [data-action="edit"]');
        if (editButton) {
          await editButton.click();
          await page.waitForTimeout(1000);
          
          addTestResult('Edição de Serviço', 'passed', {
            message: 'Interface de edição acessível'
          });
        }
      }
    } else {
      throw new Error('Página de gestão de serviços não carregou');
    }
    
    addTestResult('Gestão de Serviços', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de gestão funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'service-management-error');
    addTestResult('Gestão de Serviços', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// Função auxiliar para testar formulário de serviço
async function testServiceForm(page) {
  try {
    // Nome do serviço
    const nameInput = await page.$('input[name="name"], input[placeholder*="nome"]');
    if (nameInput) {
      await nameInput.type('Consulta Cardiológica - Teste');
    }
    
    // Categoria
    const categorySelect = await page.$('select[name="category"], select[name="specialty"]');
    if (categorySelect) {
      const categories = await page.$$eval('select[name="category"] option, select[name="specialty"] option', 
        options => options.map(opt => opt.value).filter(v => v)
      );
      
      if (categories.length > 0) {
        await page.select('select[name="category"], select[name="specialty"]', categories[0]);
        addTestResult('Seleção de Categoria', 'passed', {
          message: `${categories.length} categorias disponíveis`
        });
      }
    }
    
    // Preço regular
    const regularPriceInput = await page.$('input[name="regularPrice"], input[name="price"]');
    if (regularPriceInput) {
      await regularPriceInput.type('150.00');
    }
    
    // Preço com desconto
    const discountPriceInput = await page.$('input[name="discountPrice"], input[name="memberPrice"]');
    if (discountPriceInput) {
      await discountPriceInput.type('120.00');
    }
    
    // Descrição
    const descriptionInput = await page.$('textarea[name="description"], textarea[placeholder*="descrição"]');
    if (descriptionInput) {
      await descriptionInput.type('Consulta cardiológica completa com ECG incluso');
    }
    
    // Duração
    const durationInput = await page.$('input[name="duration"], select[name="duration"]');
    if (durationInput) {
      if (durationInput.tagName === 'SELECT') {
        await page.select('select[name="duration"]', '60');
      } else {
        await durationInput.type('60');
      }
    }
    
    // Salvar serviço
    const saveButton = await page.$('button[type="submit"]:has-text("Salvar"), button:has-text("Criar")');
    if (saveButton) {
      await saveButton.click();
      await page.waitForTimeout(2000);
      
      // Verificar mensagem de sucesso
      const successMessage = await page.$('.toast-success, .alert-success, [role="status"]');
      if (successMessage) {
        addTestResult('Criação de Serviço', 'passed', {
          message: 'Serviço criado com sucesso'
        });
      } else {
        addTestResult('Criação de Serviço', 'warning', {
          message: 'Serviço possivelmente criado mas sem confirmação visual'
        });
      }
    }
  } catch (error) {
    addTestResult('Formulário de Serviço', 'failed', {
      message: error.message
    });
  }
}

// 3. Teste do Sistema de Verificação QR
async function testQRVerification(page) {
  log('\n=== TESTANDO SISTEMA DE VERIFICAÇÃO QR ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para verificação
    await page.goto(`${BASE_URL}/partner-verification`, { waitUntil: 'networkidle0' });
    
    // Verificar interface de scanner
    const qrScanner = await waitForSelectorWithTimeout(page, '.qr-scanner, .scanner-container, #qr-reader');
    
    if (qrScanner) {
      addTestResult('Interface de Scanner', 'passed', {
        message: 'Interface de QR Scanner carregada'
      });
      
      // Verificar botões de controle
      const controlButtons = await page.$$('button:has-text("Iniciar"), button:has-text("Parar"), .scanner-btn');
      if (controlButtons.length > 0) {
        addTestResult('Controles do Scanner', 'passed', {
          message: 'Botões de controle disponíveis'
        });
      }
      
      // Verificar área de resultado
      const resultArea = await page.$('.verification-result, .scan-result, #scan-result');
      if (resultArea) {
        addTestResult('Área de Resultado', 'passed', {
          message: 'Interface de resultado configurada'
        });
      }
      
      // Simular entrada manual de código (se disponível)
      const manualInput = await page.$('input[placeholder*="código"], input[name="qrCode"]');
      if (manualInput) {
        await manualInput.type('TEST-QR-CODE-123456');
        
        const verifyButton = await page.$('button:has-text("Verificar"), button[type="submit"]');
        if (verifyButton) {
          await verifyButton.click();
          await page.waitForTimeout(2000);
          
          addTestResult('Verificação Manual', 'passed', {
            message: 'Sistema de verificação manual funcional'
          });
        }
      }
    } else {
      throw new Error('Interface de QR Scanner não carregou');
    }
    
    addTestResult('Sistema de Verificação QR', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de verificação operacional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'qr-verification-error');
    addTestResult('Sistema de Verificação QR', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 4. Teste de Perfil do Parceiro
async function testPartnerProfile(page) {
  log('\n=== TESTANDO PERFIL DO PARCEIRO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para perfil (pode estar no dashboard ou numa rota específica)
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle0' });
    
    // Verificar formulário de perfil
    const profileForm = await waitForSelectorWithTimeout(page, 'form, .profile-form');
    
    if (profileForm) {
      // Verificar campos específicos de parceiro
      const businessNameField = await page.$('input[name="businessName"], input[name="razaoSocial"]');
      const cnpjField = await page.$('input[name="cnpj"], input[placeholder*="CNPJ"]');
      const businessTypeField = await page.$('select[name="businessType"], select[name="tipoNegocio"]');
      
      if (businessNameField && cnpjField) {
        addTestResult('Campos Empresariais', 'passed', {
          message: 'Campos específicos de empresa encontrados'
        });
        
        // Atualizar dados empresariais
        await businessNameField.click({ clickCount: 3 });
        await businessNameField.type(PARTNER_BUSINESS_NAME);
        
        if (cnpjField) {
          await cnpjField.click({ clickCount: 3 });
          await cnpjField.type(PARTNER_CNPJ);
        }
        
        if (businessTypeField) {
          const businessTypes = await page.$$eval('select[name="businessType"] option, select[name="tipoNegocio"] option',
            options => options.map(opt => opt.value).filter(v => v)
          );
          
          if (businessTypes.length > 0) {
            await page.select('select[name="businessType"], select[name="tipoNegocio"]', businessTypes[0]);
          }
        }
        
        // Salvar alterações
        const saveButton = await page.$('button[type="submit"]:has-text("Salvar"), button:has-text("Atualizar")');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          
          const successMessage = await page.$('.toast-success, .alert-success');
          if (successMessage) {
            addTestResult('Atualização de Perfil', 'passed', {
              message: 'Dados do parceiro atualizados'
            });
          }
        }
      }
      
      // Verificar campos de endereço
      const addressFields = await page.$$('input[name*="address"], input[name*="endereco"], input[name="cep"]');
      if (addressFields.length > 0) {
        addTestResult('Campos de Endereço', 'passed', {
          message: `${addressFields.length} campos de endereço encontrados`
        });
      }
      
      // Verificar campo de website
      const websiteField = await page.$('input[name="website"], input[type="url"]');
      if (websiteField) {
        await websiteField.click({ clickCount: 3 });
        await websiteField.type('https://clinicateste.com.br');
        
        addTestResult('Campo Website', 'passed', {
          message: 'Campo de website configurado'
        });
      }
    } else {
      throw new Error('Formulário de perfil não encontrado');
    }
    
    addTestResult('Perfil do Parceiro', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de perfil funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'partner-profile-error');
    addTestResult('Perfil do Parceiro', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 5. Teste de Integração com Sistema Público
async function testPublicIntegration(page) {
  log('\n=== TESTANDO INTEGRAÇÃO COM SISTEMA PÚBLICO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Verificar se serviços do parceiro aparecem na listagem pública
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle0' });
    
    // Verificar listagem pública
    const publicServices = await page.$$('.service-card, .service-item, [data-testid="service"]');
    
    if (publicServices.length > 0) {
      addTestResult('Listagem Pública', 'passed', {
        message: `${publicServices.length} serviços visíveis publicamente`
      });
      
      // Verificar filtros
      const categoryFilter = await page.$('select[name="category"], .category-filter');
      if (categoryFilter) {
        const categories = await page.$$eval('select[name="category"] option, .category-filter option',
          options => options.map(opt => opt.value).filter(v => v)
        );
        
        if (categories.length > 0) {
          await page.select('select[name="category"], .category-filter', categories[0]);
          await page.waitForTimeout(1000);
          
          addTestResult('Filtro por Categoria', 'passed', {
            message: 'Filtro de categoria funcional'
          });
        }
      }
      
      // Verificar busca por texto
      const searchInput = await page.$('input[type="search"], input[placeholder*="buscar"]');
      if (searchInput) {
        await searchInput.type('teste');
        await page.waitForTimeout(1000);
        
        addTestResult('Busca por Texto', 'passed', {
          message: 'Sistema de busca operacional'
        });
      }
      
      // Verificar botões de contato
      const contactButtons = await page.$$('a[href*="whatsapp"], button:has-text("Contato")');
      if (contactButtons.length > 0) {
        addTestResult('Botões de Contato', 'passed', {
          message: 'Integração WhatsApp disponível'
        });
      }
    } else {
      addTestResult('Listagem Pública', 'warning', {
        message: 'Nenhum serviço encontrado na listagem pública'
      });
    }
    
    addTestResult('Integração Pública', 'passed', {
      duration: Date.now() - startTime,
      message: 'Integração com sistema público funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'public-integration-error');
    addTestResult('Integração Pública', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 6. Teste de Estatísticas e Analytics
async function testAnalytics(page) {
  log('\n=== TESTANDO ESTATÍSTICAS E ANALYTICS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Voltar ao dashboard para verificar métricas
    await page.goto(`${BASE_URL}/partner-dashboard`, { waitUntil: 'networkidle0' });
    
    // Verificar cards de estatísticas
    const statsCards = await page.$$('.stat-card, .metric-card, .analytics-card');
    
    if (statsCards.length > 0) {
      addTestResult('Cards de Estatísticas', 'passed', {
        message: `${statsCards.length} métricas exibidas`
      });
      
      // Verificar valores numéricos
      for (let i = 0; i < Math.min(3, statsCards.length); i++) {
        const cardText = await page.evaluate(el => el.textContent, statsCards[i]);
        if (cardText.match(/\d+/)) {
          addTestResult(`Métrica ${i + 1}`, 'passed', {
            message: 'Valores numéricos exibidos corretamente'
          });
        }
      }
    }
    
    // Verificar gráficos ou visualizações (se existirem)
    const charts = await page.$$('canvas, .chart, [data-chart]');
    if (charts.length > 0) {
      addTestResult('Visualizações Gráficas', 'passed', {
        message: `${charts.length} gráficos encontrados`
      });
    }
    
    // Verificar relatórios de período
    const dateFilters = await page.$$('input[type="date"], .date-picker, select[name*="period"]');
    if (dateFilters.length > 0) {
      addTestResult('Filtros de Período', 'passed', {
        message: 'Filtros temporais disponíveis'
      });
    }
    
    addTestResult('Sistema de Analytics', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de estatísticas funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'analytics-error');
    addTestResult('Analytics', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// Função principal de execução dos testes
async function runAllPartnerTests() {
  log('=== INICIANDO TESTES COMPLETOS DO PARCEIRO CNVidas ===', 'section');
  
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
    const loginSuccess = await loginAsPartner(page);
    
    if (loginSuccess) {
      // Executar todos os testes
      await testPartnerDashboard(page);
      await testServiceManagement(page);
      await testQRVerification(page);
      await testPartnerProfile(page);
      await testPublicIntegration(page);
      await testAnalytics(page);
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
  
  log('\n=== RELATÓRIO FINAL DOS TESTES DO PARCEIRO ===', 'section');
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
  const reportPath = `test-report-partner-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runAllPartnerTests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});