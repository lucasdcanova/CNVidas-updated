#!/bin/bash

echo "🚀 Iniciando CNVidas Development Environment..."
echo "============================================="

# Kill any existing processes
echo "🧹 Limpando processos existentes..."
pkill -f "tsx watch server" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend server
echo "🖥️  Iniciando servidor backend na porta 3000..."
npx tsx server/index.ts &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Aguardando servidor backend iniciar..."
sleep 5

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Servidor backend rodando!"
else
    echo "❌ Falha ao iniciar servidor backend"
    exit 1
fi

# Start frontend
echo "🎨 Iniciando cliente Vite na porta 5173..."
cd client && npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo ""
echo "============================================="
echo "✅ Ambiente de desenvolvimento iniciado!"
echo ""
echo "🖥️  Backend: http://localhost:3000"
echo "🎨 Frontend: http://localhost:5173"
echo ""
echo "📧 Login: dr@lucascanova.com"
echo "🔑 Senha: qweasdzxc123"
echo ""
echo "Para parar, pressione Ctrl+C"
echo "============================================="

# Keep script running
wait