#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'http://localhost:4000';

async function testUserData() {
  console.log('=== Teste de Dados do Usuário ===\n');

  try {
    // 1. Fazer login
    console.log('1. Fazendo login com lucas.canova@hotmail.com...');
    const loginResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'lucas.canova@hotmail.com',
        password: '123456'
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('❌ Erro no login:', error);
      return;
    }

    const loginData = await loginResponse.json();
    const authToken = loginResponse.headers.get('set-cookie');
    
    console.log('✅ Login realizado com sucesso');
    console.log('📋 Dados retornados no login:', JSON.stringify(loginData, null, 2));
    console.log('\n🔍 Plano de assinatura:', loginData.subscriptionPlan);
    console.log('🔍 Status da assinatura:', loginData.subscriptionStatus);

    // 2. Verificar dados do usuário autenticado
    console.log('\n2. Verificando dados do usuário via /api/user...');
    const userResponse = await fetch(`${API_URL}/api/user`, {
      method: 'GET',
      headers: {
        'Cookie': authToken
      }
    });

    if (!userResponse.ok) {
      const error = await userResponse.json();
      console.error('❌ Erro ao buscar dados do usuário:', error);
      return;
    }

    const userData = await userResponse.json();
    console.log('📋 Dados retornados de /api/user:', JSON.stringify(userData, null, 2));
    console.log('\n🔍 Plano de assinatura:', userData.subscriptionPlan);
    console.log('🔍 Status da assinatura:', userData.subscriptionStatus);

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar o teste
testUserData();