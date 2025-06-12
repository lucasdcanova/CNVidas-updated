const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor CNVidas...');
console.log('==============================');

// Mudar para o diretório correto
process.chdir(path.join(__dirname));

// Iniciar o servidor
const server = exec('npx tsx server/index.ts', (error, stdout, stderr) => {
  if (error) {
    console.error(`Erro: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
  }
  if (stdout) {
    console.log(`${stdout}`);
  }
});

// Capturar saída em tempo real
server.stdout.on('data', (data) => {
  console.log(data.toString());
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});

// Aguardar 3 segundos e verificar se o servidor está rodando
setTimeout(() => {
  const http = require('http');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`\n✅ Servidor está rodando em http://localhost:3000`);
    console.log(`Status: ${res.statusCode}`);
    console.log('\n📝 Credenciais de login:');
    console.log('Email: dr@lucascanova.com');
    console.log('Senha: qweasdzxc123');
    console.log('\n🌐 Abra http://localhost:3000 no seu navegador');
  });

  req.on('error', (e) => {
    console.error(`\n❌ Erro ao conectar: ${e.message}`);
    console.log('Verifique se o servidor iniciou corretamente.');
  });

  req.end();
}, 3000);

// Manter o processo rodando
process.stdin.resume();