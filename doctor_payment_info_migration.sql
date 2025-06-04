-- Adicionar campos de informações de pagamento PIX na tabela doctors
ALTER TABLE doctors 
ADD COLUMN pix_key_type TEXT,
ADD COLUMN pix_key TEXT,
ADD COLUMN bank_name TEXT,
ADD COLUMN account_type TEXT,
ADD COLUMN welcome_completed BOOLEAN DEFAULT FALSE NOT NULL;