# Deploy no Render

Este documento contém as instruções para fazer o deploy da aplicação CNVidas no Render.

## Pré-requisitos

1. Conta no Render (https://render.com)
2. Repositório Git com o código
3. Banco de dados PostgreSQL (pode ser criado no próprio Render)

## Configuração do Banco de Dados

1. No dashboard do Render, crie um novo PostgreSQL database
2. Anote a URL de conexão fornecida

## Configuração da Aplicação Web

1. No dashboard do Render, crie um novo Web Service
2. Conecte ao seu repositório Git
3. Configure as seguintes opções:

### Build & Deploy

- **Build Command**: `npm run render-build`
- **Start Command**: `node --experimental-specifier-resolution=node dist/server/index.js`
- **Environment**: `Node`

### Variáveis de Ambiente

Configure as seguintes variáveis de ambiente no Render:

```
DATABASE_URL=<sua-url-do-postgres-render>
JWT_SECRET=<gere-uma-chave-secreta-forte>
SESSION_SECRET=<gere-uma-chave-secreta-forte>
NODE_ENV=production
PORT=10000

# Email (opcional - para funcionalidades de email)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<seu-email>
EMAIL_PASS=<sua-senha-de-app>

# Stripe (opcional - para pagamentos)
STRIPE_SECRET_KEY=<sua-chave-secreta-stripe>
STRIPE_PUBLISHABLE_KEY=<sua-chave-publica-stripe>
STRIPE_WEBHOOK_SECRET=<seu-webhook-secret>
```

### Health Check

- **Health Check Path**: `/api/health`

## Deploy

1. Após configurar tudo, clique em "Create Web Service"
2. O Render irá automaticamente fazer o build e deploy
3. A aplicação estará disponível na URL fornecida pelo Render

## Verificação

Após o deploy, verifique:

1. Acesse `/api/health` - deve retornar `{"status":"ok","timestamp":"..."}`
2. Teste o login na aplicação
3. Verifique se as funcionalidades principais estão funcionando

## Troubleshooting

### Build Failures

Se o build falhar, verifique:

1. Se todas as dependências estão no `package.json`
2. Se as variáveis de ambiente estão configuradas
3. Se o comando de build está correto

### Runtime Errors

Se a aplicação não iniciar:

1. Verifique os logs no dashboard do Render
2. Confirme se a `DATABASE_URL` está correta
3. Verifique se todas as variáveis de ambiente obrigatórias estão definidas

### Database Issues

Se houver problemas com o banco:

1. Verifique se o banco PostgreSQL está rodando
2. Confirme se a URL de conexão está correta
3. Verifique se as migrações foram executadas

## Notas Importantes

- O sistema foi configurado para ignorar erros de TypeScript durante o build para permitir o deploy
- As migrações do banco são executadas automaticamente via Prisma
- Os uploads de arquivos são salvos em disco (considere usar um serviço de storage externo para produção) 