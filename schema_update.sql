-- Create user role enum type if it doesn't exist
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('patient', 'partner', 'admin', 'doctor');

-- Create doctors table
CREATE TABLE IF NOT EXISTS "doctors" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "specialization" TEXT NOT NULL,
  "license_number" TEXT NOT NULL UNIQUE,
  "biography" TEXT,
  "education" TEXT,
  "experience_years" INTEGER,
  "available_for_emergency" BOOLEAN DEFAULT FALSE,
  "consultation_fee" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add doctorId column to appointments if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'doctor_id'
    ) THEN
        ALTER TABLE "appointments" ADD COLUMN "doctor_id" INTEGER REFERENCES "doctors"("id") ON DELETE SET NULL;
    END IF;
END $$;