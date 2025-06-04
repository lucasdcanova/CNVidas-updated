import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface BuildError {
  type: 'import' | 'type' | 'dependency' | 'configuration' | 'route' | 'database';
  message: string;
  file?: string;
  line?: number;
  fix?: () => void;
}

class BuildChecker {
  private errors: BuildError[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = process.cwd();
  }

  async checkAll() {
    console.log('🔍 Iniciando verificação do build...\n');

    await this.checkDependencies();
    await this.checkTypeScript();
    await this.checkRoutes();
    await this.checkDatabase();
    await this.checkEnvironment();

    if (this.errors.length > 0) {
      console.log('\n❌ Erros encontrados:');
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. [${error.type.toUpperCase()}] ${error.message}`);
        if (error.file) console.log(`   Arquivo: ${error.file}`);
        if (error.line) console.log(`   Linha: ${error.line}`);
      });

      console.log('\n🛠️  Tentando corrigir erros automaticamente...');
      await this.fixErrors();

      if (this.errors.length > 0) {
        console.log('\n❌ Ainda existem erros que precisam ser corrigidos manualmente:');
        this.errors.forEach((error, index) => {
          console.log(`\n${index + 1}. [${error.type.toUpperCase()}] ${error.message}`);
          if (error.file) console.log(`   Arquivo: ${error.file}`);
          if (error.line) console.log(`   Linha: ${error.line}`);
        });
        process.exit(1);
      }
    }

    console.log('\n✅ Build verificado com sucesso!');
  }

  private async checkDependencies() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
      const requiredDeps = [
        'express',
        'passport',
        'drizzle-orm',
        '@neondatabase/serverless',
        'connect-pg-simple',
        'cors',
        'cookie-parser',
        'express-session'
      ];

      for (const dep of requiredDeps) {
        if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
          this.errors.push({
            type: 'dependency',
            message: `Dependência ${dep} não encontrada`,
            fix: () => {
              console.log(`Instalando ${dep}...`);
              execSync(`npm install ${dep}`, { stdio: 'inherit' });
            }
          });
        }
      }
    } catch (error) {
      this.errors.push({
        type: 'dependency',
        message: 'Erro ao verificar dependências: ' + error.message
      });
    }
  }

  private async checkTypeScript() {
    try {
      execSync('tsc --noEmit', { stdio: 'pipe' });
    } catch (error) {
      const output = error.stdout.toString() + error.stderr.toString();
      const lines = output.split('\n');
      
      for (const line of lines) {
        if (line.includes('error TS')) {
          const match = line.match(/(.+?)\((\d+),\d+\):/);
          if (match) {
            this.errors.push({
              type: 'type',
              message: line.split(':').slice(2).join(':').trim(),
              file: match[1],
              line: parseInt(match[2])
            });
          }
        }
      }
    }
  }

  private async checkRoutes() {
    const routesDir = path.join(this.rootDir, 'server/routes');
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
      
      // Verificar exportação do router
      if (!content.includes('export') || !content.includes('Router')) {
        this.errors.push({
          type: 'route',
          message: `Router não exportado corretamente em ${file}`,
          file: path.join('server/routes', file)
        });
      }

      // Verificar importações
      if (content.includes('import') && !content.includes('from')) {
        this.errors.push({
          type: 'import',
          message: `Importação inválida em ${file}`,
          file: path.join('server/routes', file)
        });
      }
    }
  }

  private async checkDatabase() {
    const dbFile = path.join(this.rootDir, 'server/db.ts');
    if (!fs.existsSync(dbFile)) {
      this.errors.push({
        type: 'database',
        message: 'Arquivo de configuração do banco de dados não encontrado',
        file: 'server/db.ts'
      });
      return;
    }

    const content = fs.readFileSync(dbFile, 'utf-8');
    if (!content.includes('DATABASE_URL')) {
      this.errors.push({
        type: 'database',
        message: 'Variável DATABASE_URL não configurada',
        file: 'server/db.ts'
      });
    }
  }

  private async checkEnvironment() {
    const envFile = path.join(this.rootDir, '.env');
    if (!fs.existsSync(envFile)) {
      this.errors.push({
        type: 'configuration',
        message: 'Arquivo .env não encontrado',
        fix: () => {
          const envContent = `DATABASE_URL=your_database_url
SESSION_SECRET=your_session_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
PORT=3000`;
          fs.writeFileSync(envFile, envContent);
          console.log('Arquivo .env criado com configurações padrão');
        }
      });
    }
  }

  private async fixErrors() {
    const errorsToFix = this.errors.filter(error => error.fix);
    this.errors = this.errors.filter(error => !error.fix);

    for (const error of errorsToFix) {
      try {
        await error.fix();
      } catch (fixError) {
        console.error(`Erro ao corrigir: ${error.message}`, fixError);
        this.errors.push(error);
      }
    }
  }
}

// Executar verificação
const checker = new BuildChecker();
checker.checkAll().catch(console.error); 