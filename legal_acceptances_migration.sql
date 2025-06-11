-- Criar tabela legal_acceptances para armazenar aceitações de termos legais
CREATE TABLE IF NOT EXISTS legal_acceptances (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_version VARCHAR(20) NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Criar índices para melhor performance
CREATE INDEX idx_legal_acceptances_user_id ON legal_acceptances(user_id);
CREATE INDEX idx_legal_acceptances_document_type ON legal_acceptances(document_type);
CREATE INDEX idx_legal_acceptances_accepted_at ON legal_acceptances(accepted_at);