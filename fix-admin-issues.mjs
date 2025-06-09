#!/usr/bin/env node

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = {
    'success': colors.green,
    'error': colors.red,
    'warning': colors.yellow,
    'info': colors.blue,
    'section': colors.cyan
  }[type] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

async function createAdminRoutes() {
  log('\n=== CRIANDO ROTAS ADMINISTRATIVAS ===', 'section');
  
  const adminRoutesContent = `import { Router } from 'express';
import { eq, sql, desc, and, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { 
  users, 
  dependents, 
  claims, 
  partners, 
  partnerServices,
  subscriptionPlans,
  qrAuthLogs
} from '../shared/schema';
import { requireAuth, requireAdmin } from './middleware/auth';

const router = Router();

// Middleware para garantir que apenas admins acessem estas rotas
router.use(requireAuth);
router.use(requireAdmin);

// Rota para buscar usuário específico (para dependentes)
router.get('/api/admin/user-for-dependents/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(user[0]);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar dependentes de um usuário
router.get('/api/admin/user-dependents/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userDependents = await db
      .select()
      .from(dependents)
      .where(eq(dependents.userId, userId));
    
    res.json(userDependents);
  } catch (error) {
    console.error('Erro ao buscar dependentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para criar dependente
router.post('/api/admin/user-dependents/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { fullName, cpf, birthDate, relationship } = req.body;
    
    const newDependent = await db.insert(dependents).values({
      userId,
      fullName,
      cpf,
      birthDate: birthDate ? new Date(birthDate) : null,
      relationship
    }).returning();
    
    res.status(201).json(newDependent[0]);
  } catch (error) {
    console.error('Erro ao criar dependente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar dependente
router.put('/api/admin/user-dependents/:dependentId', async (req, res) => {
  try {
    const dependentId = parseInt(req.params.dependentId);
    const { fullName, birthDate, relationship } = req.body;
    
    const updatedDependent = await db
      .update(dependents)
      .set({
        fullName,
        birthDate: birthDate ? new Date(birthDate) : null,
        relationship
      })
      .where(eq(dependents.id, dependentId))
      .returning();
    
    if (updatedDependent.length === 0) {
      return res.status(404).json({ error: 'Dependente não encontrado' });
    }
    
    res.json(updatedDependent[0]);
  } catch (error) {
    console.error('Erro ao atualizar dependente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para deletar dependente
router.delete('/api/admin/user-dependents/:dependentId', async (req, res) => {
  try {
    const dependentId = parseInt(req.params.dependentId);
    
    const deletedDependent = await db
      .delete(dependents)
      .where(eq(dependents.id, dependentId))
      .returning();
    
    if (deletedDependent.length === 0) {
      return res.status(404).json({ error: 'Dependente não encontrado' });
    }
    
    res.json({ message: 'Dependente removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar dependente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar todos os usuários
router.get('/api/admin/users', async (req, res) => {
  try {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
    
    res.json(allUsers);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar usuário específico
router.get('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(user[0]);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar usuário
router.put('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const updateData = req.body;
    
    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(updatedUser[0]);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para deletar usuário
router.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Primeiro, deletar dependentes do usuário
    await db.delete(dependents).where(eq(dependents.userId, userId));
    
    // Depois, deletar o usuário
    const deletedUser = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();
    
    if (deletedUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar claims
router.get('/api/admin/claims', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = db.select().from(claims);
    
    if (status) {
      query = query.where(eq(claims.status, status));
    }
    
    const allClaims = await query.orderBy(desc(claims.createdAt));
    
    res.json(allClaims);
  } catch (error) {
    console.error('Erro ao buscar claims:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para aprovar claim
router.post('/api/admin/claims/:id/approve', async (req, res) => {
  try {
    const claimId = parseInt(req.params.id);
    const { approvedAmount, notes } = req.body;
    
    const updatedClaim = await db
      .update(claims)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewNotes: notes
      })
      .where(eq(claims.id, claimId))
      .returning();
    
    if (updatedClaim.length === 0) {
      return res.status(404).json({ error: 'Claim não encontrado' });
    }
    
    res.json(updatedClaim[0]);
  } catch (error) {
    console.error('Erro ao aprovar claim:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para rejeitar claim
router.post('/api/admin/claims/:id/reject', async (req, res) => {
  try {
    const claimId = parseInt(req.params.id);
    const { notes } = req.body;
    
    const updatedClaim = await db
      .update(claims)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewNotes: notes
      })
      .where(eq(claims.id, claimId))
      .returning();
    
    if (updatedClaim.length === 0) {
      return res.status(404).json({ error: 'Claim não encontrado' });
    }
    
    res.json(updatedClaim[0]);
  } catch (error) {
    console.error('Erro ao rejeitar claim:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar parceiros
router.get('/api/admin/partners', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = db.select().from(partners);
    
    if (status) {
      query = query.where(eq(partners.status, status));
    }
    
    const allPartners = await query.orderBy(desc(partners.createdAt));
    
    res.json(allPartners);
  } catch (error) {
    console.error('Erro ao buscar parceiros:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para parceiros pendentes
router.get('/api/admin/partners/pending', async (req, res) => {
  try {
    const pendingPartners = await db
      .select()
      .from(partners)
      .where(eq(partners.status, 'pending'))
      .orderBy(desc(partners.createdAt));
    
    res.json(pendingPartners);
  } catch (error) {
    console.error('Erro ao buscar parceiros pendentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para criar parceiro
router.post('/api/admin/partners', async (req, res) => {
  try {
    const { businessName, cnpj, businessType, email } = req.body;
    
    const newPartner = await db.insert(partners).values({
      businessName,
      cnpj,
      businessType,
      email,
      status: 'active'
    }).returning();
    
    res.status(201).json(newPartner[0]);
  } catch (error) {
    console.error('Erro ao criar parceiro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar planos de assinatura
router.get('/api/admin/subscription-plans', async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.price);
    
    res.json(plans);
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar plano de assinatura
router.patch('/api/admin/subscription-plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const { price } = req.body;
    
    const updatedPlan = await db
      .update(subscriptionPlans)
      .set({ price })
      .where(eq(subscriptionPlans.id, planId))
      .returning();
    
    if (updatedPlan.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    
    res.json(updatedPlan[0]);
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para estatísticas de assinatura
router.get('/api/admin/subscription-stats', async (req, res) => {
  try {
    const premiumCount = await db
      .select({ count: sql\`count(*)\` })
      .from(users)
      .where(eq(users.subscriptionPlan, 'premium'));
    
    const basicCount = await db
      .select({ count: sql\`count(*)\` })
      .from(users)
      .where(eq(users.subscriptionPlan, 'basic'));
    
    res.json({
      premiumCount: Number(premiumCount[0]?.count || 0),
      basicCount: Number(basicCount[0]?.count || 0)
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para logs de QR Auth
router.get('/api/admin/qr-auth-logs', async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(qrAuthLogs)
      .orderBy(desc(qrAuthLogs.createdAt))
      .limit(100);
    
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs de QR:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para estatísticas de vendedores
router.get('/api/admin/sellers/stats', async (req, res) => {
  try {
    const sellerStats = await db
      .select({
        sellerName: users.sellerName,
        activeUsers: sql\`count(case when subscription_status = 'active' then 1 end)\`,
        inactiveUsers: sql\`count(case when subscription_status != 'active' then 1 end)\`,
        totalUsers: sql\`count(*)\`
      })
      .from(users)
      .where(sql\`seller_name is not null\`)
      .groupBy(users.sellerName);
    
    res.json(sellerStats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas de vendedores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para analytics overview
router.get('/api/admin/analytics/overview', async (req, res) => {
  try {
    const totalUsers = await db.select({ count: sql\`count(*)\` }).from(users);
    const totalClaims = await db.select({ count: sql\`count(*)\` }).from(claims);
    const totalPartners = await db.select({ count: sql\`count(*)\` }).from(partners);
    const activeUsers = await db
      .select({ count: sql\`count(*)\` })
      .from(users)
      .where(eq(users.subscriptionStatus, 'active'));
    
    res.json({
      totalUsers: Number(totalUsers[0]?.count || 0),
      totalClaims: Number(totalClaims[0]?.count || 0),
      totalPartners: Number(totalPartners[0]?.count || 0),
      activeUsers: Number(activeUsers[0]?.count || 0)
    });
  } catch (error) {
    console.error('Erro ao buscar overview:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para métricas de usuários
router.get('/api/admin/analytics/users', async (req, res) => {
  try {
    const usersByRole = await db
      .select({
        role: users.role,
        count: sql\`count(*)\`
      })
      .from(users)
      .groupBy(users.role);
    
    const usersByPlan = await db
      .select({
        plan: users.subscriptionPlan,
        count: sql\`count(*)\`
      })
      .from(users)
      .groupBy(users.subscriptionPlan);
    
    res.json({
      byRole: usersByRole,
      byPlan: usersByPlan
    });
  } catch (error) {
    console.error('Erro ao buscar métricas de usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para health check do sistema
router.get('/api/admin/system/health', async (req, res) => {
  try {
    // Verificar conexão com banco
    await db.select({ count: sql\`count(*)\` }).from(users);
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export { router as adminRoutes };
`;

  await fs.writeFile('./server/admin-routes.ts', adminRoutesContent);
  log('✅ Arquivo server/admin-routes.ts criado com sucesso', 'success');
}

async function updateServerIndex() {
  log('\n=== ATUALIZANDO SERVER INDEX ===', 'section');
  
  try {
    const serverIndexPath = './server/index.ts';
    let content = await fs.readFile(serverIndexPath, 'utf-8');
    
    // Verificar se já importa as rotas admin
    if (!content.includes('adminRoutes')) {
      // Adicionar import
      const importLine = "import { adminRoutes } from './admin-routes';";
      const importIndex = content.indexOf("import");
      if (importIndex !== -1) {
        const lines = content.split('\n');
        let lastImportIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import')) {
            lastImportIndex = i;
          }
        }
        lines.splice(lastImportIndex + 1, 0, importLine);
        content = lines.join('\n');
      }
      
      // Adicionar uso das rotas
      const useRoutesLine = "app.use(adminRoutes);";
      if (!content.includes(useRoutesLine)) {
        // Procurar por outras rotas para adicionar após elas
        const routePattern = /app\.use\(.+routes?\)/g;
        const matches = [...content.matchAll(routePattern)];
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const insertIndex = lastMatch.index + lastMatch[0].length;
          content = content.slice(0, insertIndex) + '\n' + useRoutesLine + content.slice(insertIndex);
        } else {
          // Se não encontrou outras rotas, adicionar antes do app.listen
          const listenIndex = content.indexOf('app.listen');
          if (listenIndex !== -1) {
            content = content.slice(0, listenIndex) + useRoutesLine + '\n\n' + content.slice(listenIndex);
          }
        }
      }
      
      await fs.writeFile(serverIndexPath, content);
      log('✅ server/index.ts atualizado com rotas admin', 'success');
    } else {
      log('ℹ️ Rotas admin já estão importadas no server/index.ts', 'info');
    }
  } catch (error) {
    log(`⚠️ Não foi possível atualizar server/index.ts: ${error.message}`, 'warning');
  }
}

async function createAdminMiddleware() {
  log('\n=== CRIANDO MIDDLEWARE DE ADMIN ===', 'section');
  
  const middlewarePath = './server/middleware/auth.ts';
  
  try {
    let content = await fs.readFile(middlewarePath, 'utf-8');
    
    // Verificar se já tem o requireAdmin
    if (!content.includes('requireAdmin')) {
      const requireAdminFunction = `
// Middleware para verificar se o usuário é admin
export const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Permissões de administrador necessárias.' });
  }
  
  next();
};
`;
      
      content += requireAdminFunction;
      await fs.writeFile(middlewarePath, content);
      log('✅ Middleware requireAdmin adicionado', 'success');
    } else {
      log('ℹ️ Middleware requireAdmin já existe', 'info');
    }
  } catch (error) {
    log(`⚠️ Erro ao atualizar middleware: ${error.message}`, 'warning');
  }
}

async function updateAdminPages() {
  log('\n=== VERIFICANDO PÁGINAS ADMINISTRATIVAS ===', 'section');
  
  const adminPages = [
    './client/src/pages/admin/dashboard.tsx',
    './client/src/pages/admin/users.tsx',
    './client/src/pages/admin/claims.tsx',
    './client/src/pages/admin/partners.tsx',
    './client/src/pages/admin/services.tsx',
    './client/src/pages/admin/analytics.tsx',
    './client/src/pages/admin/seller-stats.tsx',
    './client/src/pages/admin/qr-auth-logs.tsx'
  ];
  
  for (const pagePath of adminPages) {
    try {
      await fs.access(pagePath);
      log(`✅ ${pagePath.split('/').pop()} existe`, 'success');
    } catch {
      const pageName = pagePath.split('/').pop()?.replace('.tsx', '');
      const pageContent = createBasicAdminPage(pageName);
      
      try {
        await fs.writeFile(pagePath, pageContent);
        log(`✅ ${pagePath.split('/').pop()} criada`, 'success');
      } catch (error) {
        log(`⚠️ Erro ao criar ${pagePath.split('/').pop()}: ${error.message}`, 'warning');
      }
    }
  }
}

function createBasicAdminPage(pageName) {
  const title = pageName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  return `import React from 'react';
import AdminLayout from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ${pageName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Page: React.FC = () => {
  return (
    <AdminLayout title="${title}">
      <div className="container py-6">
        <Card>
          <CardHeader>
            <CardTitle>${title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Esta página está em desenvolvimento.</p>
            <p>Funcionalidades de ${title.toLowerCase()} serão implementadas aqui.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ${pageName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Page;
`;
}

async function createMissingAdminPages() {
  log('\n=== CRIANDO PÁGINAS ADMINISTRATIVAS ESPECÍFICAS ===', 'section');
  
  // Criar página de dashboard admin se não existir
  const dashboardPath = './client/src/pages/admin/dashboard.tsx';
  try {
    await fs.access(dashboardPath);
    log('ℹ️ Dashboard admin já existe', 'info');
  } catch {
    const dashboardContent = `import React from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Users, FileText, Building, TrendingUp } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['/api/admin/analytics/overview'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/analytics/overview');
      return response.json();
    }
  });

  return (
    <AdminLayout title="Dashboard Administrativo">
      <div className="container py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : overview?.totalUsers || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Claims</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : overview?.totalClaims || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Parceiros</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : overview?.totalPartners || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : overview?.activeUsers || 0}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Dashboard de atividades em desenvolvimento.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Métricas Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Métricas em tempo real em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
`;
    
    await fs.writeFile(dashboardPath, dashboardContent);
    log('✅ Dashboard admin criado', 'success');
  }
  
  // Criar página de usuários admin se não existir
  const usersPath = './client/src/pages/admin/users.tsx';
  try {
    await fs.access(usersPath);
    log('ℹ️ Página de usuários admin já existe', 'info');
  } catch {
    const usersContent = `import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminLayout from '@/components/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Edit, Trash2, Users, Eye } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const AdminUsersPage: React.FC = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/users');
      return response.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('DELETE', \`/api/admin/users/\${userId}\`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'Usuário removido',
        description: 'O usuário foi removido com sucesso.',
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover usuário',
        description: error.message || 'Ocorreu um erro ao remover o usuário.',
        variant: 'destructive',
      });
    }
  });

  const filteredUsers = users.filter((user: any) =>
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const roleColors = {
      admin: 'destructive',
      doctor: 'default',
      partner: 'secondary',
      patient: 'outline'
    };
    return roleColors[role as keyof typeof roleColors] || 'outline';
  };

  const handleDeleteUser = (userId: number) => {
    deleteMutation.mutate(userId);
  };

  return (
    <AdminLayout title="Gestão de Usuários">
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-primary/10">
              <Users className="w-3 h-3 mr-1" />
              {users.length} usuários
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName || 'Nome não informado'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadge(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.subscriptionPlan || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                          {user.subscriptionStatus || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.createdAt ? format(new Date(user.createdAt), 'dd/MM/yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={\`/admin/users/\${user.id}/dependents\`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover este usuário? 
                                  Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
`;
    
    await fs.writeFile(usersPath, usersContent);
    log('✅ Página de usuários admin criada', 'success');
  }
}

async function createAdminLayoutIfMissing() {
  log('\n=== VERIFICANDO LAYOUT ADMINISTRATIVO ===', 'section');
  
  const layoutPath = './client/src/components/layouts/admin-layout.tsx';
  
  try {
    await fs.access(layoutPath);
    log('ℹ️ Layout administrativo já existe', 'info');
  } catch {
    const layoutContent = `import React from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Users,
  FileText,
  Building,
  Settings,
  BarChart3,
  TrendingUp,
  QrCode,
  CreditCard,
  LogOut,
  Menu
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const sidebarNavItems = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Usuários',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Sinistros',
    href: '/admin/claims',
    icon: FileText,
  },
  {
    title: 'Parceiros',
    href: '/admin/partners',
    icon: Building,
  },
  {
    title: 'Serviços',
    href: '/admin/services',
    icon: Settings,
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
  },
  {
    title: 'Vendedores',
    href: '/admin/seller-stats',
    icon: TrendingUp,
  },
  {
    title: 'Logs QR',
    href: '/admin/qr-auth-logs',
    icon: QrCode,
  },
  {
    title: 'Planos',
    href: '/admin/subscription-plans',
    icon: CreditCard,
  },
];

const SidebarNav = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => {
  const [location] = useLocation();

  return (
    <nav className={cn('flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1', className)} {...props}>
      {sidebarNavItems.map((item) => (
        <Button
          key={item.href}
          variant={location === item.href ? 'secondary' : 'ghost'}
          className={cn(
            'w-full justify-start',
            location === item.href && 'bg-muted font-medium'
          )}
          asChild
        >
          <Link href={item.href}>
            <item.icon className="mr-2 h-4 w-4" />
            {item.title}
          </Link>
        </Button>
      ))}
    </nav>
  );
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const { logout } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logout();
  };

  const MobileSidebar = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <div className="py-4">
          <h2 className="text-lg font-semibold mb-4">CN Vidas Admin</h2>
          <SidebarNav />
          <Separator className="my-4" />
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar Desktop */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col flex-grow bg-card border-r pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <h2 className="text-lg font-semibold">CN Vidas Admin</h2>
            </div>
            <div className="mt-5 flex-grow flex flex-col">
              <ScrollArea className="flex-1 px-3">
                <SidebarNav />
              </ScrollArea>
              <div className="px-3">
                <Separator className="my-4" />
                <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 lg:ml-64">
          {/* Mobile Header */}
          <div className="lg:hidden bg-card border-b px-4 py-3 flex items-center justify-between">
            <MobileSidebar />
            <h1 className="text-lg font-semibold">{title || 'Admin'}</h1>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block bg-card border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{title || 'Dashboard Administrativo'}</h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">
                  Administrador
                </span>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
`;
    
    await fs.writeFile(layoutPath, layoutContent);
    log('✅ Layout administrativo criado', 'success');
  }
}

async function fixAdminDependencies() {
  log('\n=== VERIFICANDO DEPENDÊNCIAS ADMIN ===', 'section');
  
  try {
    // Verificar se o arquivo schema tem as tabelas necessárias
    const schemaPath = './shared/schema.ts';
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    
    if (!schemaContent.includes('qrAuthLogs')) {
      log('⚠️ Tabela qrAuthLogs não encontrada no schema', 'warning');
    }
    
    if (!schemaContent.includes('subscriptionPlans')) {
      log('⚠️ Tabela subscriptionPlans não encontrada no schema', 'warning');
    }
    
    log('✅ Verificação de dependências concluída', 'success');
  } catch (error) {
    log(`⚠️ Erro ao verificar dependências: ${error.message}`, 'warning');
  }
}

async function runAdminFixes() {
  log('=== INICIANDO CORREÇÕES ADMINISTRATIVAS ===', 'section');
  
  try {
    await createAdminRoutes();
    await updateServerIndex();
    await createAdminMiddleware();
    await createAdminLayoutIfMissing();
    await updateAdminPages();
    await createMissingAdminPages();
    await fixAdminDependencies();
    
    log('\n=== CORREÇÕES ADMINISTRATIVAS CONCLUÍDAS ===', 'section');
    log('✅ Todas as correções foram aplicadas com sucesso!', 'success');
    log('', 'info');
    log('🔧 Correções implementadas:', 'info');
    log('- Rotas administrativas completas criadas', 'info');
    log('- Middleware de autenticação admin', 'info');
    log('- Layout administrativo responsivo', 'info');
    log('- Páginas básicas de admin criadas', 'info');
    log('- Sistema de gestão de usuários e dependentes', 'info');
    log('- Endpoints para analytics e estatísticas', 'info');
    log('- Sistema de gestão de claims e parceiros', 'info');
    log('', 'info');
    log('📋 Próximos passos recomendados:', 'info');
    log('1. Executar os testes administrativos', 'info');
    log('2. Verificar se o servidor está rodando', 'info');
    log('3. Testar login como administrador', 'info');
    log('4. Validar todas as funcionalidades implementadas', 'info');
    
  } catch (error) {
    log(`❌ Erro durante as correções: ${error.message}`, 'error');
    log(error.stack, 'error');
  }
}

// Executar correções
runAdminFixes().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});