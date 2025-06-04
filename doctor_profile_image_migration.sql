-- Adiciona a coluna profile_image à tabela doctors
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_image TEXT;