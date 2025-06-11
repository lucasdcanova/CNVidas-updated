#\!/bin/bash
cd "/Users/lucascanova/Documents/CNVidas 1.0/CNVidas-updated"
export PORT=5001
export NODE_ENV=development
pkill -f "tsx.*server" || true
pkill -f "node.*server" || true
sleep 2
echo "Iniciando servidor na porta $PORT..."
node --import tsx server/index.ts
