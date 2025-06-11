#!/bin/bash
echo "🔄 Parando processos anteriores..."
pkill -f "npm run dev"
pkill -f "tsx watch"
sleep 2

echo "🚀 Iniciando servidor..."
cd "/Users/lucascanova/Documents/CNVidas 1.0/CNVidas-updated"

# Executar o servidor
npm run dev