-- Atualizar o enum subscription_plan para incluir o valor 'ultra'
ALTER TYPE subscription_plan ADD VALUE 'ultra' AFTER 'premium';
ALTER TYPE subscription_plan ADD VALUE 'ultra_family' AFTER 'premium_family';