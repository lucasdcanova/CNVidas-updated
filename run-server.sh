#!/bin/bash
cd "/Users/lucascanova/Documents/CNVidas 1.0/CNVidas-updated"

echo "🔄 CNVidas - Iniciando servidor..."
echo "📍 Diretório: $(pwd)"

# Limpar processos anteriores
echo "🧹 Limpando processos..."
pkill -f "node" 2>/dev/null || true
pkill -f "npm" 2>/dev/null || true
sleep 2

# Configurar ambiente
export NODE_ENV=development
export PORT=3000

echo "🚀 Iniciando servidor na porta $PORT..."
echo "📱 Acesse: http://localhost:$PORT"
echo ""

# Executar servidor
npm run dev