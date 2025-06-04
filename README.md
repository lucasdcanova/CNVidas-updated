# CN Vidas - Sistema de Telemedicina

Sistema completo de telemedicina desenvolvido com TypeScript, React, Express, PostgreSQL, Drizzle ORM, Stripe e integração de vídeo com Daily.co.

## 🚀 Tecnologias

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, TypeScript
- **Banco de Dados**: PostgreSQL
- **ORM**: Drizzle
- **Pagamentos**: Stripe
- **Videoconferência**: Daily.co
- **Autenticação**: JWT

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- NPM ou Yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone [URL_DO_REPOSITÓRIO]
cd cn-vidas
```

2. Instale as dependências:
```bash
# Instalar dependências do servidor
cd server
npm install

# Instalar dependências do cliente
cd ../client
npm install
```

3. Configure as variáveis de ambiente:
```bash
# No diretório server
cp .env.example .env
# Edite o arquivo .env com suas configurações

# No diretório client
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Execute as migrações do banco de dados:
```bash
cd server
npm run migrate
```

5. Inicie o servidor de desenvolvimento:
```bash
# Terminal 1 - Servidor
cd server
npm run dev

# Terminal 2 - Cliente
cd client
npm run dev
```

## 🌐 Acesso

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## 📝 Funcionalidades

- Autenticação de usuários (pacientes, médicos, parceiros e administradores)
- Agendamento de consultas
- Consultas por videoconferência
- Gestão de prontuários
- Sistema de pagamentos
- Gestão de assinaturas
- Área administrativa
- Dashboard para médicos
- Portal do paciente

## 🔐 Variáveis de Ambiente

### Servidor (.env)
```
DATABASE_URL=
JWT_SECRET=
STRIPE_SECRET_KEY=
DAILY_API_KEY=
```

### Cliente (.env)
```
VITE_API_URL=
VITE_STRIPE_PUBLIC_KEY=
VITE_DAILY_DOMAIN=
```

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes. 