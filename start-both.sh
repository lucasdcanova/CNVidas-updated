#!/bin/bash

# Kill any existing processes
echo "🧹 Limpando processos existentes..."
pkill -f "node" 2>/dev/null
pkill -f "tsx" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend
echo "🖥️  Iniciando servidor backend..."
npm run dev:server &
BACKEND_PID=$!

# Wait for backend
echo "⏳ Aguardando backend iniciar..."
sleep 5

# Start frontend
echo "🎨 Iniciando frontend..."
cd client && npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================="
echo "✅ Servidores iniciados!"
echo ""
echo "🖥️  Backend: http://localhost:8080"
echo "🎨 Frontend: http://localhost:5173"
echo ""
echo "Para parar, pressione Ctrl+C"
echo "============================================="

# Keep running
wait