import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function checkUsers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Get total count of users
    const countResult = await client.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = countResult.rows[0].total;
    
    console.log(`Total users registered: ${totalUsers}\n`);
    
    // Get all users with their details (excluding passwords)
    const usersResult = await client.query(`
      SELECT 
        id,
        email,
        username,
        full_name,
        role,
        phone,
        created_at,
        email_verified,
        subscription_status,
        subscription_plan
      FROM users 
      ORDER BY created_at DESC
    `);
    
    console.log('User Summary:');
    console.log('=============\n');
    
    // Group users by role
    const usersByRole = {};
    
    usersResult.rows.forEach(user => {
      if (!usersByRole[user.role]) {
        usersByRole[user.role] = [];
      }
      usersByRole[user.role].push(user);
    });
    
    // Display users grouped by role
    Object.entries(usersByRole).forEach(([role, users]) => {
      console.log(`\n${role.toUpperCase()} USERS (${users.length}):`);
      console.log('-'.repeat(50));
      
      users.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Username: ${user.username}`);
        console.log(`Full Name: ${user.full_name}`);
        console.log(`Phone: ${user.phone || 'Not provided'}`);
        console.log(`Email Verified: ${user.email_verified ? 'Yes' : 'No'}`);
        console.log(`Subscription: ${user.subscription_plan} (${user.subscription_status || 'inactive'})`);
        console.log(`Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log('-'.repeat(30));
      });
    });
    
    // Summary statistics
    console.log('\n\nSUMMARY STATISTICS:');
    console.log('===================');
    console.log(`Total Users: ${totalUsers}`);
    
    Object.entries(usersByRole).forEach(([role, users]) => {
      console.log(`${role}: ${users.length}`);
    });
    
    // Check subscription distribution
    const subscriptionStats = await client.query(`
      SELECT 
        subscription_plan,
        COUNT(*) as count
      FROM users
      GROUP BY subscription_plan
      ORDER BY count DESC
    `);
    
    console.log('\nSubscription Distribution:');
    console.log('-'.repeat(30));
    subscriptionStats.rows.forEach(stat => {
      console.log(`${stat.subscription_plan}: ${stat.count} users`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

checkUsers();