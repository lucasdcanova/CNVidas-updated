require('dotenv').config();
const { pool } = require('./dist/server/db');

async function checkPartnerCities() {
  try {
    console.log('🔍 Verificando cidades dos parceiros...\n');
    
    // 1. Verificar cidades dos parceiros
    const result = await pool.query(`
      SELECT 
        p.id,
        p.business_name,
        p.city,
        p.state,
        COUNT(ps.id) as service_count
      FROM partners p
      LEFT JOIN partner_services ps ON p.id = ps.partner_id AND ps.is_active = true
      WHERE p.city IS NOT NULL
      GROUP BY p.id, p.business_name, p.city, p.state
      ORDER BY p.city
    `);
    
    console.log('📍 Parceiros com cidade cadastrada:');
    result.rows.forEach(partner => {
      console.log(`   - ${partner.business_name} (ID: ${partner.id})`);
      console.log(`     Cidade: ${partner.city}, ${partner.state}`);
      console.log(`     Serviços ativos: ${partner.service_count}`);
      console.log('');
    });
    
    // 2. Verificar parceiros sem cidade
    const noCityResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM partners
      WHERE city IS NULL OR city = ''
    `);
    
    console.log(`\n⚠️  Parceiros sem cidade: ${noCityResult.rows[0].count}`);
    
    // 3. Verificar serviços por cidade
    const servicesByCityResult = await pool.query(`
      SELECT 
        p.city,
        COUNT(DISTINCT ps.id) as service_count
      FROM partner_services ps
      INNER JOIN partners p ON ps.partner_id = p.id
      WHERE ps.is_active = true AND p.city IS NOT NULL
      GROUP BY p.city
      ORDER BY service_count DESC
    `);
    
    console.log('\n📊 Serviços por cidade:');
    servicesByCityResult.rows.forEach(row => {
      console.log(`   - ${row.city}: ${row.service_count} serviços`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkPartnerCities();