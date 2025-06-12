import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://cnvidas_db_user:SplsOHhfGXJMUqXgXlSF7FLKxYUEeP6A@dpg-csdfirq3esus739e8420-a.oregon-postgres.render.com/cnvidas_db",
  ssl: { rejectUnauthorized: false }
});
import fs from 'fs';
import path from 'path';

async function checkProfileImages() {
  console.log('🔍 Verificando imagens de perfil no sistema...\n');

  try {
    // 1. Verificar imagens de usuários
    console.log('1️⃣ USUÁRIOS COM IMAGEM DE PERFIL:');
    console.log('=' .repeat(50));
    
    const usersResult = await pool.query(
      `SELECT id, username, full_name, profile_image, role 
       FROM users 
       WHERE profile_image IS NOT NULL
       ORDER BY role, username`
    );
    
    console.log(`Total de usuários com imagem: ${usersResult.rows.length}\n`);
    
    for (const user of usersResult.rows) {
      console.log(`👤 ${user.full_name || user.username} (${user.role})`);
      console.log(`   URL: ${user.profile_image}`);
      
      // Verificar se o arquivo existe fisicamente
      if (user.profile_image.startsWith('/uploads/')) {
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
      `SELECT d.id, d.user_id, d.full_name, d.profile_image, u.username
       FROM doctors d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.profile_image IS NOT NULL
       ORDER BY d.full_name`
    );
    
    console.log(`Total de médicos com imagem: ${doctorsResult.rows.length}\n`);
    
    for (const doctor of doctorsResult.rows) {
      console.log(`🩺 Dr(a). ${doctor.full_name} (@${doctor.username})`);
      console.log(`   URL: ${doctor.profile_image}`);
      
      // Verificar se o arquivo existe fisicamente
      if (doctor.profile_image.startsWith('/uploads/')) {
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
      `SELECT p.id, p.user_id, p.business_name, p.profile_image, u.username
       FROM partners p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.profile_image IS NOT NULL
       ORDER BY p.business_name`
    );
    
    console.log(`Total de parceiros com imagem: ${partnersResult.rows.length}\n`);
    
    for (const partner of partnersResult.rows) {
      console.log(`🏢 ${partner.business_name} (@${partner.username})`);
      console.log(`   URL: ${partner.profile_image}`);
      
      // Verificar se o arquivo existe fisicamente
      if (partner.profile_image.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', partner.profile_image);
        const exists = fs.existsSync(filePath);
        console.log(`   Arquivo existe: ${exists ? '✅' : '❌'}`);
      }
      console.log('');
    }
    
    // 4. Verificar arquivos órfãos no diretório de uploads
    console.log('\n4️⃣ ARQUIVOS NO DIRETÓRIO DE UPLOADS:');
    console.log('=' .repeat(50));
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`Total de arquivos: ${files.length}\n`);
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        const imageUrl = `/uploads/profiles/${file}`;
        
        // Verificar se este arquivo está sendo usado
        const usedByUser = usersResult.rows.find(u => u.profile_image === imageUrl);
        const usedByDoctor = doctorsResult.rows.find(d => d.profile_image === imageUrl);
        const usedByPartner = partnersResult.rows.find(p => p.profile_image === imageUrl);
        
        console.log(`📁 ${file}`);
        console.log(`   Tamanho: ${(stats.size / 1024).toFixed(1)}KB`);
        console.log(`   Data: ${stats.mtime.toLocaleString('pt-BR')}`);
        
        if (usedByUser || usedByDoctor || usedByPartner) {
          console.log(`   Status: ✅ Em uso`);
          if (usedByUser) console.log(`   Usado por: ${usedByUser.full_name || usedByUser.username} (usuário)`);
          if (usedByDoctor) console.log(`   Usado por: Dr(a). ${usedByDoctor.full_name} (médico)`);
          if (usedByPartner) console.log(`   Usado por: ${usedByPartner.business_name} (parceiro)`);
        } else {
          console.log(`   Status: ⚠️ Órfão (não está sendo usado)`);
        }
        console.log('');
      }
    } else {
      console.log('❌ Diretório de uploads não encontrado!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar imagens:', error);
  } finally {
    await pool.end();
  }
}

checkProfileImages();