#!/bin/bash
cd "/Users/lucascanova/Documents/CNVidas 1.0/CNVidas-updated"

echo "🏥 CNVidas - Iniciando servidor de produção..."

# Build do cliente se não existir
if [ ! -d "dist/client" ]; then
  echo "📦 Criando build do frontend..."
  npm run build:client
fi

# Configurar ambiente de produção
export NODE_ENV=production
export PORT=3000

echo "🚀 Iniciando servidor..."
npm start