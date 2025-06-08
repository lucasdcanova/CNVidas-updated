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

async function createAdminUser() {
  console.log('🔧 Criando usuário admin via API...\n');

  try {
    // Dados do usuário admin
    const adminData = {
      email: 'admin@cnvidas.com',
      password: 'admin123',
      fullName: 'Administrador CN Vidas',
      role: 'admin',
      username: 'admin'
    };

    console.log('1. 📝 Registrando usuário admin...');
    const registerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, adminData);

    if (registerResponse.statusCode === 201 || registerResponse.statusCode === 200) {
      console.log('✅ Usuário admin criado com sucesso!');
      console.log('📧 Email:', adminData.email);
      console.log('🔑 Senha:', adminData.password);
    } else if (registerResponse.statusCode === 400 && registerResponse.data.error && registerResponse.data.error.includes('já está cadastrado')) {
      console.log('✅ Usuário admin já existe!');
      console.log('📧 Email:', adminData.email);
      console.log('🔑 Senha:', adminData.password);
    } else {
      console.log('❌ Erro ao criar usuário admin:', registerResponse.statusCode);
      console.log('Response:', registerResponse.data);
    }

    // Tentar login para confirmar
    console.log('\n2. 🔐 Testando login do admin...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: adminData.email,
      password: adminData.password
    });

    if (loginResponse.statusCode === 200) {
      console.log('✅ Login de admin bem-sucedido!');
      console.log('🎯 Role:', loginResponse.data.user.role);
      console.log('👤 Nome:', loginResponse.data.user.fullName);
      return loginResponse.data.token;
    } else {
      console.log('❌ Erro no login do admin:', loginResponse.statusCode);
      console.log('Response:', loginResponse.data);
      
      // Tentar com outro admin
      console.log('\n3. 🔄 Tentando criar outro usuário admin...');
      const altAdminData = {
        email: 'test@admin.com',
        password: 'admin456',
        fullName: 'Test Admin',
        role: 'admin',
        username: 'testadmin'
      };

      const altRegisterResponse = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, altAdminData);

      console.log('Alt register response:', altRegisterResponse.statusCode, altRegisterResponse.data);

      if (altRegisterResponse.statusCode === 201 || altRegisterResponse.statusCode === 200) {
        const altLoginResponse = await makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }, {
          email: altAdminData.email,
          password: altAdminData.password
        });

        if (altLoginResponse.statusCode === 200) {
          console.log('✅ Login de admin alternativo bem-sucedido!');
          console.log('📧 Email:', altAdminData.email);
          console.log('🔑 Senha:', altAdminData.password);
          return altLoginResponse.data.token;
        }
      }

      return null;
    }

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    return null;
  }
}

// Executar o script
createAdminUser()
  .then((token) => {
    if (token) {
      console.log('\n🎉 Setup de admin concluído com sucesso!');
    } else {
      console.log('\n❌ Falha no setup de admin');
    }
  })
  .catch((error) => {
    console.error('Erro ao executar script:', error);
  }); 