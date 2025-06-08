# Plano de Correção - Experiência do Paciente

## Problemas Identificados

### 1. ❌ Login do Paciente
**Problema**: Endpoint `/api/auth/login` retorna erro 500
**Status**: Dados existem no banco, senha está correta
**Ação**: Verificar e corrigir o endpoint de autenticação

### 2. ❌ Listagem de Médicos
**Problema**: Médicos não aparecem para o paciente
**Status**: 6 médicos cadastrados no banco (3 para emergência)
**Ação**: Verificar endpoint `/api/doctors` e permissões

### 3. ❌ Médicos de Emergência
**Problema**: Não aparecem médicos disponíveis
**Status**: 3 médicos configurados para emergência no banco
**Ação**: Verificar lógica de disponibilidade e endpoint `/api/emergency/patient/check-doctors`

### 4. ❌ Listagem de Serviços
**Problema**: Serviços não aparecem
**Status**: 12 serviços ativos no banco
**Ação**: Verificar endpoint `/api/services`

### 5. ❌ QR Code
**Problema**: QR Code não está funcionando
**Ação**: Verificar implementação do endpoint `/api/qr/generate`

### 6. ❌ Métodos de Pagamento
**Problema**: Não é possível adicionar métodos de pagamento
**Ação**: Verificar integração com Stripe

### 7. ❌ Mudança de Planos
**Problema**: Não funciona a troca de planos
**Ação**: Verificar endpoints de subscription

### 8. ❌ Atualização de Perfil
**Problema**: Alterações não são salvas
**Ação**: Verificar endpoint PUT `/api/user/profile`

## Soluções Implementadas

### Dados de Teste Criados ✅
- Paciente: patient-test@example.com / test123
- 3 médicos (2 para emergência)
- 1 parceiro com 3 serviços
- Disponibilidade configurada para médicos de emergência

## Próximos Passos

1. **Corrigir Autenticação** (Prioridade Alta)
   - Verificar middleware de autenticação
   - Corrigir endpoint de login
   - Implementar tratamento de erros adequado

2. **Corrigir Endpoints de Listagem** (Prioridade Alta)
   - `/api/doctors` - Listar médicos
   - `/api/services` - Listar serviços
   - `/api/emergency/patient/check-doctors` - Médicos de emergência

3. **Implementar QR Code** (Prioridade Média)
   - Criar endpoint `/api/qr/generate`
   - Implementar lógica de geração e validação

4. **Corrigir Perfil** (Prioridade Média)
   - Verificar PUT `/api/user/profile`
   - Garantir persistência das alterações

5. **Integração Pagamento** (Prioridade Baixa)
   - Verificar configuração Stripe
   - Implementar endpoints de pagamento

## Scripts de Teste Criados

1. `test-database-connection.js` - Testa conexão com banco ✅
2. `setup-test-data-direct.js` - Cria dados de teste ✅
3. `test-login-direct.js` - Verifica dados de login ✅
4. `run-patient-tests.cjs` - Testa experiência completa do paciente

## Comando para Executar Testes

```bash
# Criar dados de teste
node setup-test-data-direct.js

# Verificar dados
node test-login-direct.js

# Executar testes completos
node run-patient-tests.cjs
``` 