const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function createDoctorUser() {
  console.log('🏥 CRIANDO USUÁRIO MÉDICO PARA TESTES');
  console.log('===================================');
  
  try {
    // 1. Fazer login como admin
    console.log('\n1. Fazendo login como admin...');
    const adminLogin = await axios.post(`${BASE_URL}/api/login`, {
      email: 'admin@cnvidas.com',
      password: 'admin123'
    }, {
      withCredentials: true
    });
    
    if (adminLogin.status !== 200) {
      console.log('❌ Falha no login do admin');
      return;
    }
    
    console.log('✅ Login do admin bem-sucedido');
    const adminToken = adminLogin.data.token;
    
    // 2. Criar usuário médico
    console.log('\n2. Criando usuário médico...');
    
    const timestamp = Date.now();
    const doctorData = {
      email: `dr.teste.${timestamp}@cnvidas.com`,
      password: 'password123',
      fullName: 'Dr. João Silva',
      username: `dr.joao.${timestamp}`,
      role: 'doctor',
      emailVerified: true
    };
    
    try {
      const createResponse = await axios.post(`${BASE_URL}/api/admin/users`, doctorData, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-auth-token': adminToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      if (createResponse.status === 201) {
        console.log('✅ Usuário médico criado com sucesso!');
        console.log('   Email:', doctorData.email);
        console.log('   Senha:', doctorData.password);
        console.log('   ID:', createResponse.data.user?.id || createResponse.data.id);
        console.log('   Role:', createResponse.data.user?.role || 'doctor');
        
        // 3. Testar login do médico
        console.log('\n3. Testando login do médico...');
        
        const doctorLogin = await axios.post(`${BASE_URL}/api/login`, {
          email: doctorData.email,
          password: doctorData.password
        }, {
          withCredentials: true
        });
        
        if (doctorLogin.status === 200) {
          console.log('✅ Login do médico bem-sucedido!');
          console.log('   Token presente:', !!doctorLogin.data.token);
          console.log('   Role confirmado:', doctorLogin.data.user.role);
          console.log('   ID do usuário:', doctorLogin.data.user.id);
          
          // 4. Criar perfil de médico
          console.log('\n4. Criando perfil de médico...');
          
          const doctorProfileData = {
            userId: doctorLogin.data.user.id,
            specialty: 'Clínica Geral',
            crm: '123456-SP',
            bio: 'Médico especialista em clínica geral com 10 anos de experiência.',
            phone: '(11) 99999-9999',
            address: 'Rua das Flores, 123 - São Paulo, SP'
          };
          
          // Usar a API de criação direta do storage
          const profileResponse = await axios.post(`${BASE_URL}/api/admin/doctors`, doctorProfileData, {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'x-auth-token': adminToken,
              'Content-Type': 'application/json'
            },
            withCredentials: true
          });
          
          if (profileResponse.status === 201) {
            console.log('✅ Perfil de médico criado com sucesso!');
            console.log('   ID do perfil:', profileResponse.data.id);
            console.log('   Especialidade:', profileResponse.data.specialty);
            console.log('   CRM:', profileResponse.data.crm);
          }
          
        } else {
          console.log('❌ Falha no login do médico');
        }
        
      } else {
        console.log('❌ Falha ao criar usuário médico');
        console.log('   Status:', createResponse.status);
        console.log('   Dados:', createResponse.data);
      }
      
    } catch (createError) {
      console.log('❌ Erro ao criar usuário médico:', createError.response?.data || createError.message);
      
      // Se o usuário já existe, tentar fazer login
      if (createError.response?.status === 400 && createError.response?.data?.error?.includes('já existe')) {
        console.log('\n⚠️ Usuário já existe. Testando login...');
        
        try {
          const existingLogin = await axios.post(`${BASE_URL}/api/login`, {
            email: doctorData.email,
            password: doctorData.password
          }, {
            withCredentials: true
          });
          
          if (existingLogin.status === 200) {
            console.log('✅ Login com usuário existente bem-sucedido!');
            console.log('   Email:', doctorData.email);
            console.log('   Senha:', doctorData.password);
            console.log('   Role:', existingLogin.data.user.role);
            console.log('   ID:', existingLogin.data.user.id);
          }
        } catch (loginError) {
          console.log('❌ Falha no login com usuário existente');
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.response?.data || error.message);
  }
}

// Função para verificar usuários existentes
async function checkExistingDoctors() {
  console.log('\n\n🔍 VERIFICANDO MÉDICOS EXISTENTES');
  console.log('================================');
  
  // Tentar alguns emails comuns de médicos
  const possibleDoctors = [
    { email: 'dr@lucascanova.com', passwords: ['password123', 'admin123', '123456'] },
    { email: 'doctor@cnvidas.com', passwords: ['password123', 'admin123', '123456'] },
    { email: 'medico@cnvidas.com', passwords: ['password123', 'admin123', '123456'] },
    { email: 'dr.teste@cnvidas.com', passwords: ['password123', 'admin123', '123456'] }
  ];
  
  for (const doctor of possibleDoctors) {
    console.log(`\n🧪 Testando: ${doctor.email}`);
    
    for (const password of doctor.passwords) {
      try {
        const response = await axios.post(`${BASE_URL}/api/login`, {
          email: doctor.email,
          password: password
        }, {
          withCredentials: true
        });
        
        if (response.status === 200) {
          console.log(`   ✅ SUCESSO!`);
          console.log(`   Email: ${doctor.email}`);
          console.log(`   Senha: ${password}`);
          console.log(`   Role: ${response.data.user.role}`);
          console.log(`   ID: ${response.data.user.id}`);
          
          if (response.data.user.role === 'doctor') {
            console.log('   🎯 MÉDICO ENCONTRADO! Use este para os testes.');
          }
          break;
        }
      } catch (error) {
        // Silenciar erros - apenas mostrar sucessos
      }
    }
  }
}

// Executar funções
checkExistingDoctors()
  .then(() => createDoctorUser())
  .catch(console.error); 