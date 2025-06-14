require('dotenv').config();
const { pool } = require('./dist/server/db');

async function debugServices() {
  try {
    console.log('🔍 Verificando serviços no banco de dados...\n');
    
    // 1. Contar total de serviços
    const countResult = await pool.query('SELECT COUNT(*) FROM partner_services');
    console.log(`📊 Total de serviços na tabela: ${countResult.rows[0].count}\n`);
    
    // 2. Verificar serviços ativos
    const activeResult = await pool.query('SELECT COUNT(*) FROM partner_services WHERE is_active = true');
    console.log(`✅ Serviços ativos: ${activeResult.rows[0].count}\n`);
    
    // 3. Listar primeiros 5 serviços ativos com detalhes
    const servicesResult = await pool.query(`
      SELECT 
        ps.id,
        ps.name,
        ps.category,
        ps.is_active,
        ps.is_national,
        ps.service_image,
        ps.partner_id,
        p.business_name as partner_name,
        p.city as partner_city
      FROM partner_services ps
      LEFT JOIN partners p ON ps.partner_id = p.id
      WHERE ps.is_active = true
      LIMIT 5
    `);
    
    console.log('📋 Primeiros 5 serviços ativos:');
    servicesResult.rows.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.name} (ID: ${service.id})`);
      console.log(`   - Categoria: ${service.category}`);
      console.log(`   - Nacional: ${service.is_national ? 'Sim' : 'Não'}`);
      console.log(`   - Parceiro: ${service.partner_name || 'N/A'} (ID: ${service.partner_id})`);
      console.log(`   - Cidade do parceiro: ${service.partner_city || 'N/A'}`);
      console.log(`   - Tem imagem: ${service.service_image ? 'Sim' : 'Não'}`);
    });
    
    // 4. Verificar categorias disponíveis
    const categoriesResult = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM partner_services
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `);
    
    console.log('\n\n📁 Categorias de serviços:');
    categoriesResult.rows.forEach(cat => {
      console.log(`   - ${cat.category}: ${cat.count} serviços`);
    });
    
    // 5. Verificar parceiros com serviços
    const partnersResult = await pool.query(`
      SELECT 
        p.id,
        p.business_name,
        p.city,
        COUNT(ps.id) as service_count
      FROM partners p
      INNER JOIN partner_services ps ON p.id = ps.partner_id
      WHERE ps.is_active = true
      GROUP BY p.id, p.business_name, p.city
      ORDER BY service_count DESC
      LIMIT 5
    `);
    
    console.log('\n\n🏢 Top 5 parceiros com mais serviços:');
    partnersResult.rows.forEach((partner, index) => {
      console.log(`${index + 1}. ${partner.business_name} (${partner.city}) - ${partner.service_count} serviços`);
    });
    
    // 6. Verificar endereços de parceiros
    const addressesResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN is_active = true THEN 1 END) as active
      FROM partner_addresses
    `);
    
    console.log(`\n\n📍 Endereços de parceiros:`);
    console.log(`   - Total: ${addressesResult.rows[0].total}`);
    console.log(`   - Ativos: ${addressesResult.rows[0].active}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao verificar serviços:', error);
    process.exit(1);
  }
}

debugServices();