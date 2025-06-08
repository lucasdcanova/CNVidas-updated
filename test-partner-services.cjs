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

async function testPartnerServices() {
  console.log('🚀 Testando funcionalidade de serviços de parceiros...\n');

  try {
    // 1. Login do parceiro
    console.log('1. 🔐 Fazendo login do parceiro...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'partner-test@example.com',
      password: 'test123'
    });

    if (loginResponse.statusCode !== 200) {
      throw new Error(`Login falhou: ${loginResponse.statusCode}`);
    }

    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');

    // 2. Buscar serviços do parceiro específico
    console.log('\n2. 📋 Buscando serviços do parceiro logado...');
    const partnerServicesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/partners/my-services',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (partnerServicesResponse.statusCode !== 200) {
      throw new Error(`Busca de serviços do parceiro falhou: ${partnerServicesResponse.statusCode}`);
    }

    const partnerServices = partnerServicesResponse.data;
    console.log(`✅ Encontrados ${partnerServices.length} serviços do parceiro`);

    // 3. Buscar todos os serviços (para comparação)
    console.log('\n3. 🌐 Buscando todos os serviços (para comparação)...');
    const allServicesResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/services',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (allServicesResponse.statusCode !== 200) {
      throw new Error(`Busca de todos os serviços falhou: ${allServicesResponse.statusCode}`);
    }

    const allServices = allServicesResponse.data;
    console.log(`✅ Encontrados ${allServices.length} serviços totais`);

    // 4. Verificar que os serviços do parceiro são um subconjunto correto
    console.log('\n4. ✔️ Verificando se os serviços são apenas do parceiro...');
    
    // Obter partnerId do primeiro serviço (todos devem ter o mesmo partnerId)
    const expectedPartnerId = partnerServices[0]?.partnerId;
    if (!expectedPartnerId) {
      throw new Error('Nenhum serviço encontrado para o parceiro');
    }

    const invalidServices = partnerServices.filter(service => service.partnerId !== expectedPartnerId);
    if (invalidServices.length > 0) {
      throw new Error(`Encontrados ${invalidServices.length} serviços de outros parceiros na resposta!`);
    }

    console.log(`✅ Todos os ${partnerServices.length} serviços pertencem ao partnerId ${expectedPartnerId}`);

    // 5. Verificar que há outros serviços de outros parceiros
    const servicesFromOtherPartners = allServices.filter(service => service.partnerId !== expectedPartnerId);
    console.log(`✅ Existem ${servicesFromOtherPartners.length} serviços de outros parceiros (não mostrados)`);

    // 6. Exibir resumo dos serviços do parceiro
    console.log('\n📊 Resumo dos serviços do parceiro:');
    partnerServices.forEach((service, index) => {
      const regularPrice = (service.regularPrice / 100).toFixed(2);
      const discountPrice = (service.discountPrice / 100).toFixed(2);
      console.log(`  ${index + 1}. ${service.name}`);
      console.log(`     Categoria: ${service.category}`);
      console.log(`     Preço: R$ ${regularPrice} → R$ ${discountPrice} (${service.discountPercentage}% off)`);
      console.log(`     Status: ${service.isActive ? 'Ativo' : 'Inativo'}`);
    });

    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('📋 Resumo:');
    console.log(`   • Parceiro vê apenas seus próprios serviços: ${partnerServices.length}`);
    console.log(`   • Total de serviços no sistema: ${allServices.length}`);
    console.log(`   • Outros parceiros têm: ${servicesFromOtherPartners.length} serviços`);
    console.log('\n✅ A funcionalidade "Meus Serviços" está funcionando corretamente!');

  } catch (error) {
    console.error('\n❌ ERRO no teste:', error.message);
    process.exit(1);
  }
}

// Executar o teste
testPartnerServices(); 