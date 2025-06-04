-- Criação da tabela de slots de disponibilidade
CREATE TABLE IF NOT EXISTS "availability_slots" (
  "id" SERIAL PRIMARY KEY,
  "doctor_id" INTEGER NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "day_of_week" INTEGER NOT NULL, -- 0-6 (domingo-sábado)
  "start_time" TEXT NOT NULL, -- formato HH:MM
  "end_time" TEXT NOT NULL, -- formato HH:MM
  "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);