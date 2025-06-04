-- Adiciona a coluna emergency_consultations_left à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_consultations_left INTEGER DEFAULT 0;

-- Atualiza os usuários com plano basic para terem 2 consultas
UPDATE users SET emergency_consultations_left = 2 WHERE subscription_plan = 'basic';

-- Atualiza os usuários com plano premium para terem 99 consultas (simula ilimitado)
UPDATE users SET emergency_consultations_left = 99 WHERE subscription_plan = 'premium';