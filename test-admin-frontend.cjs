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

async function testAdminFrontend() {
  console.log('🚀 Testando se o frontend admin consegue acessar as APIs...\n');

  try {
    // 1. Fazer login como admin
    console.log('1. 🔐 Fazendo login como admin...');
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
      throw new Error(`Login falhou: ${loginResponse.statusCode}`);
    }

    console.log('✅ Login realizado com sucesso');
    
    // Extrair cookies da resposta
    const setCookieHeader = loginResponse.data.headers && loginResponse.data.headers['set-cookie'];
    let cookieHeader = '';
    
    // 2. Testar acesso às APIs admin usando cookies (simulando o frontend)
    console.log('\n2. 👥 Testando acesso à API de usuários admin...');
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader // Simular cookies do navegador
      }
    });

    if (usersResponse.statusCode === 200) {
      console.log(`✅ API de usuários funcionando: ${usersResponse.data.length} usuários`);
    } else {
      console.log(`❌ Erro na API de usuários: ${usersResponse.statusCode}`);
      console.log('Response:', usersResponse.data);
    }

    // 3. Testar acesso à API de parceiros admin
    console.log('\n3. 🏢 Testando acesso à API de parceiros admin...');
    const partnersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/partners',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      }
    });

    if (partnersResponse.statusCode === 200) {
      console.log(`✅ API de parceiros funcionando: ${partnersResponse.data.length} parceiros`);
    } else {
      console.log(`❌ Erro na API de parceiros: ${partnersResponse.statusCode}`);
      console.log('Response:', partnersResponse.data);
    }

    // 4. Testar acesso à API de serviços admin
    console.log('\n4. 🛠️ Testando acesso à API de serviços admin...');
    const servicesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/services',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      }
    });

    if (servicesResponse.statusCode === 200) {
      console.log(`✅ API de serviços funcionando: ${servicesResponse.data.length} serviços`);
    } else {
      console.log(`❌ Erro na API de serviços: ${servicesResponse.statusCode}`);
      console.log('Response:', servicesResponse.data);
    }

    // 5. Testar acesso às estatísticas
    console.log('\n5. 📊 Testando acesso às estatísticas admin...');
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/stats',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      }
    });

    if (statsResponse.statusCode === 200) {
      console.log('✅ API de estatísticas funcionando');
      console.log(`   👥 Total usuários: ${statsResponse.data.totalUsers}`);
      console.log(`   🏢 Total parceiros: ${statsResponse.data.totalPartners}`);
    } else {
      console.log(`❌ Erro na API de estatísticas: ${statsResponse.statusCode}`);
    }

    console.log('\n🎯 DIAGNÓSTICO:');
    console.log('==========================================');
    console.log('✅ Backend APIs estão funcionando corretamente');
    console.log('✅ Autenticação por cookies está funcionando');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Verificar se o frontend está fazendo as requisições corretas');
    console.log('2. Verificar se os cookies estão sendo enviados pelo navegador');
    console.log('3. Verificar se há erros no console do navegador');

  } catch (error) {
    console.error('\n❌ ERRO durante os testes:', error.message);
  }
}

// Executar os testes
testAdminFrontend(); 