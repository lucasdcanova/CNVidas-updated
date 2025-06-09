#!/usr/bin/env node

import { db } from './server/db.ts';
import { users } from './shared/schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'admin@cnvidas.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function createAdmin() {
  try {
    console.log('🔧 Criando usuário administrador...');
    
    // Verificar se admin já existe
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('✅ Usuário admin já existe:', ADMIN_EMAIL);
      console.log('🔑 Email:', ADMIN_EMAIL);
      console.log('🔑 Senha:', ADMIN_PASSWORD);
      return;
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    // Criar usuário admin
    const adminUser = await db.insert(users).values({
      email: ADMIN_EMAIL,
      username: 'admin',
      password: hashedPassword,
      fullName: 'Administrador CNVidas',
      role: 'admin',
      emailVerified: true,
      subscriptionPlan: 'premium',
      subscriptionStatus: 'active'
    }).returning();
    
    console.log('✅ Usuário admin criado com sucesso!');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Senha:', ADMIN_PASSWORD);
    console.log('👤 ID:', adminUser[0].id);
    
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error.message);
  }
}

createAdmin().then(() => {
  console.log('🎯 Processo concluído.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});