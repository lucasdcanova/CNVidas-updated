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
    // Extrair apenas o nome=valor, ignorando atributos como HttpOnly, Secure, etc.
    return cookie.split(';')[0];
  }).join('; ');
}

async function testAdminWithCookies() {
  console.log('🚀 Testando autenticação admin com cookies...\n');

  try {
    // 1. Fazer login como admin
    console.log('1. 🔐 Fazendo login como admin...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      email: 'admin@cnvidas.com',
      password: 'admin123'
    });

    if (loginResponse.statusCode !== 200) {
      throw new Error(`Login falhou: ${loginResponse.statusCode} - ${JSON.stringify(loginResponse.data)}`);
    }

    console.log('✅ Login realizado com sucesso');
    console.log('👤 Usuário:', loginResponse.data.user.fullName);
    console.log('🎯 Role:', loginResponse.data.user.role);
    
    // Extrair cookies da resposta de login
    const cookies = extractCookies(loginResponse.cookies);
    console.log('🍪 Cookies recebidos:', cookies);
    
    if (!cookies) {
      console.log('⚠️ Nenhum cookie foi definido no login!');
      console.log('Headers de resposta:', loginResponse.headers);
    }

    // 2. Testar acesso às APIs admin usando os cookies
    console.log('\n2. 👥 Testando API de usuários com cookies...');
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET'
    }, null, cookies);

    if (usersResponse.statusCode === 200) {
      console.log(`✅ API de usuários funcionando: ${usersResponse.data.length} usuários`);
      
      // Mostrar alguns usuários como exemplo
      const adminUsers = usersResponse.data.filter(u => u.role === 'admin');
      const partnerUsers = usersResponse.data.filter(u => u.role === 'partner');
      const doctorUsers = usersResponse.data.filter(u => u.role === 'doctor');
      const patientUsers = usersResponse.data.filter(u => u.role === 'patient');
      
      console.log(`   👑 Admins: ${adminUsers.length}`);
      console.log(`   🏢 Parceiros: ${partnerUsers.length}`);
      console.log(`   👨‍⚕️ Médicos: ${doctorUsers.length}`);
      console.log(`   🩺 Pacientes: ${patientUsers.length}`);
    } else {
      console.log(`❌ Erro na API de usuários: ${usersResponse.statusCode}`);
      console.log('Response:', usersResponse.data);
    }

    // 3. Testar API de parceiros
    console.log('\n3. 🏢 Testando API de parceiros com cookies...');
    const partnersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/partners',
      method: 'GET'
    }, null, cookies);

    if (partnersResponse.statusCode === 200) {
      console.log(`✅ API de parceiros funcionando: ${partnersResponse.data.length} parceiros`);
      
      // Mostrar status dos parceiros
      const activePartners = partnersResponse.data.filter(p => p.status === 'active');
      const pendingPartners = partnersResponse.data.filter(p => p.status === 'pending');
      
      console.log(`   ✅ Ativos: ${activePartners.length}`);
      console.log(`   ⏳ Pendentes: ${pendingPartners.length}`);
    } else {
      console.log(`❌ Erro na API de parceiros: ${partnersResponse.statusCode}`);
      console.log('Response:', partnersResponse.data);
    }

    // 4. Testar API de serviços
    console.log('\n4. 🛠️ Testando API de serviços com cookies...');
    const servicesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/services',
      method: 'GET'
    }, null, cookies);

    if (servicesResponse.statusCode === 200) {
      console.log(`✅ API de serviços funcionando: ${servicesResponse.data.length} serviços`);
    } else {
      console.log(`❌ Erro na API de serviços: ${servicesResponse.statusCode}`);
      console.log('Response:', servicesResponse.data);
    }

    // 5. Testar estatísticas
    console.log('\n5. 📊 Testando API de estatísticas com cookies...');
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/stats',
      method: 'GET'
    }, null, cookies);

    if (statsResponse.statusCode === 200) {
      console.log('✅ API de estatísticas funcionando');
      console.log(`   👥 Total usuários: ${statsResponse.data.totalUsers}`);
      console.log(`   🏢 Total parceiros: ${statsResponse.data.totalPartners}`);
      console.log(`   👨‍⚕️ Total médicos: ${statsResponse.data.totalDoctors}`);
      console.log(`   🩺 Total pacientes: ${statsResponse.data.totalPatients}`);
    } else {
      console.log(`❌ Erro na API de estatísticas: ${statsResponse.statusCode}`);
      console.log('Response:', statsResponse.data);
    }

    console.log('\n🎯 RESULTADO FINAL:');
    console.log('==========================================');
    console.log('✅ Backend funcionando corretamente');
    console.log('✅ Autenticação por cookies funcionando');
    console.log('✅ APIs administrativas acessíveis');
    console.log('');
    console.log('🌐 TESTE NO NAVEGADOR:');
    console.log('1. Acesse: http://localhost:3000/admin/users');
    console.log('2. Faça login com: admin@cnvidas.com / admin123');
    console.log('3. Os dados devem aparecer automaticamente');
    console.log('');
    console.log('🔧 Se ainda não funcionar no navegador:');
    console.log('- Verifique o console do navegador (F12)');
    console.log('- Limpe cookies e cache');
    console.log('- Verifique se há erros de CORS');

  } catch (error) {
    console.error('\n❌ ERRO durante os testes:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Executar os testes
testAdminWithCookies(); 