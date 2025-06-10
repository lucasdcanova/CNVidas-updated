-- Criar tabela de registro de checkouts
CREATE TABLE IF NOT EXISTS checkout_tracking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'initiated',
  -- Status possíveis: initiated, processing, completed, failed, abandoned, payment_failed, payment_expired
  
  checkout_type VARCHAR(50) NOT NULL,
  -- Tipos: subscription, consultation, service
  
  amount INTEGER NOT NULL, -- Em centavos
  currency VARCHAR(3) DEFAULT 'BRL',
  
  payment_method VARCHAR(50), -- card, pix, boleto
  payment_status VARCHAR(50), -- pending, processing, succeeded, failed, expired
  payment_error TEXT, -- Mensagem de erro se houver
  
  -- Dados do Stripe/Pagamento
  stripe_payment_intent_id VARCHAR(255),
  stripe_session_id VARCHAR(255),
  stripe_error_code VARCHAR(100),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- Pode incluir: plan_name, consultation_id, service_id, etc.
  
  -- Timestamps
  initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  abandoned_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Informações adicionais
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_checkout_tracking_user_id ON checkout_tracking(user_id);
CREATE INDEX idx_checkout_tracking_status ON checkout_tracking(status);
CREATE INDEX idx_checkout_tracking_payment_status ON checkout_tracking(payment_status);
CREATE INDEX idx_checkout_tracking_created_at ON checkout_tracking(created_at);
CREATE INDEX idx_checkout_tracking_checkout_type ON checkout_tracking(checkout_type);

-- Criar tabela para lembretes de pagamentos
CREATE TABLE IF NOT EXISTS payment_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_tracking_id INTEGER REFERENCES checkout_tracking(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL, -- payment_failed, payment_due, subscription_expiring
  reminder_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para lembretes
CREATE INDEX idx_payment_reminders_user_id ON payment_reminders(user_id);
CREATE INDEX idx_payment_reminders_status ON payment_reminders(reminder_status);
CREATE INDEX idx_payment_reminders_scheduled ON payment_reminders(scheduled_for);

-- Função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_checkout_tracking_updated_at BEFORE UPDATE ON checkout_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_reminders_updated_at BEFORE UPDATE ON payment_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();