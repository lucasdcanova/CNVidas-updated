require('dotenv').config();
const fetch = require('node-fetch');

async function debugServicesAPI() {
  try {
    console.log('🔍 Testando API de serviços...\n');
    
    // 1. Teste sem parâmetros
    console.log('1️⃣ Teste sem parâmetros (http://localhost:8080/api/services):');
    const response1 = await fetch('http://localhost:8080/api/services');
    const data1 = await response1.json();
    console.log(`   Status: ${response1.status}`);
    console.log(`   Serviços retornados: ${Array.isArray(data1) ? data1.length : 'Erro'}`);
    if (data1.length > 0) {
      console.log(`   Primeiro serviço: ${data1[0].name}`);
    }
    
    // 2. Teste com cidade específica
    console.log('\n2️⃣ Teste com userCity=Três Passos:');
    const response2 = await fetch('http://localhost:8080/api/services?userCity=Três%20Passos');
    const data2 = await response2.json();
    console.log(`   Status: ${response2.status}`);
    console.log(`   Serviços retornados: ${Array.isArray(data2) ? data2.length : 'Erro'}`);
    if (data2.length > 0) {
      console.log('   Primeiros 3 serviços:');
      data2.slice(0, 3).forEach((s, i) => {
        console.log(`     ${i+1}. ${s.name} - Nacional: ${s.isNational ? 'Sim' : 'Não'} - Distância: ${s.distance || 'N/A'}km`);
      });
    }
    
    // 3. Teste com autenticação (simulando usuário logado)
    console.log('\n3️⃣ Teste com token de autenticação:');
    // Vamos primeiro fazer login para obter um token
    const loginResponse = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lucasrcanova@gmail.com', // Ajuste para um email válido
        password: 'Arisca2324@' // Ajuste para uma senha válida
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      const token = loginData.token;
      
      const response3 = await fetch('http://localhost:8080/api/services', {
        headers: {
          'X-Auth-Token': token
        }
      });
      const data3 = await response3.json();
      console.log(`   Status: ${response3.status}`);
      console.log(`   Serviços retornados: ${Array.isArray(data3) ? data3.length : 'Erro'}`);
      console.log(`   Cidade do usuário: ${loginData.user?.city || 'N/A'}`);
    } else {
      console.log(`   Erro no login: ${loginResponse.status}`);
    }
    
    // 4. Verificar serviços nacionais
    console.log('\n4️⃣ Verificando serviços nacionais no banco:');
    const { pool } = require('./dist/server/db');
    const nationalResult = await pool.query('SELECT id, name FROM partner_services WHERE is_national = true AND is_active = true');
    console.log(`   Serviços nacionais: ${nationalResult.rows.length}`);
    nationalResult.rows.forEach(s => {
      console.log(`     - ${s.name} (ID: ${s.id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

debugServicesAPI();