const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Running doctor onboarding migration...');

try {
  // Check if the migration file exists
  const migrationPath = path.join(__dirname, 'onboarding_status_migration.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  // Run the migration
  execSync(`psql $DATABASE_URL < ${migrationPath}`, { stdio: 'inherit' });
  
  console.log('✅ Migration completed successfully!');
  console.log('📝 Database changes:');
  console.log('   - Added onboarding_completed field to doctors table');
  console.log('   - Added profile enhancement fields (bio, languages, expertise, etc.)');
  console.log('   - Updated existing doctors with complete profiles');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}