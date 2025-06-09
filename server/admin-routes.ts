import { Router } from 'express';
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
      .select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.subscriptionPlan, 'premium'));
    
    const basicCount = await db
      .select({ count: sql`count(*)` })
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
        activeUsers: sql`count(case when subscription_status = 'active' then 1 end)`,
        inactiveUsers: sql`count(case when subscription_status != 'active' then 1 end)`,
        totalUsers: sql`count(*)`
      })
      .from(users)
      .where(sql`seller_name is not null`)
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
    const totalUsers = await db.select({ count: sql`count(*)` }).from(users);
    const totalClaims = await db.select({ count: sql`count(*)` }).from(claims);
    const totalPartners = await db.select({ count: sql`count(*)` }).from(partners);
    const activeUsers = await db
      .select({ count: sql`count(*)` })
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
        count: sql`count(*)`
      })
      .from(users)
      .groupBy(users.role);
    
    const usersByPlan = await db
      .select({
        plan: users.subscriptionPlan,
        count: sql`count(*)`
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
    await db.select({ count: sql`count(*)` }).from(users);
    
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
