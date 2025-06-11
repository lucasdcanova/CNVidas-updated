#!/bin/bash
cd "/Users/lucascanova/Documents/CNVidas 1.0/CNVidas-updated"

echo "🚀 Iniciando servidor CNVidas..."
echo "📍 Diretório: $(pwd)"
echo "🔧 Node version: $(node -v)"
echo "📦 NPM version: $(npm -v)"

# Definir variáveis de ambiente
export NODE_ENV=development
export PORT=3000

# Iniciar servidor
echo "▶️  Executando npm run dev..."
npm run dev