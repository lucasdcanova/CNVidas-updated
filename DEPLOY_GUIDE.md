# Guia de Deploy - CNVidas no Render

## Alterações Realizadas para Otimizar o Deploy

### 1. **Correção de Dependências**
- Removidas dependências não utilizadas que causavam erros de importação
- Adicionado `package.json` com todas as dependências necessárias

### 2. **Scripts de Build Otimizados**
- Simplificado o processo de build para ser mais eficiente
- Build server: `tsc --project tsconfig.production.json`
- Build client: `vite build --outDir dist/client`
- Comando único: `npm run build`

### 3. **Configuração TypeScript para Produção**
- Alterado para CommonJS para melhor compatibilidade
- Desabilitado source maps para reduzir tamanho
- Configurado `esModuleInterop` para imports corretos

### 4. **Health Check**
- Endpoint já configurado em `/api/health`

### 5. **Variáveis de Ambiente Necessárias**
Configure estas variáveis no painel do Render:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=seu-secret-key
SESSION_SECRET=seu-session-secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-app
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
DAILY_API_KEY=sua-chave-daily
DAILY_DOMAIN=https://seu-dominio.daily.co
```

### 6. **Disco Persistente**
- Configurado em `/opt/render/project/src/public/uploads`
- Tamanho: 1GB

## Passos para Deploy

1. **Commit as alterações**:
```bash
git add -A
git commit -m "Otimizar configuração para deploy no Render"
git push origin main
```

2. **No painel do Render**:
   - Conecte seu repositório GitHub
   - Selecione branch `main`
   - As configurações do `render.yaml` serão aplicadas automaticamente

3. **Configure as variáveis de ambiente** no painel do Render

4. **Aguarde o build e deploy** - deve levar cerca de 5-10 minutos

## Troubleshooting

### Se houver erro de TypeScript:
- Verifique se todas as importações estão corretas
- O build usa `skipLibCheck: true` para evitar erros de tipos

### Se houver erro de módulos:
- Verifique se removeu `"type": "module"` do package.json
- Confirme que está usando CommonJS no tsconfig.production.json

### Se houver erro de banco de dados:
- Verifique se DATABASE_URL está correto
- Execute `npx prisma migrate deploy` após o primeiro deploy