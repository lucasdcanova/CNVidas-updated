-- Create checkout_tracking table
CREATE TABLE IF NOT EXISTS checkout_tracking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_type VARCHAR(50) NOT NULL CHECK (checkout_type IN ('subscription', 'consultation', 'service')),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'processing', 'completed', 'failed', 'abandoned', 'payment_failed', 'payment_expired')),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'succeeded', 'failed', 'expired')),
  payment_method VARCHAR(50) CHECK (payment_method IN ('card', 'pix', 'boleto')),
  payment_error TEXT,
  stripe_payment_intent_id VARCHAR(255),
  stripe_session_id VARCHAR(255),
  stripe_error_code VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  completed_at TIMESTAMP,
  abandoned_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_tracking_id INTEGER REFERENCES checkout_tracking(id) ON DELETE SET NULL,
  reminder_type VARCHAR(50) NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  response_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_checkout_tracking_user_id ON checkout_tracking(user_id);
CREATE INDEX idx_checkout_tracking_status ON checkout_tracking(status);
CREATE INDEX idx_checkout_tracking_payment_status ON checkout_tracking(payment_status);
CREATE INDEX idx_checkout_tracking_checkout_type ON checkout_tracking(checkout_type);
CREATE INDEX idx_checkout_tracking_created_at ON checkout_tracking(created_at);
CREATE INDEX idx_checkout_tracking_stripe_session ON checkout_tracking(stripe_session_id);

CREATE INDEX idx_payment_reminders_user_id ON payment_reminders(user_id);
CREATE INDEX idx_payment_reminders_scheduled_for ON payment_reminders(scheduled_for);
CREATE INDEX idx_payment_reminders_sent_at ON payment_reminders(sent_at);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_checkout_tracking_updated_at BEFORE UPDATE ON checkout_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_reminders_updated_at BEFORE UPDATE ON payment_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();