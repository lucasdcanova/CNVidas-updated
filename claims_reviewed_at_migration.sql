-- Migração para adicionar campo reviewed_at na tabela claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;