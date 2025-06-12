import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function fixDoctorPassword() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Generate new password hash
    const password = 'qweasdzxc123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('Updating password for dr@lucascanova.com...');
    console.log('New password:', password);
    
    // Update the password
    const updateResult = await client.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, full_name',
      [hashedPassword, 'dr@lucascanova.com']
    );
    
    if (updateResult.rowCount > 0) {
      const user = updateResult.rows[0];
      console.log('\n✅ Password updated successfully!');
      console.log('User details:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Name:', user.full_name);
      console.log('\nYou can now login with:');
      console.log('Email: dr@lucascanova.com');
      console.log('Password: qweasdzxc123');
    } else {
      console.log('❌ User not found with email dr@lucascanova.com');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

fixDoctorPassword();