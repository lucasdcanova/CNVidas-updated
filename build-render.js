import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Iniciando build para Render...');

try {
  // 1. Limpar diretório dist
  console.log('🧹 Limpando diretório dist...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // 2. Gerar Prisma Client
  console.log('📦 Gerando Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // 3. Compilar TypeScript do servidor
  console.log('🔨 Compilando servidor TypeScript...');
  execSync('npx tsc --project tsconfig.production.json', { stdio: 'inherit' });

  // 4. Build do cliente Vite
  console.log('⚡ Building cliente com Vite...');
  execSync('cd client && npm run build', { stdio: 'inherit' });

  // 5. Criar diretórios necessários
  console.log('📁 Criando diretórios necessários...');
  fs.mkdirSync('dist/server/uploads', { recursive: true });
  fs.mkdirSync('dist/client', { recursive: true });

  // 6. Copiar arquivos estáticos do cliente
  console.log('📋 Copiando arquivos do cliente...');
  if (fs.existsSync('client/dist')) {
    execSync('cp -r client/dist/* dist/client/', { stdio: 'inherit' });
  }

  // 7. Copiar schema do Prisma
  console.log('📋 Copiando schema do Prisma...');
  fs.mkdirSync('dist/prisma', { recursive: true });
  fs.copyFileSync('prisma/schema.prisma', 'dist/prisma/schema.prisma');

  console.log('✅ Build concluído com sucesso!');
} catch (error) {
  console.error('❌ Erro durante o build:', error.message);
  process.exit(1);
}