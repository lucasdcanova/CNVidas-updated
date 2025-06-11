// Script para iniciar o servidor diretamente sem watch
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor CNVidas...');
console.log('📍 Diretório:', __dirname);
console.log('🔧 Node:', process.version);

// Configurar ambiente
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.PORT || '3000';

// Executar servidor diretamente com tsx
const serverPath = path.join(__dirname, 'server', 'index.ts');
console.log('📄 Arquivo:', serverPath);

const server = spawn('npx', ['tsx', serverPath], {
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
});

server.on('exit', (code) => {
  console.log(`Servidor finalizado com código ${code}`);
});

// Capturar sinais para encerrar gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit();
});