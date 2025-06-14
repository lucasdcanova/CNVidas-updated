-- Criação das tabelas de prontuários médicos seguindo normas brasileiras (CFM)
-- Resolução CFM nº 1.638/2002 e nº 1.821/2007

-- 1. Tabela principal de prontuários médicos
CREATE TABLE IF NOT EXISTS medical_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id),
    record_number VARCHAR(50) NOT NULL UNIQUE, -- Número único do prontuário
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Anamnese inicial
    chief_complaint TEXT, -- Queixa principal
    history_of_present_illness TEXT, -- História da doença atual
    past_medical_history TEXT, -- História médica pregressa
    medications TEXT, -- Medicações em uso
    allergies TEXT, -- Alergias
    family_history TEXT, -- História familiar
    social_history TEXT, -- História social
    
    -- Exame físico inicial
    vital_signs JSONB, -- Sinais vitais (PA, FC, FR, Temp, etc)
    physical_examination TEXT, -- Exame físico
    
    -- Informações adicionais
    blood_type VARCHAR(5), -- Tipo sanguíneo (A+, A-, B+, B-, AB+, AB-, O+, O-)
    emergency_contact JSONB, -- Contato de emergência {nome, telefone, parentesco}
    
    -- Campos de controle
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_accessed_at TIMESTAMP,
    last_accessed_by INTEGER REFERENCES users(id)
);

-- 2. Tabela de entradas/evoluções no prontuário
CREATE TABLE IF NOT EXISTS medical_record_entries (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES medical_records(id),
    appointment_id INTEGER REFERENCES appointments(id), -- Vincula à consulta se houver
    author_id INTEGER NOT NULL REFERENCES users(id), -- Médico que fez a entrada
    entry_type VARCHAR(50) NOT NULL, -- 'consultation', 'exam', 'prescription', 'procedure', 'evolution'
    
    -- Conteúdo da entrada
    content TEXT NOT NULL, -- Conteúdo principal
    subjective TEXT, -- S - Subjetivo (SOAP)
    objective TEXT, -- O - Objetivo (SOAP)
    assessment TEXT, -- A - Avaliação (SOAP)
    plan TEXT, -- P - Plano (SOAP)
    
    -- Metadados
    vital_signs JSONB, -- Sinais vitais no momento
    attachments JSONB, -- URLs de anexos (exames, receitas, etc)
    
    -- Controle e conformidade legal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    signed_at TIMESTAMP, -- Quando foi assinado digitalmente
    signature TEXT, -- Assinatura digital (hash)
    ip_address VARCHAR(45), -- IP de onde foi feita a entrada
    
    -- Campos para conformidade legal
    cid10 VARCHAR(10), -- Código CID-10
    procedures JSONB, -- Procedimentos realizados [{código, descrição}]
    prescriptions JSONB -- Prescrições [{medicamento, dose, frequência, duração}]
);

-- 3. Tabela de auditoria de acesso aos prontuários
CREATE TABLE IF NOT EXISTS medical_record_access (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES medical_records(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    access_type VARCHAR(50) NOT NULL, -- 'view', 'create_entry', 'print', 'export'
    access_reason TEXT, -- Motivo do acesso (obrigatório para alguns tipos)
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Índices para performance
CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_medical_records_record_number ON medical_records(record_number);
CREATE INDEX idx_medical_record_entries_record_id ON medical_record_entries(record_id);
CREATE INDEX idx_medical_record_entries_appointment_id ON medical_record_entries(appointment_id);
CREATE INDEX idx_medical_record_entries_author_id ON medical_record_entries(author_id);
CREATE INDEX idx_medical_record_entries_created_at ON medical_record_entries(created_at);
CREATE INDEX idx_medical_record_access_record_id ON medical_record_access(record_id);
CREATE INDEX idx_medical_record_access_user_id ON medical_record_access(user_id);
CREATE INDEX idx_medical_record_access_accessed_at ON medical_record_access(accessed_at);

-- Trigger para registrar acesso automático quando o prontuário é atualizado
CREATE OR REPLACE FUNCTION update_medical_record_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_record_access_trigger
BEFORE UPDATE ON medical_records
FOR EACH ROW
EXECUTE FUNCTION update_medical_record_access();

-- Função para gerar número único de prontuário
CREATE OR REPLACE FUNCTION generate_record_number(patient_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    year_part VARCHAR(4);
    sequential_part VARCHAR(6);
    record_number VARCHAR(50);
BEGIN
    year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Gera um número sequencial único para o ano
    SELECT LPAD(COALESCE(MAX(CAST(SUBSTRING(record_number FROM 6 FOR 6) AS INTEGER)), 0) + 1, 6, '0')
    INTO sequential_part
    FROM medical_records
    WHERE record_number LIKE year_part || '%';
    
    record_number := year_part || '-' || sequential_part || '-' || LPAD(patient_id::TEXT, 6, '0');
    
    RETURN record_number;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE medical_records IS 'Prontuários médicos dos pacientes - Imutável conforme CFM';
COMMENT ON TABLE medical_record_entries IS 'Entradas/evoluções no prontuário - Imutável conforme CFM';
COMMENT ON TABLE medical_record_access IS 'Auditoria de acesso aos prontuários para conformidade legal';

COMMENT ON COLUMN medical_records.record_number IS 'Número único do prontuário no formato YYYY-NNNNNN-PPPPPP';
COMMENT ON COLUMN medical_record_entries.entry_type IS 'Tipo da entrada: consultation, exam, prescription, procedure, evolution';
COMMENT ON COLUMN medical_record_entries.signature IS 'Hash da assinatura digital para garantir integridade';
COMMENT ON COLUMN medical_record_access.access_type IS 'Tipo de acesso: view, create_entry, print, export';