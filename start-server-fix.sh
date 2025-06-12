#!/bin/bash

echo "🚀 Iniciando servidor CNVidas com correções..."
echo "============================================"

# Limpar processos anteriores
pkill -f "tsx|node" 2>/dev/null || true
sleep 2

# Definir variáveis de ambiente
export NODE_ENV=development
export PORT=3000

# Iniciar servidor sem watch mode (que pode estar causando problemas)
echo "📦 Compilando e iniciando servidor..."
npx tsx server/index.ts

# Nota: Este script não retorna porque o servidor fica rodando