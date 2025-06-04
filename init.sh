#!/bin/bash

# Instalar dependências do sistema
apt-get update
apt-get install -y openssl libssl1.1

# Instalar dependências do Node
npm install

# Gerar o cliente Prisma
npx prisma generate --schema=./prisma/schema.prisma

# Iniciar a aplicação
npm run dev 