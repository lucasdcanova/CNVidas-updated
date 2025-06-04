-- Adicionar a coluna is_featured se ela não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'partner_services' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
  END IF;
END $$;