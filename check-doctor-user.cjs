const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function checkDoctorUsers() {
  console.log('🔍 VERIFICANDO USUÁRIOS MÉDICOS NO SISTEMA');
  console.log('=========================================');
  
  try {
    // Fazer login como admin primeiro
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
    
    // Buscar todos os usuários
    console.log('\n2. Buscando todos os usuários...');
    const response = await axios.get(`${BASE_URL}/api/admin/users`, {
      withCredentials: true
    });
    
    if (response.status === 200 && response.data.users) {
      const allUsers = response.data.users;
      const doctors = allUsers.filter(user => user.role === 'doctor');
      
      console.log(`\n📊 ESTATÍSTICAS:`);
      console.log(`   Total de usuários: ${allUsers.length}`);
      console.log(`   Médicos encontrados: ${doctors.length}`);
      
      if (doctors.length > 0) {
        console.log('\n👨‍⚕️ MÉDICOS NO SISTEMA:');
        doctors.forEach((doctor, index) => {
          console.log(`   ${index + 1}. Email: ${doctor.email}`);
          console.log(`      ID: ${doctor.id}`);
          console.log(`      Nome: ${doctor.fullName || 'Não informado'}`);
          console.log(`      Verificado: ${doctor.emailVerified ? 'Sim' : 'Não'}`);
          console.log(`      Criado em: ${doctor.createdAt}`);
          console.log('');
        });
        
        // Testar login com o primeiro médico
        const firstDoctor = doctors[0];
        console.log(`\n🧪 TESTANDO LOGIN COM: ${firstDoctor.email}`);
        
        // Tentar algumas senhas comuns
        const possiblePasswords = ['password123', 'admin123', '123456', 'password'];
        
        for (const password of possiblePasswords) {
          try {
            console.log(`   Tentando senha: ${password}`);
            const loginTest = await axios.post(`${BASE_URL}/api/login`, {
              email: firstDoctor.email,
              password: password
            }, {
              withCredentials: true
            });
            
            if (loginTest.status === 200) {
              console.log(`   ✅ SUCESSO! Senha correta: ${password}`);
              console.log(`   Token: ${loginTest.data.token ? 'Presente' : 'Ausente'}`);
              console.log(`   Dados do usuário:`, loginTest.data.user);
              break;
            }
          } catch (error) {
            console.log(`   ❌ Falha com senha: ${password}`);
          }
        }
      } else {
        console.log('\n⚠️ NENHUM MÉDICO ENCONTRADO NO SISTEMA');
        console.log('\n💡 SUGESTÃO: Criar um usuário médico para testes');
        
        // Criar um médico de teste
        console.log('\n🔧 CRIANDO MÉDICO DE TESTE...');
        
        try {
          const createUser = await axios.post(`${BASE_URL}/api/admin/users`, {
            email: 'dr.teste@cnvidas.com',
            password: 'password123',
            fullName: 'Dr. Teste da Silva',
            role: 'doctor',
            emailVerified: true
          }, {
            withCredentials: true
          });
          
          if (createUser.status === 201) {
            console.log('✅ Médico de teste criado com sucesso!');
            console.log('   Email: dr.teste@cnvidas.com');
            console.log('   Senha: password123');
            console.log('   ID:', createUser.data.user.id);
          }
        } catch (createError) {
          console.log('❌ Erro ao criar médico de teste:', createError.response?.data || createError.message);
        }
      }
    } else {
      console.log('❌ Falha ao buscar usuários');
    }
    
  } catch (error) {
    console.log('❌ Erro:', error.response?.data || error.message);
  }
}

// Verificar também usuários específicos que podem ser médicos
async function checkSpecificUsers() {
  console.log('\n\n🔍 VERIFICANDO USUÁRIOS ESPECÍFICOS');
  console.log('==================================');
  
  const possibleDoctors = [
    'dr@lucascanova.com',
    'doctor@cnvidas.com',
    'medico@cnvidas.com',
    'dr.teste@cnvidas.com'
  ];
  
  for (const email of possibleDoctors) {
    console.log(`\n🧪 Testando: ${email}`);
    
    const passwords = ['password123', 'admin123', '123456'];
    
    for (const password of passwords) {
      try {
        const response = await axios.post(`${BASE_URL}/api/login`, {
          email: email,
          password: password
        }, {
          withCredentials: true
        });
        
        if (response.status === 200) {
          console.log(`   ✅ LOGIN SUCESSO!`);
          console.log(`   Email: ${email}`);
          console.log(`   Senha: ${password}`);
          console.log(`   Role: ${response.data.user.role}`);
          console.log(`   ID: ${response.data.user.id}`);
          break;
        }
      } catch (error) {
        // Silenciar erros de login - apenas reportar sucessos
      }
    }
  }
}

// Executar verificações
checkDoctorUsers()
  .then(() => checkSpecificUsers())
  .catch(console.error); 