-- Adicionar campo is_national para identificar serviços de abrangência nacional
ALTER TABLE partner_services 
ADD COLUMN IF NOT EXISTS is_national BOOLEAN DEFAULT FALSE;

-- Adicionar comentário para documentação
COMMENT ON COLUMN partner_services.is_national IS 'Indica se o serviço tem abrangência nacional';