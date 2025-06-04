import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { AuthenticatedRequest } from '../types/authenticated-request';

interface TypeFix {
  file: string;
  fixes: {
    search: string;
    replace: string;
  }[];
}

const typeFixes: TypeFix[] = [
  {
    file: 'server/auth.ts',
    fixes: [
      {
        search: 'declare global {',
        replace: `declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: string;
      username: string;
      fullName: string;
      emailVerified: boolean;
    }
  }`
      }
    ]
  },
  {
    file: 'server/routes/auth-routes.ts',
    fixes: [
      {
        search: 'import { Router, Request, Response } from \'express\';',
        replace: `import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';`
      }
    ]
  }
];

class TypeFixer {
  private rootDir: string;

  constructor() {
    this.rootDir = process.cwd();
  }

  async fixTypes() {
    console.log('🔧 Corrigindo problemas de tipagem...\n');

    for (const fix of typeFixes) {
      const filePath = path.join(this.rootDir, fix.file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Arquivo não encontrado: ${fix.file}`);
        continue;
      }

      let content = fs.readFileSync(filePath, 'utf-8');
      let modified = false;

      for (const { search, replace } of fix.fixes) {
        if (content.includes(search)) {
          content = content.replace(search, replace);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Corrigido: ${fix.file}`);
      }
    }

    // Executar verificação de tipos
    try {
      execSync('tsc --noEmit', { stdio: 'inherit' });
      console.log('\n✅ Verificação de tipos concluída com sucesso!');
    } catch (error) {
      console.error('\n❌ Ainda existem erros de tipo que precisam ser corrigidos manualmente.');
      process.exit(1);
    }
  }
}

// Executar correção
const fixer = new TypeFixer();
fixer.fixTypes().catch(console.error); 