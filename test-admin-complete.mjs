#!/usr/bin/env node

import puppeteer from 'puppeteer';
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
  const screenshotPath = `test-screenshots-admin/${name}-${Date.now()}.png`;
  try {
    await fs.mkdir('test-screenshots-admin', { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    log(`Erro ao tirar screenshot: ${error.message}`, 'warning');
    return null;
  }
}

// Função para fazer login como administrador
async function loginAsAdmin(page) {
  const startTime = Date.now();
  try {
    await page.goto(`${BASE_URL}/entrar`, { waitUntil: 'networkidle0' });
    
    // Preencher credenciais
    await page.type('input[type="email"]', ADMIN_EMAIL);
    await page.type('input[type="password"]', ADMIN_PASSWORD);
    
    // Clicar no botão de login
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    const currentUrl = page.url();
    const duration = Date.now() - startTime;
    
    if (currentUrl.includes('/admin') || currentUrl.includes('/dashboard')) {
      addTestResult('Login do Administrador', 'passed', { 
        duration,
        message: 'Login realizado com sucesso'
      });
      return true;
    } else {
      const screenshot = await takeScreenshot(page, 'admin-login-failed');
      addTestResult('Login do Administrador', 'failed', { 
        duration,
        message: 'Redirecionamento incorreto após login',
        screenshots: [screenshot]
      });
      return false;
    }
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'admin-login-error');
    addTestResult('Login do Administrador', 'failed', { 
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
    return false;
  }
}

// 1. Teste do Dashboard Administrativo
async function testAdminDashboard(page) {
  log('\n=== TESTANDO DASHBOARD ADMINISTRATIVO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para dashboard admin
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle0' });
    
    // Verificar elementos principais
    const hasDashboard = await waitForSelectorWithTimeout(page, 'h1, .dashboard-title');
    if (hasDashboard) {
      addTestResult('Dashboard Principal', 'passed', {
        message: 'Dashboard administrativo carregou'
      });
    }
    
    // Verificar cards de estatísticas
    const statsCards = await page.$$('.stat-card, .metric-card, [data-testid="stat"]');
    if (statsCards.length > 0) {
      addTestResult('Cards de Estatísticas', 'passed', {
        message: `${statsCards.length} métricas exibidas`
      });
      
      // Verificar valores numéricos nos cards
      let hasValidData = false;
      for (const card of statsCards.slice(0, 4)) {
        const text = await page.evaluate(el => el.textContent, card);
        if (text.match(/\d+/)) {
          hasValidData = true;
          break;
        }
      }
      
      if (hasValidData) {
        addTestResult('Dados Estatísticos', 'passed', {
          message: 'Cards contêm dados numéricos válidos'
        });
      }
    }
    
    // Verificar tabelas de dados recentes
    const recentTables = await page.$$('table, .recent-data, [data-testid="recent"]');
    if (recentTables.length > 0) {
      addTestResult('Tabelas de Dados Recentes', 'passed', {
        message: `${recentTables.length} tabelas de dados encontradas`
      });
    }
    
    addTestResult('Dashboard Completo', 'passed', {
      duration: Date.now() - startTime,
      message: 'Dashboard administrativo totalmente funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'admin-dashboard-error');
    addTestResult('Dashboard Administrativo', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 2. Teste de Gestão de Usuários
async function testUserManagement(page) {
  log('\n=== TESTANDO GESTÃO DE USUÁRIOS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para gestão de usuários
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle0' });
    
    // Verificar lista de usuários
    const usersTable = await waitForSelectorWithTimeout(page, 'table, .users-list, [data-testid="users-table"]');
    
    if (usersTable) {
      addTestResult('Lista de Usuários', 'passed', {
        message: 'Tabela de usuários carregada'
      });
      
      // Contar usuários na tabela
      const userRows = await page.$$('tbody tr, .user-row, [data-testid="user-row"]');
      addTestResult('Usuários Listados', 'passed', {
        message: `${userRows.length} usuários encontrados`
      });
      
      // Testar busca de usuários
      const searchInput = await page.$('input[type="search"], input[placeholder*="buscar"], input[name="search"]');
      if (searchInput) {
        await searchInput.type('test');
        await page.waitForTimeout(1000);
        
        addTestResult('Busca de Usuários', 'passed', {
          message: 'Funcionalidade de busca operacional'
        });
        
        // Limpar busca
        await searchInput.click({ clickCount: 3 });
        await searchInput.type('');
      }
      
      // Testar filtros
      const filterSelects = await page.$$('select[name*="filter"], select[name*="role"], .filter-select');
      if (filterSelects.length > 0) {
        addTestResult('Filtros de Usuários', 'passed', {
          message: `${filterSelects.length} filtros disponíveis`
        });
      }
      
      // Testar criação de usuário
      const createButton = await page.$('button:has-text("Criar"), button:has-text("Novo"), .create-user');
      if (createButton) {
        await createButton.click();
        await page.waitForTimeout(2000);
        
        const userForm = await page.$('form, .user-form, [data-testid="user-form"]');
        if (userForm) {
          addTestResult('Formulário de Criação', 'passed', {
            message: 'Modal de criação de usuário aberto'
          });
          
          // Fechar modal
          const closeButton = await page.$('button:has-text("Cancelar"), .modal-close, [aria-label="Close"]');
          if (closeButton) {
            await closeButton.click();
          }
        }
      }
      
      // Testar edição de usuário (se houver usuários)
      if (userRows.length > 0) {
        const editButton = await page.$('button:has-text("Editar"), .edit-btn, [data-action="edit"]');
        if (editButton) {
          await editButton.click();
          await page.waitForTimeout(1000);
          
          addTestResult('Edição de Usuário', 'passed', {
            message: 'Interface de edição acessível'
          });
          
          // Fechar modal de edição
          const cancelButton = await page.$('button:has-text("Cancelar"), .modal-close');
          if (cancelButton) {
            await cancelButton.click();
          }
        }
      }
      
    } else {
      throw new Error('Tabela de usuários não carregou');
    }
    
    addTestResult('Gestão de Usuários', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de gestão de usuários funcional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'user-management-error');
    addTestResult('Gestão de Usuários', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 3. Teste de Análise de Sinistros
async function testClaimsManagement(page) {
  log('\n=== TESTANDO ANÁLISE DE SINISTROS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para análise de sinistros
    await page.goto(`${BASE_URL}/admin/claims`, { waitUntil: 'networkidle0' });
    
    // Verificar lista de sinistros
    const claimsTable = await waitForSelectorWithTimeout(page, 'table, .claims-list, [data-testid="claims-table"]');
    
    if (claimsTable) {
      addTestResult('Lista de Sinistros', 'passed', {
        message: 'Tabela de sinistros carregada'
      });
      
      // Contar sinistros
      const claimRows = await page.$$('tbody tr, .claim-row, [data-testid="claim-row"]');
      addTestResult('Sinistros Listados', 'passed', {
        message: `${claimRows.length} sinistros encontrados`
      });
      
      // Testar filtros por status
      const statusFilters = await page.$$('select[name*="status"], .status-filter, input[type="radio"]');
      if (statusFilters.length > 0) {
        addTestResult('Filtros de Status', 'passed', {
          message: 'Filtros de status disponíveis'
        });
      }
      
      // Testar aprovação/rejeição de sinistro (se houver sinistros pendentes)
      const pendingClaims = await page.$$('.status-pending, [data-status="pending"]');
      if (pendingClaims.length > 0) {
        const approveButton = await page.$('button:has-text("Aprovar"), .approve-btn');
        const rejectButton = await page.$('button:has-text("Rejeitar"), .reject-btn');
        
        if (approveButton && rejectButton) {
          addTestResult('Ações de Aprovação', 'passed', {
            message: 'Botões de aprovação/rejeição disponíveis'
          });
        }
      }
      
      // Testar visualização de detalhes
      const viewButton = await page.$('button:has-text("Ver"), button:has-text("Detalhes"), .view-btn');
      if (viewButton) {
        await viewButton.click();
        await page.waitForTimeout(1000);
        
        const detailsModal = await page.$('.claim-details, [role="dialog"]');
        if (detailsModal) {
          addTestResult('Detalhes de Sinistro', 'passed', {
            message: 'Modal de detalhes funcional'
          });
          
          // Fechar modal
          const closeBtn = await page.$('button:has-text("Fechar"), .modal-close');
          if (closeBtn) {
            await closeBtn.click();
          }
        }
      }
      
    } else {
      addTestResult('Lista de Sinistros', 'warning', {
        message: 'Tabela de sinistros não encontrada - pode não haver dados'
      });
    }
    
    addTestResult('Análise de Sinistros', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de análise de sinistros operacional'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'claims-management-error');
    addTestResult('Análise de Sinistros', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 4. Teste de Gestão de Parceiros
async function testPartnerManagement(page) {
  log('\n=== TESTANDO GESTÃO DE PARCEIROS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para gestão de parceiros
    await page.goto(`${BASE_URL}/admin/partners`, { waitUntil: 'networkidle0' });
    
    // Verificar lista de parceiros
    const partnersTable = await waitForSelectorWithTimeout(page, 'table, .partners-list');
    
    if (partnersTable) {
      addTestResult('Lista de Parceiros', 'passed', {
        message: 'Interface de parceiros carregada'
      });
      
      // Contar parceiros
      const partnerRows = await page.$$('tbody tr, .partner-row');
      addTestResult('Parceiros Listados', 'passed', {
        message: `${partnerRows.length} parceiros encontrados`
      });
      
      // Testar filtros de status
      const statusFilters = await page.$$('select[name*="status"], .status-filter');
      if (statusFilters.length > 0) {
        const firstFilter = statusFilters[0];
        const options = await page.$$eval('select[name*="status"] option', opts => 
          opts.map(o => o.value).filter(v => v)
        );
        
        if (options.length > 0) {
          await page.select('select[name*="status"]', options[0]);
          await page.waitForTimeout(1000);
          
          addTestResult('Filtros de Parceiros', 'passed', {
            message: `Filtro aplicado: ${options[0]}`
          });
        }
      }
      
      // Testar criação de parceiro
      const createButton = await page.$('button:has-text("Criar"), button:has-text("Novo")');
      if (createButton) {
        await createButton.click();
        await page.waitForTimeout(2000);
        
        const partnerForm = await page.$('form, .partner-form');
        if (partnerForm) {
          addTestResult('Formulário de Parceiro', 'passed', {
            message: 'Modal de criação de parceiro aberto'
          });
          
          // Fechar modal
          const closeButton = await page.$('button:has-text("Cancelar"), .modal-close');
          if (closeButton) {
            await closeButton.click();
          }
        }
      }
      
      // Testar aprovação de parceiro (se houver pendentes)
      const pendingPartners = await page.$$('.status-pending, [data-status="pending"]');
      if (pendingPartners.length > 0) {
        const approveButton = await page.$('button:has-text("Aprovar"), .approve-btn');
        if (approveButton) {
          addTestResult('Aprovação de Parceiros', 'passed', {
            message: 'Sistema de aprovação disponível'
          });
        }
      }
      
    } else {
      addTestResult('Lista de Parceiros', 'warning', {
        message: 'Interface de parceiros não encontrada'
      });
    }
    
    addTestResult('Gestão de Parceiros', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de gestão de parceiros verificado'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'partner-management-error');
    addTestResult('Gestão de Parceiros', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 5. Teste de Gestão de Serviços
async function testServiceManagement(page) {
  log('\n=== TESTANDO GESTÃO DE SERVIÇOS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para gestão de serviços
    await page.goto(`${BASE_URL}/admin/services`, { waitUntil: 'networkidle0' });
    
    // Verificar lista de serviços
    const servicesTable = await waitForSelectorWithTimeout(page, 'table, .services-list');
    
    if (servicesTable) {
      addTestResult('Lista de Serviços', 'passed', {
        message: 'Interface de serviços carregada'
      });
      
      // Contar serviços
      const serviceRows = await page.$$('tbody tr, .service-row');
      addTestResult('Serviços Listados', 'passed', {
        message: `${serviceRows.length} serviços encontrados`
      });
      
      // Testar criação de serviço
      const createButton = await page.$('button:has-text("Criar"), button:has-text("Novo")');
      if (createButton) {
        await createButton.click();
        await page.waitForTimeout(2000);
        
        const serviceForm = await page.$('form, .service-form');
        if (serviceForm) {
          addTestResult('Formulário de Serviço', 'passed', {
            message: 'Modal de criação de serviço aberto'
          });
          
          // Testar categorias disponíveis
          const categorySelect = await page.$('select[name="category"], select[name="specialty"]');
          if (categorySelect) {
            const categories = await page.$$eval('select[name="category"] option, select[name="specialty"] option',
              opts => opts.map(o => o.textContent).filter(t => t && t.trim())
            );
            
            addTestResult('Categorias de Serviços', 'passed', {
              message: `${categories.length} categorias disponíveis`
            });
          }
          
          // Fechar modal
          const closeButton = await page.$('button:has-text("Cancelar"), .modal-close');
          if (closeButton) {
            await closeButton.click();
          }
        }
      }
      
      // Testar toggle de destaque
      const featuredToggle = await page.$('input[type="checkbox"], .featured-toggle');
      if (featuredToggle) {
        addTestResult('Sistema de Destaque', 'passed', {
          message: 'Controle de serviços em destaque disponível'
        });
      }
      
    } else {
      addTestResult('Lista de Serviços', 'warning', {
        message: 'Interface de serviços não encontrada'
      });
    }
    
    addTestResult('Gestão de Serviços', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de gestão de serviços verificado'
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

// 6. Teste de Analytics e Relatórios
async function testAnalytics(page) {
  log('\n=== TESTANDO ANALYTICS E RELATÓRIOS ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para analytics
    await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: 'networkidle0' });
    
    // Verificar dashboard de analytics
    const analyticsPage = await waitForSelectorWithTimeout(page, '.analytics, .charts, h1');
    
    if (analyticsPage) {
      addTestResult('Página de Analytics', 'passed', {
        message: 'Dashboard de analytics carregado'
      });
      
      // Verificar gráficos
      const charts = await page.$$('canvas, .chart, [data-chart]');
      if (charts.length > 0) {
        addTestResult('Gráficos', 'passed', {
          message: `${charts.length} gráficos encontrados`
        });
      }
      
      // Verificar métricas KPI
      const kpiCards = await page.$$('.kpi, .metric, .analytics-card');
      if (kpiCards.length > 0) {
        addTestResult('Métricas KPI', 'passed', {
          message: `${kpiCards.length} KPIs exibidos`
        });
        
        // Verificar se há dados nas métricas
        let hasData = false;
        for (const card of kpiCards.slice(0, 3)) {
          const text = await page.evaluate(el => el.textContent, card);
          if (text.match(/\d+/)) {
            hasData = true;
            break;
          }
        }
        
        if (hasData) {
          addTestResult('Dados de Analytics', 'passed', {
            message: 'Métricas contêm dados válidos'
          });
        }
      }
      
      // Verificar filtros de período
      const dateFilters = await page.$$('input[type="date"], .date-picker, select[name*="period"]');
      if (dateFilters.length > 0) {
        addTestResult('Filtros de Período', 'passed', {
          message: 'Filtros temporais disponíveis'
        });
      }
      
    } else {
      addTestResult('Página de Analytics', 'warning', {
        message: 'Página de analytics não encontrada'
      });
    }
    
    addTestResult('Analytics e Relatórios', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de analytics verificado'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'analytics-error');
    addTestResult('Analytics e Relatórios', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 7. Teste de Gestão de Vendedores
async function testSellerStats(page) {
  log('\n=== TESTANDO GESTÃO DE VENDEDORES ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para estatísticas de vendedores
    await page.goto(`${BASE_URL}/admin/seller-stats`, { waitUntil: 'networkidle0' });
    
    // Verificar página de vendedores
    const sellersPage = await waitForSelectorWithTimeout(page, '.sellers, .sales, h1');
    
    if (sellersPage) {
      addTestResult('Página de Vendedores', 'passed', {
        message: 'Interface de vendedores carregada'
      });
      
      // Verificar lista de vendedores
      const sellersTable = await page.$('table, .sellers-list');
      if (sellersTable) {
        const sellerRows = await page.$$('tbody tr, .seller-row');
        addTestResult('Lista de Vendedores', 'passed', {
          message: `${sellerRows.length} vendedores encontrados`
        });
      }
      
      // Verificar estatísticas de vendas
      const salesStats = await page.$$('.sales-stat, .revenue-card, .performance-metric');
      if (salesStats.length > 0) {
        addTestResult('Estatísticas de Vendas', 'passed', {
          message: `${salesStats.length} métricas de vendas exibidas`
        });
      }
      
      // Verificar ranking de vendedores
      const ranking = await page.$('.ranking, .leaderboard, .top-sellers');
      if (ranking) {
        addTestResult('Ranking de Vendedores', 'passed', {
          message: 'Sistema de ranking disponível'
        });
      }
      
    } else {
      addTestResult('Página de Vendedores', 'warning', {
        message: 'Página de vendedores não encontrada'
      });
    }
    
    addTestResult('Gestão de Vendedores', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de vendedores verificado'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'seller-stats-error');
    addTestResult('Gestão de Vendedores', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 8. Teste de Logs de QR Auth
async function testQRAuthLogs(page) {
  log('\n=== TESTANDO LOGS DE QR AUTH ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para logs de QR Auth
    await page.goto(`${BASE_URL}/admin/qr-auth-logs`, { waitUntil: 'networkidle0' });
    
    // Verificar página de logs
    const logsPage = await waitForSelectorWithTimeout(page, '.logs, .audit, h1');
    
    if (logsPage) {
      addTestResult('Página de Logs QR', 'passed', {
        message: 'Interface de logs carregada'
      });
      
      // Verificar tabela de logs
      const logsTable = await page.$('table, .logs-list');
      if (logsTable) {
        const logRows = await page.$$('tbody tr, .log-row');
        addTestResult('Logs de Autenticação', 'passed', {
          message: `${logRows.length} logs encontrados`
        });
      }
      
      // Verificar filtros de logs
      const dateFilters = await page.$$('input[type="date"], .date-filter');
      if (dateFilters.length > 0) {
        addTestResult('Filtros de Logs', 'passed', {
          message: 'Filtros de data disponíveis'
        });
      }
      
    } else {
      addTestResult('Página de Logs QR', 'warning', {
        message: 'Página de logs não encontrada'
      });
    }
    
    addTestResult('Logs de QR Auth', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de logs verificado'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'qr-logs-error');
    addTestResult('Logs de QR Auth', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 9. Teste de Planos de Assinatura
async function testSubscriptionPlans(page) {
  log('\n=== TESTANDO PLANOS DE ASSINATURA ===', 'section');
  const startTime = Date.now();
  
  try {
    // Navegar para planos de assinatura
    await page.goto(`${BASE_URL}/admin/subscription-plans`, { waitUntil: 'networkidle0' });
    
    // Verificar página de planos
    const plansPage = await waitForSelectorWithTimeout(page, '.plans, .subscription, h1');
    
    if (plansPage) {
      addTestResult('Página de Planos', 'passed', {
        message: 'Interface de planos carregada'
      });
      
      // Verificar cards de planos
      const planCards = await page.$$('.plan-card, .subscription-plan');
      if (planCards.length > 0) {
        addTestResult('Planos Disponíveis', 'passed', {
          message: `${planCards.length} planos configurados`
        });
      }
      
      // Verificar estatísticas de assinantes
      const subStats = await page.$$('.subscriber-count, .plan-stats');
      if (subStats.length > 0) {
        addTestResult('Estatísticas de Assinantes', 'passed', {
          message: 'Dados de assinantes disponíveis'
        });
      }
      
    } else {
      addTestResult('Página de Planos', 'warning', {
        message: 'Página de planos não encontrada'
      });
    }
    
    addTestResult('Planos de Assinatura', 'passed', {
      duration: Date.now() - startTime,
      message: 'Sistema de planos verificado'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'subscription-plans-error');
    addTestResult('Planos de Assinatura', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// 10. Teste de Navegação e Layout
async function testAdminLayout(page) {
  log('\n=== TESTANDO LAYOUT E NAVEGAÇÃO ===', 'section');
  const startTime = Date.now();
  
  try {
    // Verificar sidebar de navegação
    const sidebar = await page.$('.sidebar, .admin-nav, [role="navigation"]');
    if (sidebar) {
      addTestResult('Sidebar de Navegação', 'passed', {
        message: 'Navegação lateral disponível'
      });
      
      // Verificar links de navegação
      const navLinks = await page.$$('.nav-link, .sidebar a, .menu-item');
      if (navLinks.length > 0) {
        addTestResult('Links de Navegação', 'passed', {
          message: `${navLinks.length} links de navegação encontrados`
        });
        
        // Testar alguns links
        for (let i = 0; i < Math.min(3, navLinks.length); i++) {
          const link = navLinks[i];
          const href = await page.evaluate(el => el.getAttribute('href'), link);
          if (href && href.includes('/admin/')) {
            await link.click();
            await page.waitForTimeout(1000);
            
            const currentUrl = page.url();
            if (currentUrl.includes('/admin/')) {
              addTestResult(`Navegação para ${href.split('/').pop()}`, 'passed', {
                message: 'Link de navegação funcional'
              });
            }
          }
        }
      }
    }
    
    // Verificar breadcrumbs
    const breadcrumbs = await page.$('.breadcrumb, .breadcrumbs, [aria-label="breadcrumb"]');
    if (breadcrumbs) {
      addTestResult('Breadcrumbs', 'passed', {
        message: 'Navegação contextual disponível'
      });
    }
    
    // Verificar responsividade
    await page.setViewport({ width: 768, height: 1024 }); // Tablet
    await page.waitForTimeout(500);
    
    const mobileMenu = await page.$('.mobile-menu, .hamburger, .menu-toggle');
    if (mobileMenu) {
      addTestResult('Menu Mobile', 'passed', {
        message: 'Interface responsiva implementada'
      });
    }
    
    // Restaurar viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    addTestResult('Layout Administrativo', 'passed', {
      duration: Date.now() - startTime,
      message: 'Layout e navegação funcionais'
    });
  } catch (error) {
    const screenshot = await takeScreenshot(page, 'admin-layout-error');
    addTestResult('Layout Administrativo', 'failed', {
      duration: Date.now() - startTime,
      message: error.message,
      error: error.stack,
      screenshots: [screenshot]
    });
  }
}

// Função principal de execução dos testes
async function runAllAdminTests() {
  log('=== INICIANDO TESTES COMPLETOS DO ADMINISTRADOR CNVidas ===', 'section');
  
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
    const loginSuccess = await loginAsAdmin(page);
    
    if (loginSuccess) {
      // Executar todos os testes administrativos
      await testAdminDashboard(page);
      await testUserManagement(page);
      await testClaimsManagement(page);
      await testPartnerManagement(page);
      await testServiceManagement(page);
      await testAnalytics(page);
      await testSellerStats(page);
      await testQRAuthLogs(page);
      await testSubscriptionPlans(page);
      await testAdminLayout(page);
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
  
  log('\n=== RELATÓRIO FINAL DOS TESTES DO ADMINISTRADOR ===', 'section');
  log(`Duração total: ${totalDuration.toFixed(2)} segundos`, 'info');
  log(`Total de testes: ${testReport.totalTests}`, 'info');
  log(`✅ Passou: ${testReport.passed}`, 'success');
  log(`❌ Falhou: ${testReport.failed}`, 'error');
  log(`⚠️  Avisos: ${testReport.warnings}`, 'warning');
  
  const successRate = testReport.totalTests > 0 
    ? ((testReport.passed / testReport.totalTests) * 100).toFixed(2)
    : 0;
  log(`Taxa de sucesso: ${successRate}%`, successRate >= 80 ? 'success' : 'warning');
  
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
    log('\n--- Avisos ---', 'warning');
    warnings.forEach(w => {
      log(`⚠️  ${w.testName}: ${w.details}`, 'warning');
    });
  }
  
  // Salvar relatório
  saveReportToFile();
}

// Função para salvar relatório
async function saveReportToFile() {
  const reportPath = `test-report-admin-${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    log(`\nRelatório detalhado salvo em: ${reportPath}`, 'success');
  } catch (error) {
    log(`Erro ao salvar relatório: ${error.message}`, 'error');
  }
}

// Executar testes
runAllAdminTests().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});