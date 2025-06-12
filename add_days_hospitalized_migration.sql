-- Migração para adicionar campo days_hospitalized na tabela claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS days_hospitalized INTEGER DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN claims.days_hospitalized IS 'Número de dias que o paciente ficou internado para cálculo do valor do sinistro'; 