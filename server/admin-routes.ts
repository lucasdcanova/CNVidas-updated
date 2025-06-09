import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from './middleware/auth';
import { AuthenticatedRequest } from './types';

const router = Router();

// Middleware para garantir que apenas admins acessem estas rotas
router.use(requireAuth);
router.use(requireAdmin);

// Health check route
router.get('/health', async (req, res) => {
  res.json({ status: 'ok', message: 'Admin routes working' });
});

// Admin routes with real implementations
router.get('/users', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const users = await storage.getAllUsers();
    // Remove passwords before sending
    const usersWithoutPassword = users.map(({ password, ...user }) => user);
    res.json(usersWithoutPassword);
  } catch (error) {
    console.error('Error in admin users route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users', async (req, res) => {
  try {
    res.json({ 
      message: 'Create user endpoint', 
      data: req.body 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suportar tanto PUT quanto PATCH para compatibilidade
router.put('/users/:id', updateUserHandler);
router.patch('/users/:id', updateUserHandler);

async function updateUserHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o usuário existe
    const user = await storage.getUserById(parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remover campos que não devem ser atualizados diretamente
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // Se a senha estiver vazia, removê-la da atualização
    if (!updateData.password || updateData.password === '') {
      delete updateData.password;
    } else {
      // Hash da nova senha se fornecida
      const bcrypt = await import('bcryptjs');
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    // Atualizar o usuário
    await storage.updateUser(parseInt(id), updateData);
    
    // Buscar o usuário atualizado
    const updatedUser = await storage.getUserById(parseInt(id));
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { storage } = await import('./storage');
    
    // Verificar se o usuário existe
    const user = await storage.getUserById(parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Não permitir que admin delete a si mesmo
    if (user.id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Deletar o usuário
    await storage.deleteUser(parseInt(id));
    
    res.json({ 
      message: 'User deleted successfully', 
      userId: id 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/claims', async (req, res) => {
  try {
    res.json({ 
      message: 'Admin claims endpoint', 
      claims: [],
      total: 0 
    });
  } catch (error) {
    console.error('Error in admin claims route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/claims/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Update claim endpoint', 
      claimId: id,
      data: req.body 
    });
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/partners', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const partners = await storage.getAllPartners();
    res.json(partners);
  } catch (error) {
    console.error('Error in admin partners route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/partners', async (req, res) => {
  try {
    res.json({ 
      message: 'Create partner endpoint', 
      data: req.body 
    });
  } catch (error) {
    console.error('Error creating partner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/partners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Update partner endpoint', 
      partnerId: id,
      data: req.body 
    });
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/partners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Delete partner endpoint', 
      partnerId: id 
    });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/services', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const services = await storage.getAllServices();
    
    // Enrich services with partner names
    const partners = await storage.getAllPartners();
    const partnersMap = new Map(partners.map(p => [p.id, p]));
    
    const enrichedServices = services.map(service => ({
      ...service,
      partnerName: partnersMap.get(service.partnerId)?.businessName || 'Parceiro Desconhecido'
    }));
    
    res.json(enrichedServices);
  } catch (error) {
    console.error('Error in admin services route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/services', async (req, res) => {
  try {
    res.json({ 
      message: 'Create service endpoint', 
      data: req.body 
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Update service endpoint', 
      serviceId: id,
      data: req.body 
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Delete service endpoint', 
      serviceId: id 
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending-claims', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const claims = await storage.getPendingClaims();
    res.json(claims);
  } catch (error) {
    console.error('Error in admin pending claims route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/claims', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const claims = await storage.getAllClaims();
    res.json(claims);
  } catch (error) {
    console.error('Error in admin claims route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics/overview', async (req, res) => {
  try {
    res.json({ 
      totalUsers: 0,
      totalClaims: 0,
      totalPartners: 0,
      activeUsers: 0,
      totalRevenue: 0,
      monthlyGrowth: 0
    });
  } catch (error) {
    console.error('Error in admin analytics route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/subscription-plans', async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Error in admin subscription plans route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/subscription-plans', async (req, res) => {
  try {
    res.json({ 
      message: 'Create subscription plan endpoint', 
      data: req.body 
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/subscription-plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Update subscription plan endpoint', 
      planId: id,
      data: req.body 
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para atualizar plano de assinatura
router.patch('/users/:id/subscription', async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriptionPlan, subscriptionStatus } = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o usuário existe
    const user = await storage.getUserById(parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'patient') {
      return res.status(400).json({ error: 'Subscription can only be updated for patients' });
    }
    
    // Atualizar o plano
    const updateData: any = {
      subscriptionPlan: subscriptionPlan || 'free',
      subscriptionStatus: subscriptionStatus || 'active'
    };
    
    if (subscriptionPlan !== 'free') {
      updateData.subscriptionStartDate = new Date();
    } else {
      updateData.subscriptionStatus = 'inactive';
      updateData.subscriptionEndDate = new Date();
    }
    
    await storage.updateUser(parseInt(id), updateData);
    
    res.json({ 
      message: 'Subscription updated successfully',
      userId: id,
      subscriptionPlan,
      subscriptionStatus: updateData.subscriptionStatus
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/subscription-stats', async (req, res) => {
  try {
    res.json({
      premiumCount: 0,
      basicCount: 0,
      freeCount: 0,
      totalRevenue: 0
    });
  } catch (error) {
    console.error('Error in admin subscription stats route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para estatísticas gerais do admin
router.get('/stats', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    
    // Get all users to count by role
    const allUsers = await storage.getAllUsers();
    
    // Count users by role
    const totalPatients = allUsers.filter(u => u.role === 'patient').length;
    const totalDoctors = allUsers.filter(u => u.role === 'doctor').length;
    const totalPartners = allUsers.filter(u => u.role === 'partner').length;
    
    res.json({
      totalUsers: allUsers.length,
      totalPatients,
      totalDoctors,
      totalPartners,
      totalAppointments: 0, // TODO: Implement appointments count
      pendingClaims: 0 // TODO: Implement claims count
    });
  } catch (error) {
    console.error('Error in admin stats route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para usuários recentes
router.get('/recent-users', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const users = await storage.getAllUsers();
    
    // Sort by createdAt descending and take the first 10
    const recentUsers = users
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(({ password, ...user }) => user);
    
    res.json(recentUsers);
  } catch (error) {
    console.error('Error in admin recent users route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para consultas recentes
router.get('/recent-appointments', async (req, res) => {
  try {
    // TODO: Implement actual appointments retrieval
    res.json([]);
  } catch (error) {
    console.error('Error in admin recent appointments route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para sinistros pendentes
router.get('/pending-claims', async (req, res) => {
  try {
    // TODO: Implement actual pending claims retrieval
    res.json([]);
  } catch (error) {
    console.error('Error in admin pending claims route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/qr-auth-logs', async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Error in admin QR auth logs route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para listar todos os vendedores
router.get('/sellers', async (req, res) => {
  try {
    const { getAllSellers } = await import('./seller-utils');
    const sellers = await getAllSellers();
    
    // Contar quantos usuários cada vendedor tem
    const { storage } = await import('./storage');
    const sellersWithStats = await Promise.all(
      sellers.map(async (sellerName) => {
        const usersCount = await storage.countUsersBySeller(sellerName);
        return {
          name: sellerName,
          usersCount
        };
      })
    );
    
    res.json(sellersWithStats);
  } catch (error) {
    console.error('Error in admin sellers route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sellers/stats', async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Error in admin seller stats route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotas para gerenciar perfis médicos
router.patch('/doctors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o médico existe
    const doctor = await storage.getDoctor(parseInt(id));
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    // Atualizar o perfil médico
    const updatedDoctor = await storage.updateDoctor(parseInt(id), updateData);
    
    res.json(updatedDoctor);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotas para gerenciar dependentes
router.get('/user-for-dependents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { storage } = await import('./storage');
    
    const user = await storage.getUserById(parseInt(userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error fetching user for dependents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/user-dependents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { storage } = await import('./storage');
    
    // Verificar se o usuário existe
    const user = await storage.getUserById(parseInt(userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Buscar dependentes do usuário
    const dependents = await storage.getDependentsByUserId(parseInt(userId));
    res.json(dependents);
  } catch (error) {
    console.error('Error fetching user dependents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/user-dependents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const dependentData = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o usuário existe e é paciente
    const user = await storage.getUserById(parseInt(userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'patient') {
      return res.status(400).json({ error: 'Only patients can have dependents' });
    }
    
    // Adicionar o userId aos dados do dependente
    const dependent = await storage.createDependent({
      ...dependentData,
      userId: parseInt(userId)
    });
    
    res.json(dependent);
  } catch (error) {
    console.error('Error creating dependent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/user-dependents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o dependente existe
    const dependent = await storage.getDependent(parseInt(id));
    if (!dependent) {
      return res.status(404).json({ error: 'Dependent not found' });
    }
    
    // Remover campos que não devem ser atualizados
    delete updateData.id;
    delete updateData.userId;
    delete updateData.cpf; // CPF não pode ser alterado
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // Atualizar o dependente
    const updatedDependent = await storage.updateDependent(parseInt(id), updateData);
    
    res.json(updatedDependent);
  } catch (error) {
    console.error('Error updating dependent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/user-dependents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { storage } = await import('./storage');
    
    // Verificar se o dependente existe
    const dependent = await storage.getDependent(parseInt(id));
    if (!dependent) {
      return res.status(404).json({ error: 'Dependent not found' });
    }
    
    // Deletar o dependente
    await storage.deleteDependent(parseInt(id));
    
    res.json({ message: 'Dependent deleted successfully' });
  } catch (error) {
    console.error('Error deleting dependent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para conceder acesso premium gratuito
router.post('/users/:id/premium-access', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { plan, reason } = req.body;
    
    if (!plan || !reason) {
      return res.status(400).json({ error: 'Plan and reason are required' });
    }
    
    const { storage } = await import('./storage');
    const user = await storage.getUserById(parseInt(id));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'patient') {
      return res.status(400).json({ error: 'Premium access can only be granted to patients' });
    }
    
    // Atualizar o plano do usuário
    await storage.updateUser(parseInt(id), {
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: null, // Gratuito por tempo indeterminado
    });
    
    // Registrar no audit log
    await storage.createAuditLog({
      userId: req.user?.id,
      action: 'grant_premium_access',
      details: { 
        targetUserId: parseInt(id), 
        plan, 
        reason,
        grantedBy: req.user?.email 
      },
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date()
    });
    
    res.json({ 
      message: 'Premium access granted successfully', 
      userId: id,
      plan: plan 
    });
  } catch (error) {
    console.error('Error granting premium access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manter a rota antiga para compatibilidade
router.post('/users/:id/grant-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;
    res.json({ 
      message: 'Grant plan to user endpoint', 
      userId: id,
      plan: plan 
    });
  } catch (error) {
    console.error('Error granting plan to user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as adminRoutes };