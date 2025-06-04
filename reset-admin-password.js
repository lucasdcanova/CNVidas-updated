import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { hashPassword } from './server/auth.js';
import { eq } from 'drizzle-orm';

async function resetAdminPassword() {
  try {
    // Definindo a nova senha como 'admin123'
    const hashedPassword = await hashPassword('admin123');
    
    // Atualizando a senha do administrador
    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, 'admin@cnvidas.com'))
      .returning();
      
    console.log('Senha do administrador redefinida com sucesso.');
    console.log('Admin ID:', result[0].id);
    console.log('Admin Email:', result[0].email);
    
    process.exit(0);
  } catch (error) {
    console.error('Erro ao redefinir a senha do administrador:', error);
    process.exit(1);
  }
}

resetAdminPassword();