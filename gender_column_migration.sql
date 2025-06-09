-- Adicionar coluna gender à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- Adicionar outras colunas que também podem estar faltando
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER REFERENCES subscription_plans(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20);