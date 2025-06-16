-- Add onboarding_completed field to doctors table
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Update existing doctors who have completed profiles to have onboarding_completed = true
UPDATE doctors
SET onboarding_completed = true
WHERE specialization IS NOT NULL 
  AND license_number IS NOT NULL 
  AND education IS NOT NULL
  AND consultation_fee IS NOT NULL
  AND pix_key IS NOT NULL
  AND bank_name IS NOT NULL;

-- Add profile_image field if it doesn't exist
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255);

-- Add additional fields for enhanced doctor profile
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS consultation_price_description TEXT,
ADD COLUMN IF NOT EXISTS full_bio TEXT,
ADD COLUMN IF NOT EXISTS areas_of_expertise TEXT[],
ADD COLUMN IF NOT EXISTS languages_spoken TEXT[],
ADD COLUMN IF NOT EXISTS achievements TEXT;