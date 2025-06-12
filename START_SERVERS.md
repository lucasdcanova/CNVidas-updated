# Como Iniciar os Servidores CNVidas

## Método Recomendado (Processos em Background)

1. **Limpar processos anteriores** (se necessário):
```bash
pkill -9 -f node
```

2. **Iniciar Backend**:
```bash
nohup npm run dev:server > backend.log 2>&1 &
```

3. **Aguardar 5 segundos e iniciar Frontend**:
```bash
sleep 5 && nohup npm run dev:client > frontend.log 2>&1 &
```

## URLs de Acesso

- **Backend (API)**: http://localhost:8080
- **Frontend (Aplicação)**: http://localhost:5173

## Monitorar Logs

- Backend: `tail -f backend.log`
- Frontend: `tail -f frontend.log`

## Parar os Servidores

```bash
pkill -f node
```

## Solução de Problemas

### Se a página não carregar:
1. Limpe o cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)
2. Tente uma aba anônima/privada
3. Verifique os logs para erros

### Se houver erro de porta em uso:
```bash
lsof -ti:8080 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

## Credenciais de Teste
- Email: dr@lucascanova.com
- Senha: qweasdzxc123