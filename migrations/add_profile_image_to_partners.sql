-- Adicionar campo profile_image para parceiros
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Adicionar comentário para documentação
COMMENT ON COLUMN partners.profile_image IS 'URL da imagem de perfil do parceiro'; 