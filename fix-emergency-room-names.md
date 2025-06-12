# Fix Emergency Room Names

## Problema Identificado

O nome da sala está sendo criado inconsistentemente:
- Na criação: `emergency-${userId}-${Date.now()}` (linha 67 de emergency-v2.ts)
- No acesso: `emergency-${appointmentId}` (cliente)

## Solução

Precisamos garantir que todos usem o mesmo padrão. Há duas opções:

### Opção 1: Usar ID da consulta (RECOMENDADO)
- Mais simples e direto
- Nome: `emergency-${appointmentId}`
- Problema: Precisamos criar a consulta primeiro, depois a sala

### Opção 2: Usar o nome salvo no banco
- Usar o campo `telemedRoomName` que já está salvo
- Garante que todos usem o mesmo nome

## Logs mostram:
- Sala criada: `emergency-58-1749702882228` (ID do paciente 58)
- Consulta: ID 90
- Por isso não conectam!

## Correção Necessária

Atualizar emergency-v2.ts para criar a sala APÓS criar a consulta, usando o ID da consulta.