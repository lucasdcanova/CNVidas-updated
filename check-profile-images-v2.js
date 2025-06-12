require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkProfileImages() {
  console.log('🔍 Verificando imagens de perfil no sistema...\n');

  try {
    // 1. Verificar imagens de usuários
    console.log('1️⃣ USUÁRIOS COM IMAGEM DE PERFIL:');
    console.log('=' .repeat(50));
    
    const usersResult = await pool.query(
      `SELECT id, username, full_name, profile_image, role, updated_at
       FROM users 
       WHERE profile_image IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 10`
    );
    
    console.log(`Total de usuários com imagem (últimos 10): ${usersResult.rows.length}\n`);
    
    for (const user of usersResult.rows) {
      console.log(`👤 ${user.full_name || user.username} (${user.role})`);
      console.log(`   URL: ${user.profile_image}`);
      console.log(`   Atualizado: ${new Date(user.updated_at).toLocaleString('pt-BR')}`);
      
      // Verificar se o arquivo existe fisicamente
      if (user.profile_image && user.profile_image.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', user.profile_image);
        const exists = fs.existsSync(filePath);
        console.log(`   Arquivo existe: ${exists ? '✅' : '❌'}`);
        if (exists) {
          const stats = fs.statSync(filePath);
          console.log(`   Tamanho: ${(stats.size / 1024).toFixed(1)}KB`);
        }
      }
      console.log('');
    }
    
    // 2. Verificar imagens de médicos
    console.log('\n2️⃣ MÉDICOS COM IMAGEM DE PERFIL:');
    console.log('=' .repeat(50));
    
    const doctorsResult = await pool.query(
      `SELECT d.id, d.user_id, d.full_name, d.profile_image, u.username, d.updated_at
       FROM doctors d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.profile_image IS NOT NULL
       ORDER BY d.updated_at DESC
       LIMIT 5`
    );
    
    console.log(`Total de médicos com imagem (últimos 5): ${doctorsResult.rows.length}\n`);
    
    for (const doctor of doctorsResult.rows) {
      console.log(`🩺 Dr(a). ${doctor.full_name} (@${doctor.username})`);
      console.log(`   URL: ${doctor.profile_image}`);
      console.log(`   Atualizado: ${new Date(doctor.updated_at).toLocaleString('pt-BR')}`);
      
      // Verificar se o arquivo existe fisicamente
      if (doctor.profile_image && doctor.profile_image.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', doctor.profile_image);
        const exists = fs.existsSync(filePath);
        console.log(`   Arquivo existe: ${exists ? '✅' : '❌'}`);
      }
      console.log('');
    }
    
    // 3. Verificar imagens de parceiros
    console.log('\n3️⃣ PARCEIROS COM IMAGEM DE PERFIL:');
    console.log('=' .repeat(50));
    
    const partnersResult = await pool.query(
      `SELECT p.id, p.user_id, p.business_name, p.profile_image, u.username, p.updated_at
       FROM partners p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.profile_image IS NOT NULL
       ORDER BY p.updated_at DESC
       LIMIT 5`
    );
    
    console.log(`Total de parceiros com imagem (últimos 5): ${partnersResult.rows.length}\n`);
    
    for (const partner of partnersResult.rows) {
      console.log(`🏢 ${partner.business_name} (@${partner.username})`);
      console.log(`   URL: ${partner.profile_image}`);
      console.log(`   Atualizado: ${new Date(partner.updated_at).toLocaleString('pt-BR')}`);
      
      // Verificar se o arquivo existe fisicamente
      if (partner.profile_image && partner.profile_image.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', partner.profile_image);
        const exists = fs.existsSync(filePath);
        console.log(`   Arquivo existe: ${exists ? '✅' : '❌'}`);
      }
      console.log('');
    }
    
    // 4. Verificar arquivos no diretório de uploads
    console.log('\n4️⃣ ARQUIVOS NO DIRETÓRIO DE UPLOADS:');
    console.log('=' .repeat(50));
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg'));
      console.log(`Total de imagens em /public/uploads: ${files.length}\n`);
      
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`📁 ${file}`);
        console.log(`   Tamanho: ${(stats.size / 1024).toFixed(1)}KB`);
        console.log(`   Data: ${stats.mtime.toLocaleString('pt-BR')}`);
      });
    }
    
    const profilesDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    if (fs.existsSync(profilesDir)) {
      console.log('\n');
      const profileFiles = fs.readdirSync(profilesDir);
      console.log(`Total de imagens em /public/uploads/profiles: ${profileFiles.length}\n`);
      
      profileFiles.forEach(file => {
        const filePath = path.join(profilesDir, file);
        const stats = fs.statSync(filePath);
        console.log(`📁 ${file}`);
        console.log(`   Tamanho: ${(stats.size / 1024).toFixed(1)}KB`);
        console.log(`   Data: ${stats.mtime.toLocaleString('pt-BR')}`);
      });
    }
    
    // 5. Testar acesso direto a uma imagem
    console.log('\n\n5️⃣ TESTE DE ACESSO A IMAGEM:');
    console.log('=' .repeat(50));
    
    if (usersResult.rows.length > 0 && usersResult.rows[0].profile_image) {
      const testUrl = usersResult.rows[0].profile_image;
      console.log(`\n✅ Para testar o acesso a imagem, acesse:`);
      console.log(`   http://localhost:8080${testUrl}`);
      console.log(`\n   Usuário: ${usersResult.rows[0].full_name || usersResult.rows[0].username}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar imagens:', error);
  } finally {
    await pool.end();
  }
}

checkProfileImages();