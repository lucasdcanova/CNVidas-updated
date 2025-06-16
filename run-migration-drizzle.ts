import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './server/db';

async function runMigration() {
  console.log('🚀 Running doctor onboarding migration...\n');

  try {
    // Add onboarding_completed field to doctors table
    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false
    `);
    console.log('✅ Added onboarding_completed field');

    // Update existing doctors who have completed profiles
    await db.execute(sql`
      UPDATE doctors
      SET onboarding_completed = true
      WHERE specialization IS NOT NULL 
        AND license_number IS NOT NULL 
        AND education IS NOT NULL
        AND consultation_fee IS NOT NULL
        AND pix_key IS NOT NULL
        AND bank_name IS NOT NULL
    `);
    console.log('✅ Updated existing completed profiles');

    // Add profile_image field if it doesn't exist
    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255)
    `);
    console.log('✅ Added profile_image field');

    // Add additional fields for enhanced doctor profile
    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS consultation_price_description TEXT
    `);
    console.log('✅ Added consultation_price_description field');

    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS full_bio TEXT
    `);
    console.log('✅ Added full_bio field');

    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS areas_of_expertise TEXT[]
    `);
    console.log('✅ Added areas_of_expertise field');

    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS languages_spoken TEXT[]
    `);
    console.log('✅ Added languages_spoken field');

    await db.execute(sql`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS achievements TEXT
    `);
    console.log('✅ Added achievements field');

    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();