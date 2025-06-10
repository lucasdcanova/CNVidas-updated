const http = require('http');

// Função para fazer requisições HTTP
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, data: result });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: body });
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

async function testAdminFunctions() {
  console.log('🚀 Testando funcionalidades administrativas da plataforma CN Vidas...\n');

  let adminToken;
  let testResults = {
    login: false,
    users: false,
    partners: false,
    services: false,
    userCreation: false,
    userUpdate: false,
    partnerCreation: false,
    serviceCreation: false,
    stats: false,
    claims: false,
    reports: false
  };

  try {
    // 1. Login como admin
    console.log('1. 🔐 Fazendo login como administrador...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'admin@cnvidas.com',
      password: 'admin123'
    });

    if (loginResponse.statusCode !== 200) {
      throw new Error(`Login falhou: ${loginResponse.statusCode} - ${JSON.stringify(loginResponse.data)}`);
    }

    adminToken = loginResponse.data.token;
    testResults.login = true;
    console.log('✅ Login realizado com sucesso');
    console.log(`   👤 Usuário: ${loginResponse.data.user.fullName}`);
    console.log(`   🎯 Role: ${loginResponse.data.user.role}`);

    // 2. Testar listagem de usuários
    console.log('\n2. 👥 Testando listagem de usuários...');
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (usersResponse.statusCode === 200) {
      testResults.users = true;
      console.log(`✅ ${usersResponse.data.length} usuários encontrados`);
      
      // Contar por tipo
      const usersByRole = usersResponse.data.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   📊 Distribuição por tipo:');
      Object.entries(usersByRole).forEach(([role, count]) => {
        console.log(`      ${role}: ${count}`);
      });
    } else {
      console.log(`❌ Erro ao listar usuários: ${usersResponse.statusCode}`);
    }

    // 3. Testar listagem de parceiros
    console.log('\n3. 🏢 Testando listagem de parceiros...');
    const partnersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/partners',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (partnersResponse.statusCode === 200) {
      testResults.partners = true;
      console.log(`✅ ${partnersResponse.data.length} parceiros encontrados`);
      
      // Contar por status
      const partnersByStatus = partnersResponse.data.reduce((acc, partner) => {
        acc[partner.status] = (acc[partner.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   📊 Status dos parceiros:');
      Object.entries(partnersByStatus).forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });
    } else {
      console.log(`❌ Erro ao listar parceiros: ${partnersResponse.statusCode}`);
    }

    // 4. Testar listagem de serviços
    console.log('\n4. 🛠️ Testando listagem de serviços...');
    const servicesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/services',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (servicesResponse.statusCode === 200) {
      testResults.services = true;
      console.log(`✅ ${servicesResponse.data.length} serviços encontrados`);
      
      // Contar por categoria
      const servicesByCategory = servicesResponse.data.reduce((acc, service) => {
        acc[service.category || 'sem categoria'] = (acc[service.category || 'sem categoria'] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   📊 Serviços por categoria:');
      Object.entries(servicesByCategory).forEach(([category, count]) => {
        console.log(`      ${category}: ${count}`);
      });
    } else {
      console.log(`❌ Erro ao listar serviços: ${servicesResponse.statusCode}`);
    }

    // 5. Testar criação de usuário
    console.log('\n5. ➕ Testando criação de usuário...');
    const newUserData = {
      email: `test-user-${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: 'test123',
      fullName: 'Usuário de Teste',
      role: 'patient',
      phone: '11999999999'
    };

    const createUserResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, newUserData);

    if (createUserResponse.statusCode === 201) {
      testResults.userCreation = true;
      console.log('✅ Usuário criado com sucesso');
      console.log(`   📧 Email: ${createUserResponse.data.email}`);
      console.log(`   🆔 ID: ${createUserResponse.data.id}`);
    } else {
      console.log(`❌ Erro ao criar usuário: ${createUserResponse.statusCode}`);
      console.log(`   Detalhes: ${JSON.stringify(createUserResponse.data)}`);
    }

    // 6. Testar criação de parceiro
    console.log('\n6. 🏢 Testando criação de parceiro...');
    const newPartnerData = {
      email: `partner-${Date.now()}@example.com`,
      businessName: 'Parceiro de Teste Ltda',
      businessType: 'Clínica',
      phone: '11888888888',
      address: 'Rua Teste, 123'
    };

    const createPartnerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/partners',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, newPartnerData);

    if (createPartnerResponse.statusCode === 201) {
      testResults.partnerCreation = true;
      console.log('✅ Parceiro criado com sucesso');
      console.log(`   🏢 Nome: ${createPartnerResponse.data.businessName}`);
      console.log(`   🆔 ID: ${createPartnerResponse.data.id}`);
    } else {
      console.log(`❌ Erro ao criar parceiro: ${createPartnerResponse.statusCode}`);
      console.log(`   Detalhes: ${JSON.stringify(createPartnerResponse.data)}`);
    }

    // 7. Testar estatísticas
    console.log('\n7. 📊 Testando estatísticas administrativas...');
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/stats',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (statsResponse.statusCode === 200) {
      testResults.stats = true;
      console.log('✅ Estatísticas obtidas com sucesso:');
      const stats = statsResponse.data;
      console.log(`   👥 Total de usuários: ${stats.totalUsers}`);
      console.log(`   🩺 Pacientes: ${stats.totalPatients}`);
      console.log(`   👨‍⚕️ Médicos: ${stats.totalDoctors}`);
      console.log(`   🏢 Parceiros: ${stats.totalPartners}`);
      console.log(`   ⚡ Administradores: ${stats.totalAdmins}`);
      console.log(`   💳 Usuários com assinatura: ${stats.subscribedUsers}`);
    } else {
      console.log(`❌ Erro ao obter estatísticas: ${statsResponse.statusCode}`);
    }

    // 8. Testar sinistros/claims
    console.log('\n8. 📋 Testando listagem de sinistros...');
    const claimsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/claims',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (claimsResponse.statusCode === 200) {
      testResults.claims = true;
      console.log(`✅ ${claimsResponse.data.length} sinistros encontrados`);
    } else {
      console.log(`❌ Erro ao listar sinistros: ${claimsResponse.statusCode}`);
    }

    // 9. Testar outras funcionalidades
    const additionalTests = [
      { name: 'Usuários recentes', path: '/api/admin/recent-users' },
      { name: 'Consultas pendentes', path: '/api/admin/pending-claims' },
      { name: 'Vendedores', path: '/api/admin/sellers' },
      { name: 'Logs de QR', path: '/api/admin/qr-auth-logs' }
    ];

    console.log('\n9. 🔍 Testando funcionalidades adicionais...');
    for (const test of additionalTests) {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: test.path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.statusCode === 200) {
        console.log(`✅ ${test.name}: OK`);
      } else {
        console.log(`❌ ${test.name}: Erro ${response.statusCode}`);
      }
    }

    // Resumo final
    console.log('\n🎯 RESUMO DOS TESTES:');
    console.log('==========================================');
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSOU' : 'FALHOU'}`);
    });
    
    console.log('==========================================');
    console.log(`📊 Resultado: ${passedTests}/${totalTests} testes passaram`);
    
    if (passedTests === totalTests) {
      console.log('🎉 TODAS as funcionalidades administrativas estão funcionando!');
    } else {
      console.log('⚠️ Algumas funcionalidades precisam de atenção.');
    }

  } catch (error) {
    console.error('\n❌ ERRO durante os testes:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Executar os testes
testAdminFunctions(); 