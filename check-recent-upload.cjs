const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://cnvidas_db_user:SplsOHhfGXJMUqXgXlSF7FLKxYUEeP6A@dpg-csdfirq3esus739e8420-a.oregon-postgres.render.com/cnvidas_db",
  ssl: { rejectUnauthorized: false }
});

async function checkRecentUpload() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar usuários com imagem de perfil mais recente
    const result = await client.query(`
      SELECT id, username, full_name, role, profile_image, updated_at
      FROM users
      WHERE profile_image IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    console.log('🖼️ Últimas imagens de perfil cadastradas:\n');
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.full_name || user.username} (${user.role})`);
      console.log(`   URL: ${user.profile_image}`);
      console.log(`   Atualizado em: ${new Date(user.updated_at).toLocaleString('pt-BR')}\n`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkRecentUpload();