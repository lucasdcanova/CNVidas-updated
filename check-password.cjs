require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { users } = require('./server/db/schema');
const { eq } = require('drizzle-orm');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

(async () => {
  try {
    const result = await db.select().from(users).where(eq(users.email, 'patient-test@example.com'));
    if (result[0]) {
      console.log('User found:');
      console.log('Email:', result[0].email);
      console.log('Password hash:', result[0].password);
      console.log('Password format:', result[0].password.includes('.') ? 'scrypt' : 'bcrypt');
      console.log('Password length:', result[0].password.length);
      
      if (result[0].password.includes('.')) {
        const [hashed, salt] = result[0].password.split('.');
        console.log('Hash part length:', hashed.length);
        console.log('Salt part length:', salt.length);
        console.log('Hash Buffer length:', Buffer.from(hashed, 'hex').length);
      }
    } else {
      console.log('User not found');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})(); 