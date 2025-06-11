import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

async function testRegistration(userType) {
  const timestamp = Date.now();
  const testData = {
    email: `test${userType}${timestamp}@example.com`,
    username: `test${userType}${timestamp}`,
    password: 'Test123456!',
    fullName: `Test ${userType.charAt(0).toUpperCase() + userType.slice(1)} User`,
    role: userType,
    acceptTerms: true,
    acceptPrivacy: true,
    acceptContract: true,  // Para pacientes
    acceptPartnerContract: true  // Para parceiros
  };

  // Adicionar campos específicos por tipo
  if (userType === 'doctor') {
    testData.licenseNumber = `CRM${timestamp}`;
    testData.specialization = 'Clínica Geral';
  } else if (userType === 'partner') {
    testData.businessName = `Test Business ${timestamp}`;
    testData.businessType = 'clinic';
  }

  console.log(`\n🧪 Testando registro de ${userType}...`);
  console.log('Dados:', testData);

  try {
    const response = await axios.post(`${API_URL}/register`, testData);
    console.log(`✅ Sucesso! ${userType} registrado:`, response.data);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao registrar ${userType}:`, error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Iniciando testes de registro...\n');
  
  const userTypes = ['patient', 'doctor', 'partner'];
  const results = [];

  for (const userType of userTypes) {
    const success = await testRegistration(userType);
    results.push({ userType, success });
    
    // Aguardar um pouco entre os testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Resumo dos testes:');
  results.forEach(({ userType, success }) => {
    console.log(`${success ? '✅' : '❌'} ${userType}: ${success ? 'OK' : 'FALHOU'}`);
  });
}

runTests();