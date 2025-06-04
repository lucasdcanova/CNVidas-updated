-- Adiciona campos para controle de pagamentos de consultas
ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_amount INTEGER,
  ADD COLUMN IF NOT EXISTS payment_fee INTEGER,
  ADD COLUMN IF NOT EXISTS payment_captured_at TIMESTAMP;

-- Índice para acelerar consultas por payment_intent_id
CREATE INDEX IF NOT EXISTS appointments_payment_intent_id_idx ON appointments(payment_intent_id);

-- Índice para consultas por status de pagamento
CREATE INDEX IF NOT EXISTS appointments_payment_status_idx ON appointments(payment_status);