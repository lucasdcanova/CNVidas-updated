-- Adiciona campo para rastrear se o médico já visualizou a tela de boas-vindas
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN NOT NULL DEFAULT FALSE;