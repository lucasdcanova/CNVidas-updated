require('dotenv').config();
const { pool } = require('./dist/server/db');

async function checkNationalServices() {
  try {
    console.log('🔍 Verificando serviços nacionais...\n');
    
    // 1. Verificar valores de is_national
    const result = await pool.query(`
      SELECT 
        is_national,
        COUNT(*) as count
      FROM partner_services
      WHERE is_active = true
      GROUP BY is_national
    `);
    
    console.log('📊 Distribuição de is_national:');
    result.rows.forEach(row => {
      console.log(`   - ${row.is_national === true ? 'Nacional' : row.is_national === false ? 'Local' : 'NULL'}: ${row.count} serviços`);
    });
    
    // 2. Listar alguns serviços para verificar
    const servicesResult = await pool.query(`
      SELECT id, name, is_national, partner_id, category
      FROM partner_services
      WHERE is_active = true
      LIMIT 10
    `);
    
    console.log('\n📋 Primeiros 10 serviços:');
    servicesResult.rows.forEach((s, i) => {
      console.log(`${i+1}. ${s.name}`);
      console.log(`   - ID: ${s.id}`);
      console.log(`   - Nacional: ${s.is_national}`);
      console.log(`   - Categoria: ${s.category}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkNationalServices();