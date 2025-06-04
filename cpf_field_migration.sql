-- Adiciona o campo CPF à tabela de usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE;

-- Adiciona o campo lastSubscriptionCancellation à tabela de usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_subscription_cancellation TIMESTAMP;