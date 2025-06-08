const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function updateDoctorPassword() {
  console.log('🔧 ATUALIZANDO SENHA DO MÉDICO dr@lucascanova.com');
  console.log('================================================');
  
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
    
    // 2. Buscar o usuário médico
    console.log('\n2. Buscando usuário dr@lucascanova.com...');
    const usersResponse = await axios.get(`${BASE_URL}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-auth-token': adminToken
      },
      withCredentials: true
    });
    
    if (usersResponse.status === 200) {
      const users = usersResponse.data.users;
      const doctorUser = users.find(user => user.email === 'dr@lucascanova.com');
      
      if (doctorUser) {
        console.log('✅ Usuário encontrado:');
        console.log(`   ID: ${doctorUser.id}`);
        console.log(`   Email: ${doctorUser.email}`);
        console.log(`   Role: ${doctorUser.role}`);
        console.log(`   Nome: ${doctorUser.fullName}`);
        
        // 3. Atualizar a senha
        console.log('\n3. Atualizando senha...');
        
        try {
          const updateResponse = await axios.put(`${BASE_URL}/api/admin/users/${doctorUser.id}`, {
            password: 'password123'
          }, {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'x-auth-token': adminToken,
              'Content-Type': 'application/json'
            },
            withCredentials: true
          });
          
          if (updateResponse.status === 200) {
            console.log('✅ Senha atualizada com sucesso!');
            
            // 4. Testar login com nova senha
            console.log('\n4. Testando login com nova senha...');
            
            const loginTest = await axios.post(`${BASE_URL}/api/login`, {
              email: 'dr@lucascanova.com',
              password: 'password123'
            }, {
              withCredentials: true
            });
            
            if (loginTest.status === 200) {
              console.log('✅ Login do médico bem-sucedido!');
              console.log(`   Email: dr@lucascanova.com`);
              console.log(`   Senha: password123`);
              console.log(`   Role: ${loginTest.data.user.role}`);
              console.log(`   ID: ${loginTest.data.user.id}`);
              
              // 5. Verificar se tem perfil de médico
              console.log('\n5. Verificando perfil de médico...');
              
              const doctorToken = loginTest.data.token;
              const profileResponse = await axios.get(`${BASE_URL}/api/doctors/user/${loginTest.data.user.id}`, {
                headers: {
                  'Authorization': `Bearer ${doctorToken}`,
                  'x-auth-token': doctorToken
                },
                withCredentials: true
              });
              
              if (profileResponse.status === 200) {
                console.log('✅ Perfil de médico encontrado!');
                console.log(`   ID do perfil: ${profileResponse.data.id}`);
                console.log(`   Especialização: ${profileResponse.data.specialization || 'Não informado'}`);
                console.log(`   CRM: ${profileResponse.data.licenseNumber || 'Não informado'}`);
              }
              
            } else {
              console.log('❌ Falha no login após atualização da senha');
            }
            
          } else {
            console.log('❌ Falha ao atualizar senha');
          }
          
        } catch (updateError) {
          console.log('❌ Erro ao atualizar senha:', updateError.response?.data || updateError.message);
        }
        
      } else {
        console.log('❌ Usuário dr@lucascanova.com não encontrado');
        console.log('\n💡 Usuários médicos disponíveis:');
        const doctors = users.filter(user => user.role === 'doctor');
        doctors.forEach((doctor, index) => {
          console.log(`   ${index + 1}. ${doctor.email} (ID: ${doctor.id})`);
        });
      }
      
    } else {
      console.log('❌ Falha ao buscar usuários');
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.response?.data || error.message);
  }
}

// Executar atualização
updateDoctorPassword().catch(console.error); 