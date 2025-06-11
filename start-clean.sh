#!/bin/bash
cd "/Users/lucascanova/Documents/CNVidas 1.0/CNVidas-updated"

echo "🧹 Limpando processos anteriores..."
pkill -f "node" 2>/dev/null || true
pkill -f "npm" 2>/dev/null || true
pkill -f "tsx" 2>/dev/null || true
sleep 2

echo "🚀 Iniciando servidor em modo desenvolvimento..."
export NODE_ENV=development
npm run dev 2>&1 | tee server.log