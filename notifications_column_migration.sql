-- Migração para adicionar campo isRead na tabela notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;