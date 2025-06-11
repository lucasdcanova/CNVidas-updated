import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';

async function testEmergencyAPI() {
  console.log('🧪 Testando API de consultas de emergência...\n');

  // Credenciais de teste
  const credentials = {
    email: 'lucas.canova@hotmail.com',
    password: 'Abc123456#' // Você precisará atualizar com a senha correta
  };

  try {
    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!loginResponse.ok) {
      console.error('❌ Erro no login:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login bem-sucedido!');
    console.log('   Token:', loginData.token ? 'Recebido' : 'Não recebido');

    const token = loginData.token;

    // 2. Buscar informações do usuário
    console.log('\n2️⃣ Buscando informações do usuário...');
    const userResponse = await fetch(`${API_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ Dados do usuário:');
      console.log(`   Nome: ${userData.full_name}`);
      console.log(`   Plano: ${userData.subscription_plan}`);
      console.log(`   Consultas de emergência: ${userData.emergency_consultations_left}`);
    } else {
      console.error('❌ Erro ao buscar dados do usuário:', await userResponse.text());
    }

    // 3. Verificar elegibilidade para emergência
    console.log('\n3️⃣ Verificando elegibilidade para consulta de emergência...');
    const eligibilityResponse = await fetch(`${API_URL}/emergency/patient/eligibility`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (eligibilityResponse.ok) {
      const eligibilityData = await eligibilityResponse.json();
      console.log('✅ Resposta de elegibilidade:');
      console.log(JSON.stringify(eligibilityData, null, 2));
    } else {
      console.error('❌ Erro ao verificar elegibilidade:', await eligibilityResponse.text());
    }

    // 4. Buscar médicos disponíveis
    console.log('\n4️⃣ Buscando médicos disponíveis para emergência...');
    const doctorsResponse = await fetch(`${API_URL}/emergency/patient/available-doctors`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (doctorsResponse.ok) {
      const doctorsData = await doctorsResponse.json();
      console.log('✅ Médicos disponíveis:', doctorsData.length);
      if (doctorsData.length > 0) {
        console.log('   Primeiro médico:', doctorsData[0].full_name || doctorsData[0].email);
      }
    } else {
      console.error('❌ Erro ao buscar médicos:', await doctorsResponse.text());
    }

    // 5. Verificar rotas de emergência
    console.log('\n5️⃣ Verificando outras rotas de emergência...');
    const routes = [
      '/emergency/patient/check-consultations',
      '/emergency/patient/status',
      '/telemedicine/emergency/check-eligibility'
    ];

    for (const route of routes) {
      try {
        const response = await fetch(`${API_URL}${route}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        console.log(`   ${route}: ${response.status} ${response.statusText}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`     Resposta:`, JSON.stringify(data, null, 2));
        }
      } catch (error) {
        console.log(`   ${route}: ❌ Erro - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar o teste
testEmergencyAPI();