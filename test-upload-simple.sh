#!/bin/bash

echo "🔍 Teste de Upload de Imagem de Perfil"
echo ""

# URL base
BASE_URL="http://localhost:8080"

# 1. Fazer login
echo "1️⃣ Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"lucas.canova@gmail.com","password":"Lucas123!@#"}')

# Extrair token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Erro no login"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login bem-sucedido!"
echo "   Token: ${TOKEN:0:30}..."

# 2. Fazer upload da imagem
echo ""
echo "2️⃣ Fazendo upload da imagem..."

# Verificar se existe uma imagem de teste
if [ -f "test-profile.jpg" ]; then
  IMAGE_FILE="test-profile.jpg"
elif [ -f "public/uploads/profile-ricardo-canova.jpg" ]; then
  IMAGE_FILE="public/uploads/profile-ricardo-canova.jpg"
else
  echo "❌ Nenhuma imagem de teste encontrada"
  exit 1
fi

echo "   Usando imagem: $IMAGE_FILE"

# Fazer o upload
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/profile/upload-image" \
  -H "X-Auth-Token: $TOKEN" \
  -H "Authorization: Bearer $TOKEN" \
  -F "profileImage=@$IMAGE_FILE")

echo "   Resposta: $UPLOAD_RESPONSE"

# 3. Verificar dados do usuário
echo ""
echo "3️⃣ Verificando dados do usuário..."

USER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/user" \
  -H "X-Auth-Token: $TOKEN" \
  -H "Authorization: Bearer $TOKEN")

echo "$USER_RESPONSE" | grep -o '"profileImage":"[^"]*' | cut -d'"' -f4

echo ""
echo "✅ Teste concluído!"