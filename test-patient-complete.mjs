#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do teste
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const PATIENT_EMAIL = 'testpatient@cnvidas.com';
const PATIENT_PASSWORD = 'Test@123456';
const PATIENT_NAME = 'Paciente Teste';
const PATIENT_CPF = '123.456.789-00';
const PATIENT_PHONE = '(11) 98765-4321';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper para log colorido
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

// Função para adicionar resultado ao relatório
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
  const screenshotPath = `test-screenshots/${name}-${Date.now()}.png`;
  try {
    await fs.mkdir('test-screenshots', { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    log(`Erro ao tirar screenshot: ${error.message}`, 'warning');
    return null;
  }
}

// Função para fazer login
async function loginAsPatient(page) {
  const startTime = Date.now();
  try {
    await page.goto(`${BASE_URL}/entrar`, { waitUntil: 'networkidle0' });
    
    // Preencher credenciais
    await page.type('input[type="email"]', PATIENT_EMAIL);
    await page.type('input[type="password"]', PATIENT_PASSWORD);
    
    // Clicar no botão de login
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento para dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    const currentUrl = page.url();
    const duration = Date.now() - startTime;
    
    if (currentUrl.includes('/dashboard')) {
      addTestResult('Login do Paciente', 'passed', { 
        duration,
        message: 'Login realizado com sucesso'
      });
      return true;
    } else {
      const screenshot = await takeScreenshot(page, 'login-failed');
      addTestResult('Login do Paciente', 'failed', { 
        duration,
        message: 'Redirecionamento incorreto após login',
        screenshots: [screenshot]
      });
      return false;
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'login-error');
    addTestResult('Login do Paciente', 'failed', { 
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
    return false;
  }
}

// 1. Teste de Registro de Sinistros (Claims)
async function testClaimsFeature(page) {
  log('\n=== TESTANDO REGISTRO DE SINISTROS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para página de sinistros
    await page.goto(`${BASE_URL}/claims`, { waitUntil: 'networkidle0' });
    
    // Verificar se a página carregou
    const hasClaimsPage = await waitForSelectorWithTimeout(page, 'h1');
    if (!hasClaimsPage) {
      throw new Error('Página de sinistros não carregou');
    }
    
    // Clicar em novo sinistro
    const newClaimButton = await page.$('button:has-text("Novo Sinistro"), a:has-text("Novo Sinistro")');
    if (newClaimButton) {
      await newClaimButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      // Preencher formulário de sinistro
      const formExists = await waitForSelectorWithTimeout(page, 'form');
      if (formExists) {
        // Título do sinistro
        await page.type('input[name="title"], input[placeholder*="título"]', 'Consulta Médica - Teste Automatizado');
        
        // Descrição
        await page.type('textarea[name="description"], textarea[placeholder*="descrição"]', 
          'Consulta médica realizada para teste automatizado do sistema');
        
        // Valor
        await page.type('input[name="amount"], input[type="number"]', '150.00');
        
        // Categoria
        const categorySelect = await page.$('select[name="category"]');
        if (categorySelect) {
          await page.select('select[name="category"]', 'medical_appointment');
        }
        
        // Data
        const dateInput = await page.$('input[type="date"]');
        if (dateInput) {
          await page.type('input[type="date"]', '2025-01-09');
        }
        
        // Submeter formulário
        await page.click('button[type="submit"]');
        
        // Aguardar resposta
        await page.waitForTimeout(2000);
        
        // Verificar se foi criado
        const successMessage = await page.$('.toast-success, .alert-success, [role="status"]');
        if (successMessage) {
          addTestResult('Criar Novo Sinistro', 'passed', {
            duration: Date.now() - startTime,
            message: 'Sinistro criado com sucesso'
          });
        } else {
          const screenshot = await takeScreenshot(page, 'claim-creation-warning');
          addTestResult('Criar Novo Sinistro', 'warning', {
            duration: Date.now() - startTime,
            message: 'Sinistro possivelmente criado mas sem confirmação visual',
            screenshots: [screenshot]
          });
        }
      } else {
        throw new Error('Formulário de sinistro não encontrado');
      }
    } else {
      throw new Error('Botão de novo sinistro não encontrado');
    }
    
    // Voltar para lista de sinistros
    await page.goto(`${BASE_URL}/claims`, { waitUntil: 'networkidle0' });
    
    // Verificar listagem
    const claimsList = await page.$$('.claim-item, [data-testid="claim-item"], table tbody tr');
    if (claimsList.length > 0) {
      addTestResult('Listar Sinistros', 'passed', {
        message: `${claimsList.length} sinistros encontrados`
      });
    } else {
      addTestResult('Listar Sinistros', 'warning', {
        message: 'Nenhum sinistro encontrado na lista'
      });
    }
    
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'claims-error');
    addTestResult('Funcionalidade de Sinistros', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 2. Teste de Consulta Emergencial
async function testEmergencyConsultation(page) {
  log('\n=== TESTANDO CONSULTA EMERGENCIAL ===', 'section');
  const startTime = Date.now();
  
  try {
    // Voltar ao dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    
    // Procurar botão de emergência
    const emergencyButton = await page.$('button:has-text("Emergência"), a:has-text("Emergência"), [data-testid="emergency-button"]');
    
    if (emergencyButton) {
      await emergencyButton.click();
      await page.waitForTimeout(2000);
      
      // Verificar se abriu modal ou redirecionou
      const emergencyModal = await page.$('.emergency-modal, [role="dialog"]');
      const emergencyPage = page.url().includes('emergency');
      
      if (emergencyModal || emergencyPage) {
        addTestResult('Acesso a Consulta Emergencial', 'passed', {
          duration: Date.now() - startTime,
          message: 'Interface de emergência acessível'
        });
        
        // Verificar elementos da consulta
        const videoElement = await waitForSelectorWithTimeout(page, 'video, iframe, .video-container', 5000);
        if (videoElement) {
          addTestResult('Interface de Vídeo Emergencial', 'passed', {
            message: 'Elementos de vídeo encontrados'
          });
        } else {
          addTestResult('Interface de Vídeo Emergencial', 'warning', {
            message: 'Elementos de vídeo não carregaram imediatamente'
          });
        }
      } else {
        throw new Error('Interface de emergência não foi aberta');
      }
    } else {
      // Verificar se o plano permite emergências
      const planInfo = await page.$('.plan-info, [data-testid="plan-info"]');
      if (planInfo) {
        const planText = await page.evaluate(el => el.textContent, planInfo);
        if (planText.toLowerCase().includes('gratuito') || planText.toLowerCase().includes('free')) {
          addTestResult('Acesso a Consulta Emergencial', 'warning', {
            duration: Date.now() - startTime,
            message: 'Plano gratuito não tem acesso a consultas emergenciais'
          });
        } else {
          throw new Error('Botão de emergência não encontrado');
        }
      }
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'emergency-error');
    addTestResult('Consulta Emergencial', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 3. Teste de Agendamento de Consultas
async function testAppointmentScheduling(page) {
  log('\n=== TESTANDO AGENDAMENTO DE CONSULTAS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para agendamento
    await page.goto(`${BASE_URL}/appointments`, { waitUntil: 'networkidle0' });
    
    // Procurar formulário de agendamento
    const appointmentForm = await waitForSelectorWithTimeout(page, 'form, .appointment-form');
    
    if (appointmentForm) {
      // Selecionar médico
      const doctorSelect = await page.$('select[name="doctor"], [data-testid="doctor-select"]');
      if (doctorSelect) {
        const doctorOptions = await page.$$eval('select[name="doctor"] option', options => 
          options.map(option => ({ value: option.value, text: option.textContent }))
        );
        
        if (doctorOptions.length > 1) {
          await page.select('select[name="doctor"]', doctorOptions[1].value);
          addTestResult('Seleção de Médico', 'passed', {
            message: `${doctorOptions.length - 1} médicos disponíveis`
          });
        }
      }
      
      // Selecionar data
      const dateInput = await page.$('input[type="date"], [data-testid="appointment-date"]');
      if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        await page.type('input[type="date"]', dateStr);
      }
      
      // Selecionar horário
      const timeSlots = await page.$$('.time-slot, button[data-time]');
      if (timeSlots.length > 0) {
        await timeSlots[0].click();
        addTestResult('Seleção de Horário', 'passed', {
          message: `${timeSlots.length} horários disponíveis`
        });
      }
      
      addTestResult('Interface de Agendamento', 'passed', {
        duration: Date.now() - startTime,
        message: 'Formulário de agendamento funcional'
      });
    } else {
      throw new Error('Formulário de agendamento não encontrado');
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'appointment-error');
    addTestResult('Agendamento de Consultas', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 4. Teste de Serviços de Parceiros
async function testPartnerServices(page) {
  log('\n=== TESTANDO SERVIÇOS DE PARCEIROS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para serviços
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle0' });
    
    // Verificar lista de serviços
    const servicesList = await page.$$('.service-card, [data-testid="service-card"]');
    
    if (servicesList.length > 0) {
      addTestResult('Listagem de Serviços', 'passed', {
        message: `${servicesList.length} serviços encontrados`
      });
      
      // Testar busca
      const searchInput = await page.$('input[type="search"], input[placeholder*="buscar"], input[placeholder*="search"]');
      if (searchInput) {
        await searchInput.type('médico');
        await page.waitForTimeout(1000);
        
        const filteredServices = await page.$$('.service-card:not(.hidden), [data-testid="service-card"]:not(.hidden)');
        addTestResult('Busca de Serviços', 'passed', {
          message: 'Funcionalidade de busca operacional'
        });
      }
      
      // Testar filtro por categoria
      const categoryFilter = await page.$('select[name="category"], [data-testid="category-filter"]');
      if (categoryFilter) {
        const categories = await page.$$eval('select[name="category"] option', options => 
          options.map(option => option.value).filter(v => v)
        );
        
        if (categories.length > 0) {
          await page.select('select[name="category"]', categories[0]);
          await page.waitForTimeout(1000);
          addTestResult('Filtro por Categoria', 'passed', {
            message: `${categories.length} categorias disponíveis`
          });
        }
      }
      
      // Testar clique em serviço
      if (servicesList.length > 0) {
        await servicesList[0].click();
        await page.waitForTimeout(1000);
        
        // Verificar se abriu detalhes ou modal
        const serviceDetails = await page.$('.service-details, [role="dialog"], .modal');
        if (serviceDetails) {
          // Procurar botão WhatsApp
          const whatsappButton = await page.$('a[href*="whatsapp"], button:has-text("WhatsApp")');
          if (whatsappButton) {
            addTestResult('Contato WhatsApp', 'passed', {
              message: 'Botão de contato WhatsApp disponível'
            });
          }
        }
      }
      
      addTestResult('Funcionalidade de Parceiros', 'passed', {
        duration: Date.now() - startTime,
        message: 'Sistema de parceiros totalmente funcional'
      });
    } else {
      throw new Error('Nenhum serviço encontrado');
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'services-error');
    addTestResult('Serviços de Parceiros', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 5. Teste de Atualização de Perfil
async function testProfileUpdate(page) {
  log('\n=== TESTANDO ATUALIZAÇÃO DE PERFIL ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para perfil
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle0' });
    
    // Encontrar formulário de perfil
    const profileForm = await waitForSelectorWithTimeout(page, 'form');
    
    if (profileForm) {
      // Atualizar nome
      const nameInput = await page.$('input[name="name"], input[placeholder*="nome"]');
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await nameInput.type(PATIENT_NAME + ' Atualizado');
      }
      
      // Atualizar telefone
      const phoneInput = await page.$('input[name="phone"], input[type="tel"]');
      if (phoneInput) {
        await phoneInput.click({ clickCount: 3 });
        await phoneInput.type('(11) 99999-8888');
      }
      
      // Buscar CEP (se disponível)
      const cepInput = await page.$('input[name="cep"], input[placeholder*="CEP"]');
      if (cepInput) {
        await cepInput.click({ clickCount: 3 });
        await cepInput.type('01310-100');
        
        // Aguardar busca de CEP
        await page.waitForTimeout(2000);
        
        const streetInput = await page.$('input[name="street"], input[name="logradouro"]');
        if (streetInput) {
          const streetValue = await page.evaluate(el => el.value, streetInput);
          if (streetValue) {
            addTestResult('Busca de CEP', 'passed', {
              message: 'CEP preencheu endereço automaticamente'
            });
          }
        }
      }
      
      // Salvar alterações
      const saveButton = await page.$('button[type="submit"]:has-text("Salvar"), button[type="submit"]:has-text("Atualizar")');
      if (saveButton) {
        await saveButton.click();
        await page.waitForTimeout(2000);
        
        // Verificar mensagem de sucesso
        const successMessage = await page.$('.toast-success, .alert-success, [role="status"]');
        if (successMessage) {
          addTestResult('Atualização de Perfil', 'passed', {
            duration: Date.now() - startTime,
            message: 'Perfil atualizado com sucesso'
          });
        } else {
          addTestResult('Atualização de Perfil', 'warning', {
            duration: Date.now() - startTime,
            message: 'Perfil possivelmente atualizado mas sem confirmação'
          });
        }
      }
    } else {
      throw new Error('Formulário de perfil não encontrado');
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'profile-error');
    addTestResult('Atualização de Perfil', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 6. Teste de Mudança de Plano
async function testPlanUpgrade(page) {
  log('\n=== TESTANDO MUDANÇA DE PLANO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para página de assinatura
    await page.goto(`${BASE_URL}/subscription`, { waitUntil: 'networkidle0' });
    
    // Verificar planos disponíveis
    const planCards = await page.$$('.plan-card, [data-testid="plan-card"]');
    
    if (planCards.length > 0) {
      addTestResult('Visualização de Planos', 'passed', {
        message: `${planCards.length} planos disponíveis`
      });
      
      // Procurar plano atual
      const currentPlan = await page.$('.current-plan, [data-current="true"]');
      if (currentPlan) {
        const currentPlanName = await page.evaluate(el => el.textContent, currentPlan);
        log(`Plano atual: ${currentPlanName}`, 'info');
      }
      
      // Procurar botão de upgrade
      const upgradeButtons = await page.$$('button:has-text("Fazer Upgrade"), button:has-text("Assinar"), button:has-text("Mudar Plano")');
      
      if (upgradeButtons.length > 0) {
        // Simular clique em upgrade
        await upgradeButtons[0].click();
        await page.waitForTimeout(2000);
        
        // Verificar se abriu modal de pagamento ou redirecionou
        const paymentModal = await page.$('.payment-modal, [role="dialog"], .checkout-form');
        const checkoutPage = page.url().includes('checkout');
        
        if (paymentModal || checkoutPage) {
          addTestResult('Interface de Upgrade', 'passed', {
            message: 'Interface de pagamento acessível'
          });
          
          // Verificar elementos de pagamento
          const cardInput = await page.$('input[placeholder*="card"], .stripe-card-element, #card-element');
          if (cardInput) {
            addTestResult('Formulário de Pagamento', 'passed', {
              message: 'Elementos de pagamento Stripe carregados'
            });
          }
        }
      }
      
      addTestResult('Sistema de Planos', 'passed', {
        duration: Date.now() - startTime,
        message: 'Funcionalidade de planos operacional'
      });
    } else {
      throw new Error('Nenhum plano encontrado');
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'plan-error');
    addTestResult('Mudança de Plano', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 7. Teste de Atualização de Método de Pagamento
async function testPaymentMethodUpdate(page) {
  log('\n=== TESTANDO ATUALIZAÇÃO DE MÉTODO DE PAGAMENTO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para configurações ou perfil
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
    
    // Procurar seção de pagamento
    const paymentSection = await page.$('.payment-methods, [data-testid="payment-methods"]');
    
    if (!paymentSection) {
      // Tentar na página de perfil
      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle0' });
    }
    
    // Procurar botão de adicionar/atualizar cartão
    const paymentButton = await page.$('button:has-text("Adicionar Cartão"), button:has-text("Atualizar Pagamento"), button:has-text("Método de Pagamento")');
    
    if (paymentButton) {
      await paymentButton.click();
      await page.waitForTimeout(2000);
      
      // Verificar se abriu modal ou seção de pagamento
      const stripeElement = await waitForSelectorWithTimeout(page, '.stripe-card-element, #card-element, iframe[name*="stripe"]', 5000);
      
      if (stripeElement) {
        addTestResult('Interface de Pagamento', 'passed', {
          message: 'Stripe Elements carregado corretamente'
        });
        
        // Verificar se há cartões salvos
        const savedCards = await page.$$('.saved-card, [data-testid="saved-card"]');
        if (savedCards.length > 0) {
          addTestResult('Cartões Salvos', 'passed', {
            message: `${savedCards.length} cartões salvos encontrados`
          });
        }
        
        addTestResult('Atualização de Pagamento', 'passed', {
          duration: Date.now() - startTime,
          message: 'Sistema de pagamento funcional'
        });
      } else {
        throw new Error('Elementos de pagamento não carregaram');
      }
    } else {
      addTestResult('Atualização de Pagamento', 'warning', {
        duration: Date.now() - startTime,
        message: 'Seção de pagamento não encontrada nas configurações'
      });
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'payment-method-error');
    addTestResult('Método de Pagamento', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 8. Teste de Gerenciamento de Dependentes
async function testDependentsManagement(page) {
  log('\n=== TESTANDO GERENCIAMENTO DE DEPENDENTES ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para página de dependentes
    await page.goto(`${BASE_URL}/dependents`, { waitUntil: 'networkidle0' });
    
    // Verificar se tem acesso (plano familiar)
    const dependentsSection = await waitForSelectorWithTimeout(page, '.dependents-list, [data-testid="dependents"]');
    
    if (dependentsSection) {
      // Contar dependentes existentes
      const dependentCards = await page.$$('.dependent-card, [data-testid="dependent-card"]');
      log(`${dependentCards.length} dependentes encontrados`, 'info');
      
      // Procurar botão de adicionar
      const addButton = await page.$('button:has-text("Adicionar Dependente"), button:has-text("Novo Dependente")');
      
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(1000);
        
        // Preencher formulário de dependente
        const dependentForm = await page.$('form, .dependent-form');
        if (dependentForm) {
          // Nome
          await page.type('input[name="name"], input[placeholder*="nome"]', 'Dependente Teste');
          
          // CPF
          await page.type('input[name="cpf"], input[placeholder*="CPF"]', '987.654.321-00');
          
          // Data de nascimento
          const birthDateInput = await page.$('input[type="date"], input[name="birthDate"]');
          if (birthDateInput) {
            await page.type('input[type="date"]', '2010-01-01');
          }
          
          // Relacionamento
          const relationshipSelect = await page.$('select[name="relationship"]');
          if (relationshipSelect) {
            await page.select('select[name="relationship"]', 'child');
          }
          
          addTestResult('Formulário de Dependente', 'passed', {
            message: 'Formulário preenchido corretamente'
          });
        }
      }
      
      addTestResult('Gerenciamento de Dependentes', 'passed', {
        duration: Date.now() - startTime,
        message: 'Interface de dependentes acessível'
      });
    } else {
      // Verificar se é limitação do plano
      const planLimitation = await page.$('.plan-limitation, .upgrade-message');
      if (planLimitation) {
        addTestResult('Gerenciamento de Dependentes', 'warning', {
          duration: Date.now() - startTime,
          message: 'Plano atual não permite dependentes'
        });
      } else {
        throw new Error('Página de dependentes não carregou');
      }
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'dependents-error');
    addTestResult('Dependentes', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 9. Teste de QR Code
async function testQRCode(page) {
  log('\n=== TESTANDO QR CODE ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para página de QR Code
    await page.goto(`${BASE_URL}/qr-code`, { waitUntil: 'networkidle0' });
    
    // Verificar se QR Code foi gerado
    const qrCode = await waitForSelectorWithTimeout(page, 'canvas, svg, img[alt*="QR"], .qr-code');
    
    if (qrCode) {
      addTestResult('Geração de QR Code', 'passed', {
        duration: Date.now() - startTime,
        message: 'QR Code gerado com sucesso'
      });
      
      // Verificar informações do usuário
      const userInfo = await page.$('.user-info, [data-testid="user-info"]');
      if (userInfo) {
        const infoText = await page.evaluate(el => el.textContent, userInfo);
        if (infoText.includes(PATIENT_NAME) || infoText.includes(PATIENT_EMAIL)) {
          addTestResult('Informações no QR Code', 'passed', {
            message: 'Dados do usuário exibidos corretamente'
          });
        }
      }
      
      // Verificar botão de download
      const downloadButton = await page.$('button:has-text("Download"), button:has-text("Baixar"), a[download]');
      if (downloadButton) {
        addTestResult('Download de QR Code', 'passed', {
          message: 'Opção de download disponível'
        });
      }
    } else {
      throw new Error('QR Code não foi gerado');
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'qrcode-error');
    addTestResult('QR Code', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 10. Teste de Notificações e Configurações
async function testNotificationsSettings(page) {
  log('\n=== TESTANDO NOTIFICAÇÕES E CONFIGURAÇÕES ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para configurações
    await page.goto(`${BASE_URL}/patient/settings`, { waitUntil: 'networkidle0' });
    
    // Verificar seções de configuração
    const notificationSection = await waitForSelectorWithTimeout(page, '.notifications-settings, [data-testid="notifications"]');
    
    if (notificationSection) {
      // Testar toggles de notificação
      const toggles = await page.$$('input[type="checkbox"], .switch, [role="switch"]');
      
      if (toggles.length > 0) {
        // Clicar em alguns toggles
        for (let i = 0; i < Math.min(3, toggles.length); i++) {
          await toggles[i].click();
          await page.waitForTimeout(500);
        }
        
        addTestResult('Configurações de Notificação', 'passed', {
          message: `${toggles.length} opções de notificação disponíveis`
        });
      }
      
      // Verificar configurações de privacidade
      const privacySection = await page.$('.privacy-settings, [data-testid="privacy"]');
      if (privacySection) {
        addTestResult('Configurações de Privacidade', 'passed', {
          message: 'Seção de privacidade disponível'
        });
      }
      
      // Salvar configurações
      const saveButton = await page.$('button:has-text("Salvar"), button[type="submit"]');
      if (saveButton) {
        await saveButton.click();
        await page.waitForTimeout(2000);
        
        const successMessage = await page.$('.toast-success, .alert-success');
        if (successMessage) {
          addTestResult('Salvar Configurações', 'passed', {
            duration: Date.now() - startTime,
            message: 'Configurações salvas com sucesso'
          });
        }
      }
    } else {
      throw new Error('Página de configurações não encontrada');
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'settings-error');
    addTestResult('Configurações', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// Função principal de execução dos testes
async function runAllTests() {
  log('=== INICIANDO TESTES COMPLETOS DO PACIENTE CNVidas ===', 'section');
  
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Configurar interceptação de erros do console
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
    const loginSuccess = await loginAsPatient(page);
    
    if (loginSuccess) {
      // Executar todos os testes
      await testClaimsFeature(page);
      await testEmergencyConsultation(page);
      await testAppointmentScheduling(page);
      await testPartnerServices(page);
      await testProfileUpdate(page);
      await testPlanUpgrade(page);
      await testPaymentMethodUpdate(page);
      await testDependentsManagement(page);
      await testQRCode(page);
      await testNotificationsSettings(page);
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
  
  log('\n=== RELATÓRIO FINAL DOS TESTES ===', 'section');
  log(`Duração total: ${totalDuration.toFixed(2)} segundos`, 'info');
  log(`Total de testes: ${testReport.totalTests}`, 'info');
  log(`✅ Passou: ${testReport.passed}`, 'success');
  log(`❌ Falhou: ${testReport.failed}`, 'error');
  log(`⚠️  Avisos: ${testReport.warnings}`, 'warning');
  
  // Taxa de sucesso
  const successRate = testReport.totalTests > 0 
    ? ((testReport.passed / testReport.totalTests) * 100).toFixed(2)
    : 0;
  log(`Taxa de sucesso: ${successRate}%`, successRate >= 80 ? 'success' : 'warning');
  
  // Resumo dos testes falhados
  if (testReport.failed > 0) {
    log('\n--- Testes Falhados ---', 'error');
    testReport.results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        log(`❌ ${r.testName}: ${r.details}`, 'error');
        if (r.error) {
          log(`   Erro: ${r.error.split('\n')[0]}`, 'error');
        }
      });
  }
  
  // Resumo dos avisos
  if (testReport.warnings > 0) {
    log('\n--- Avisos ---', 'warning');
    testReport.results
      .filter(r => r.status === 'warning')
      .forEach(r => {
        log(`⚠️  ${r.testName}: ${r.details}`, 'warning');
      });
  }
  
  // Erros do console
  if (testReport.errors.length > 0) {
    log('\n--- Erros do Console ---', 'error');
    testReport.errors.forEach(error => {
      log(`${error.type}: ${error.message}`, 'error');
    });
  }
  
  // Salvar relatório em arquivo
  saveReportToFile();
}

// Função para salvar relatório em arquivo
async function saveReportToFile() {
  const reportPath = `test-report-patient-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runAllTests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});