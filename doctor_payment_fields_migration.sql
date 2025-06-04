-- Adiciona as colunas de pagamento PIX à tabela doctors
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS pix_key_type TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS account_type TEXT;