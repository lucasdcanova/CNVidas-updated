-- Adicionar campos relacionados ao vendedor
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_name TEXT;

-- Atualizar o subscription_changed_at para usuários existentes com planos diferentes de "free"
UPDATE users 
SET subscription_changed_at = CURRENT_TIMESTAMP 
WHERE subscription_plan != 'free' AND subscription_changed_at IS NULL;