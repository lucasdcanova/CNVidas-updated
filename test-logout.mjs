#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api';

async function testLogout() {
  console.log('=== Teste de Logout ===\n');

  try {
    // 1. Fazer login
    console.log('1. Fazendo login...');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@cnvidas.com',
        password: 'admin123456'
      }),
    });

    if (!loginResponse.ok) {
      console.error('Erro no login:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('Login bem-sucedido:', loginData.message);

    // Capturar cookies do login
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log('\nCookies recebidos no login:');
    console.log(setCookieHeader);

    // Extrair o cookie auth_token
    const cookies = setCookieHeader ? setCookieHeader.split(',').map(c => c.trim()) : [];
    const authTokenCookie = cookies.find(c => c.startsWith('auth_token='));
    
    if (!authTokenCookie) {
      console.error('Cookie auth_token não foi definido no login');
      return;
    }

    console.log('\nCookie auth_token:', authTokenCookie);

    // 2. Verificar autenticação
    console.log('\n2. Verificando autenticação...');
    const verifyResponse = await fetch(`${API_URL}/auth/user`, {
      headers: {
        'Cookie': authTokenCookie.split(';')[0], // Enviar apenas o auth_token
      },
    });

    if (verifyResponse.ok) {
      const userData = await verifyResponse.json();
      console.log('Usuário autenticado:', userData.email);
    } else {
      console.error('Erro ao verificar autenticação');
    }

    // 3. Fazer logout
    console.log('\n3. Fazendo logout...');
    const logoutResponse = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': authTokenCookie.split(';')[0],
        'Content-Type': 'application/json',
      },
    });

    if (!logoutResponse.ok) {
      console.error('Erro no logout:', await logoutResponse.text());
      return;
    }

    const logoutData = await logoutResponse.json();
    console.log('Logout response:', logoutData);

    // Verificar cookies retornados no logout
    const logoutCookies = logoutResponse.headers.get('set-cookie');
    console.log('\nCookies no logout:');
    console.log(logoutCookies);

    // 4. Tentar acessar rota autenticada após logout
    console.log('\n4. Tentando acessar rota autenticada após logout...');
    const afterLogoutResponse = await fetch(`${API_URL}/auth/user`, {
      headers: {
        'Cookie': authTokenCookie.split(';')[0], // Usar o cookie antigo
      },
    });

    if (afterLogoutResponse.ok) {
      console.error('❌ ERRO: Ainda consegue acessar rota autenticada após logout!');
      const userData = await afterLogoutResponse.json();
      console.error('Dados do usuário ainda acessíveis:', userData);
    } else {
      console.log('✅ SUCESSO: Acesso negado após logout (status:', afterLogoutResponse.status, ')');
    }

    // 5. Verificar se o cookie foi realmente limpo
    console.log('\n5. Analisando remoção do cookie...');
    if (logoutCookies) {
      const clearedCookies = logoutCookies.split(',').map(c => c.trim());
      const authTokenCleared = clearedCookies.find(c => c.startsWith('auth_token='));
      
      if (authTokenCleared) {
        console.log('Cookie auth_token no logout:', authTokenCleared);
        
        // Verificar se tem valor vazio
        if (authTokenCleared.includes('auth_token=;') || authTokenCleared.includes('auth_token="";')) {
          console.log('✅ Cookie foi definido como vazio');
        }
        
        // Verificar se tem Max-Age=0 ou expires no passado
        if (authTokenCleared.includes('Max-Age=0') || authTokenCleared.includes('expires=Thu, 01 Jan 1970')) {
          console.log('✅ Cookie tem expiração imediata');
        }
      }
    }

  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// Executar o teste
testLogout();