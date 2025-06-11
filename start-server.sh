#!/bin/bash
npm run dev &
echo "Servidor iniciado em background. PID: $!"
echo "Acesse http://localhost:3000"
echo "Para parar o servidor, use: kill $!"