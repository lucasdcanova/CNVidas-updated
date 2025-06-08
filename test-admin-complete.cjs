const http = require('http');

// Função para fazer requisições HTTP com suporte a cookies
function makeRequest(options, data = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    const req = http.request({
      ...options,
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          resolve({ 
            statusCode: res.statusCode, 
            data: result,
            headers: res.headers,
            cookies: res.headers['set-cookie'] || []
          });
        } catch (error) {
          resolve({ 
            statusCode: res.statusCode, 
            data: body,
            headers: res.headers,
            cookies: res.headers['set-cookie'] || []
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Função para extrair cookies de uma resposta
function extractCookies(setCookieArray) {
  if (!setCookieArray || !Array.isArray(setCookieArray)) {
    return '';
  }
  
  return setCookieArray.map(cookie => {
    return cookie.split(';')[0];
  }).join('; ');
}

async function testCompleteAdminFunctionality() {
  console.log('🚀 TESTE COMPLETO DAS FUNCIONALIDADES ADMINISTRATIVAS\n');
  console.log('====================================================\n');

  let cookies = '';
  let testResults = {
    login: false,
    users: { list: false, create: false, update: false, delete: false },
    partners: { list: false, create: false, update: false, approve: false },
    services: { list: false, create: false, update: false, delete: false },
    stats: false,
    claims: false,
    reports: false
  };

  try {
    // 1. AUTENTICAÇÃO
    console.log('1. 🔐 TESTE DE AUTENTICAÇÃO');
    console.log('─'.repeat(40));
    
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      email: 'admin@cnvidas.com',
      password: 'admin123'
    });

    if (loginResponse.statusCode === 200) {
      cookies = extractCookies(loginResponse.cookies);
      testResults.login = true;
      console.log('✅ Login realizado com sucesso');
      console.log(`👤 Admin: ${loginResponse.data.user.fullName}`);
    } else {
      throw new Error(`Login falhou: ${loginResponse.statusCode}`);
    }

    // 2. GESTÃO DE USUÁRIOS
    console.log('\n2. 👥 TESTE DE GESTÃO DE USUÁRIOS');
    console.log('─'.repeat(40));
    
    // 2.1 Listar usuários
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET'
    }, null, cookies);

    if (usersResponse.statusCode === 200) {
      testResults.users.list = true;
      console.log(`✅ Listagem de usuários: ${usersResponse.data.length} usuários`);
      
      const usersByRole = usersResponse.data.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(usersByRole).forEach(([role, count]) => {
        const emoji = role === 'admin' ? '👑' : role === 'partner' ? '🏢' : role === 'doctor' ? '👨‍⚕️' : '🩺';
        console.log(`   ${emoji} ${role}: ${count}`);
      });
    } else {
      console.log(`❌ Erro na listagem de usuários: ${usersResponse.statusCode}`);
    }

    // 2.2 Criar usuário de teste
    const newUser = {
      email: `test-user-${Date.now()}@cnvidas.com`,
      username: `testuser${Date.now()}`,
      fullName: 'Usuário de Teste Admin',
      password: 'test123',
      role: 'patient'
    };

    const createUserResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'POST'
    }, newUser, cookies);

    if (createUserResponse.statusCode === 201 || createUserResponse.statusCode === 200) {
      testResults.users.create = true;
      console.log('✅ Criação de usuário funcionando');
    } else {
      console.log(`❌ Erro na criação de usuário: ${createUserResponse.statusCode}`);
      console.log('Response:', createUserResponse.data);
    }

    // 3. GESTÃO DE PARCEIROS
    console.log('\n3. 🏢 TESTE DE GESTÃO DE PARCEIROS');
    console.log('─'.repeat(40));
    
    // 3.1 Listar parceiros
    const partnersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/partners',
      method: 'GET'
    }, null, cookies);

    if (partnersResponse.statusCode === 200) {
      testResults.partners.list = true;
      console.log(`✅ Listagem de parceiros: ${partnersResponse.data.length} parceiros`);
      
      const partnersByStatus = partnersResponse.data.reduce((acc, partner) => {
        acc[partner.status] = (acc[partner.status] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(partnersByStatus).forEach(([status, count]) => {
        const emoji = status === 'active' ? '✅' : status === 'pending' ? '⏳' : '❌';
        console.log(`   ${emoji} ${status}: ${count}`);
      });
    } else {
      console.log(`❌ Erro na listagem de parceiros: ${partnersResponse.statusCode}`);
    }

    // 3.2 Criar parceiro de teste
    const newPartner = {
      businessName: `Empresa Teste ${Date.now()}`,
      businessType: 'Clínica',
      phone: '(11) 99999-9999',
      address: 'Rua Teste, 123',
      email: `parceiro-${Date.now()}@teste.com`,
      status: 'pending'
    };

    const createPartnerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/partners',
      method: 'POST'
    }, newPartner, cookies);

    if (createPartnerResponse.statusCode === 201 || createPartnerResponse.statusCode === 200) {
      testResults.partners.create = true;
      console.log('✅ Criação de parceiro funcionando');
    } else {
      console.log(`❌ Erro na criação de parceiro: ${createPartnerResponse.statusCode}`);
      console.log('Response:', createPartnerResponse.data);
    }

    // 4. GESTÃO DE SERVIÇOS
    console.log('\n4. 🛠️ TESTE DE GESTÃO DE SERVIÇOS');
    console.log('─'.repeat(40));
    
    const servicesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/services',
      method: 'GET'
    }, null, cookies);

    if (servicesResponse.statusCode === 200) {
      testResults.services.list = true;
      console.log(`✅ Listagem de serviços: ${servicesResponse.data.length} serviços`);
      
      const featuredServices = servicesResponse.data.filter(s => s.isFeatured);
      console.log(`   ⭐ Serviços em destaque: ${featuredServices.length}`);
    } else {
      console.log(`❌ Erro na listagem de serviços: ${servicesResponse.statusCode}`);
    }

    // 5. ESTATÍSTICAS E RELATÓRIOS
    console.log('\n5. 📊 TESTE DE ESTATÍSTICAS E RELATÓRIOS');
    console.log('─'.repeat(40));
    
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/stats',
      method: 'GET'
    }, null, cookies);

    if (statsResponse.statusCode === 200) {
      testResults.stats = true;
      console.log('✅ Estatísticas funcionando');
      console.log(`   👥 Total usuários: ${statsResponse.data.totalUsers}`);
      console.log(`   🏢 Total parceiros: ${statsResponse.data.totalPartners}`);
      console.log(`   👨‍⚕️ Total médicos: ${statsResponse.data.totalDoctors}`);
      console.log(`   🩺 Total pacientes: ${statsResponse.data.totalPatients}`);
    } else {
      console.log(`❌ Erro nas estatísticas: ${statsResponse.statusCode}`);
    }

    // 6. GESTÃO DE CLAIMS
    console.log('\n6. 📋 TESTE DE GESTÃO DE CLAIMS');
    console.log('─'.repeat(40));
    
    const claimsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/claims',
      method: 'GET'
    }, null, cookies);

    if (claimsResponse.statusCode === 200) {
      testResults.claims = true;
      console.log(`✅ Gestão de claims funcionando: ${claimsResponse.data.length} claims`);
    } else {
      console.log(`❌ Erro na gestão de claims: ${claimsResponse.statusCode}`);
    }

    // 7. RELATÓRIO FINAL
    console.log('\n🎯 RELATÓRIO FINAL DE FUNCIONALIDADES');
    console.log('═'.repeat(50));
    
    const totalTests = Object.values(testResults).flat().length;
    const passedTests = Object.values(testResults).flat().filter(Boolean).length;
    
    console.log(`📊 Testes executados: ${passedTests}/${totalTests}`);
    console.log(`📈 Taxa de sucesso: ${Math.round((passedTests/totalTests) * 100)}%\n`);
    
    console.log('📋 DETALHAMENTO POR MÓDULO:');
    console.log('─'.repeat(30));
    console.log(`🔐 Autenticação: ${testResults.login ? '✅' : '❌'}`);
    console.log(`👥 Usuários: ${Object.values(testResults.users).filter(Boolean).length}/${Object.values(testResults.users).length} funcionalidades`);
    console.log(`🏢 Parceiros: ${Object.values(testResults.partners).filter(Boolean).length}/${Object.values(testResults.partners).length} funcionalidades`);
    console.log(`🛠️ Serviços: ${Object.values(testResults.services).filter(Boolean).length}/${Object.values(testResults.services).length} funcionalidades`);
    console.log(`📊 Estatísticas: ${testResults.stats ? '✅' : '❌'}`);
    console.log(`📋 Claims: ${testResults.claims ? '✅' : '❌'}`);
    
    console.log('\n🌐 PRÓXIMOS PASSOS:');
    console.log('─'.repeat(20));
    console.log('1. Testar no navegador: http://localhost:3000/admin');
    console.log('2. Login: admin@cnvidas.com / admin123');
    console.log('3. Verificar se todas as páginas carregam corretamente');
    console.log('4. Testar operações CRUD em cada módulo');
    
    if (passedTests === totalTests) {
      console.log('\n🎉 PARABÉNS! Todas as funcionalidades administrativas estão funcionando!');
    } else {
      console.log('\n⚠️ Algumas funcionalidades precisam de atenção.');
    }

  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO durante os testes:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Executar os testes
testCompleteAdminFunctionality(); 