#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'http://localhost:4000';

async function testPasswordChange() {
  console.log('=== Teste de Alteração de Senha ===\n');

  try {
    // 1. Fazer login com as credenciais atuais
    console.log('1. Fazendo login com lucas.canova@hotmail.com...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'lucas.canova@hotmail.com',
        password: '123456' // Senha atual
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('❌ Erro no login:', error);
      return;
    }

    const loginData = await loginResponse.json();
    const authToken = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso\n');

    // 2. Tentar alterar a senha
    console.log('2. Alterando senha para 666666...');
    const changePasswordResponse = await fetch(`${API_URL}/api/users/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authToken
      },
      body: JSON.stringify({
        currentPassword: '123456',
        newPassword: '666666'
      })
    });

    if (!changePasswordResponse.ok) {
      const error = await changePasswordResponse.json();
      console.error('❌ Erro ao alterar senha:', error);
      return;
    }

    console.log('✅ Senha alterada com sucesso\n');

    // 3. Fazer logout
    console.log('3. Fazendo logout...');
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': authToken
      }
    });
    console.log('✅ Logout realizado\n');

    // 4. Tentar login com a senha antiga (deve falhar)
    console.log('4. Tentando login com senha antiga (deve falhar)...');
    const oldPasswordLogin = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'lucas.canova@hotmail.com',
        password: '123456'
      })
    });

    if (oldPasswordLogin.ok) {
      console.error('❌ ERRO: Login com senha antiga funcionou (não deveria)');
    } else {
      console.log('✅ Login com senha antiga falhou (esperado)');
    }

    // 5. Tentar login com a nova senha (deve funcionar)
    console.log('\n5. Tentando login com nova senha...');
    const newPasswordLogin = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'lucas.canova@hotmail.com',
        password: '666666'
      })
    });

    if (!newPasswordLogin.ok) {
      const error = await newPasswordLogin.json();
      console.error('❌ Erro no login com nova senha:', error);
      return;
    }

    console.log('✅ Login com nova senha realizado com sucesso!');
    console.log('\n🎉 Todos os testes passaram! A alteração de senha está funcionando corretamente.');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar o teste
testPasswordChange();