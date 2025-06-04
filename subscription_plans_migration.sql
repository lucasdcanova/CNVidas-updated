-- Primeiro criamos o enum de planos de assinatura
CREATE TYPE IF NOT EXISTS subscription_plan AS ENUM ('free', 'basic', 'premium');

-- Criamos a tabela de planos de assinatura
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name subscription_plan NOT NULL,
  display_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  emergency_consultations TEXT NOT NULL,
  specialist_discount INTEGER NOT NULL,
  insurance_coverage BOOLEAN NOT NULL,
  features TEXT[],
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Adicionamos os planos de assinatura
INSERT INTO subscription_plans (name, display_name, price, emergency_consultations, specialist_discount, insurance_coverage, features, is_default)
VALUES 
  ('premium', 'Premium', 13900, 'unlimited', 50, TRUE, ARRAY['Consultas de emergência ilimitadas', 'Desconto de 50% com especialistas', 'Cobertura total do seguro', 'Prioridade no agendamento', 'Suporte prioritário 24/7'], FALSE),
  ('basic', 'Básico', 10000, '2', 30, TRUE, ARRAY['2 consultas de emergência por mês', 'Desconto de 30% com especialistas', 'Cobertura total do seguro', 'Suporte 24/7'], TRUE),
  ('free', 'Gratuito', 0, '0', 0, FALSE, ARRAY['Acesso ao marketplace de serviços', 'Valor integral nas consultas', 'Sem cobertura de seguro'], FALSE)
ON CONFLICT (name) DO NOTHING;

-- Atualizamos a coluna de plano de assinatura na tabela de usuários
ALTER TABLE users DROP COLUMN IF EXISTS subscription_plan;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan subscription_plan DEFAULT 'free';