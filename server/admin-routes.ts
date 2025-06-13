import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from './middleware/auth';
import { AuthenticatedRequest } from './types';
import fs from 'fs';
import path from 'path';

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
    const userData = req.body;
    
    // Validação básica
    if (!userData.email || !userData.password || !userData.fullName || !userData.role) {
      return res.status(400).json({ error: 'Email, password, full name and role are required' });
    }
    
    // Validar role
    const validRoles = ['patient', 'doctor', 'partner', 'admin'];
    if (!validRoles.includes(userData.role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const { storage } = await import('./storage');
    
    // Verificar se o email já existe
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Se tiver CPF, verificar se já existe
    if (userData.cpf) {
      const existingCpf = await storage.getUserByCPF(userData.cpf);
      if (existingCpf) {
        return res.status(400).json({ error: 'CPF already exists' });
      }
    }
    
    // Hash da senha
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Criar o usuário
    const newUser = await storage.createUser({
      email: userData.email,
      username: userData.username || userData.email,
      password: hashedPassword,
      fullName: userData.fullName,
      role: userData.role,
      cpf: userData.cpf,
      phone: userData.phone,
      emailVerified: userData.isEmailVerified || false,
      subscriptionPlan: userData.role === 'patient' ? (userData.subscriptionPlan || 'free') : undefined,
      subscriptionStatus: userData.role === 'patient' ? (userData.subscriptionStatus || 'inactive') : undefined,
      sellerName: userData.sellerName,
    });
    
    // Se for médico, criar o perfil médico
    if (userData.role === 'doctor') {
      await storage.createDoctor({
        userId: newUser.id,
        specialization: userData.specialty || '',
        licenseNumber: userData.licenseNumber || '',
        consultationFee: userData.consultationPrice || 0,
      });
    }
    
    // Se for parceiro, criar o perfil de parceiro
    if (userData.role === 'partner') {
      await storage.createPartner({
        userId: newUser.id,
        businessName: userData.businessName || userData.fullName,
        businessType: userData.businessType || 'clinic',
        cnpj: userData.cnpj || '',
        tradingName: userData.tradingName || userData.businessName || userData.fullName,
      });
    }
    
    // Remover a senha antes de retornar
    const { password, ...userWithoutPassword } = newUser;
    
    res.status(201).json(userWithoutPassword);
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

// Rota duplicada removida - implementação correta está na linha 440

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
    const serviceData = req.body;
    
    // Validação básica
    if (!serviceData.partnerId || !serviceData.name) {
      return res.status(400).json({ error: 'Partner ID and name are required' });
    }
    
    const { storage } = await import('./storage');
    
    // Verificar se o parceiro existe
    const partner = await storage.getPartner(parseInt(serviceData.partnerId));
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    // Criar o serviço
    const newService = await storage.createPartnerService({
      partnerId: parseInt(serviceData.partnerId),
      name: serviceData.name,
      description: serviceData.description || '',
      regularPrice: serviceData.regularPrice || serviceData.price || 0,
      discountPrice: serviceData.discountPrice,
      discountPercentage: serviceData.discountPercentage,
      category: serviceData.category,
      duration: serviceData.duration || 30,
      isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
      isFeatured: serviceData.isFeatured || false,
    });
    
    res.status(201).json(newService);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o serviço existe
    const service = await storage.getService(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Remover campos que não devem ser atualizados
    delete updateData.id;
    delete updateData.partnerId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // Atualizar o serviço
    const updatedService = await storage.updateService(parseInt(id), updateData);
    
    res.json(updatedService);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suportar tanto PUT quanto PATCH para atualização de serviços
router.patch('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o serviço existe
    const service = await storage.getService(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Remover campos que não devem ser atualizados
    delete updateData.id;
    delete updateData.partnerId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // Atualizar o serviço
    const updatedService = await storage.updateService(parseInt(id), updateData);
    
    res.json(updatedService);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { storage } = await import('./storage');
    
    // Verificar se o serviço existe
    const service = await storage.getService(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Deletar o serviço
    await storage.deletePartnerService(parseInt(id));
    
    res.json({ 
      message: 'Service deleted successfully', 
      serviceId: id 
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para alternar destaque de serviço
router.patch('/services/:id/feature', async (req, res) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;
    
    const { storage } = await import('./storage');
    
    // Verificar se o serviço existe
    const service = await storage.getService(parseInt(id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Atualizar o status de destaque
    const updatedService = await storage.updateService(parseInt(id), {
      isFeatured: !!isFeatured
    });
    
    res.json(updatedService);
  } catch (error) {
    console.error('Error updating service feature status:', error);
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

router.patch('/claims/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { storage } = await import('./storage');
    
    // Verificar se o claim existe
    const claim = await storage.getClaim(parseInt(id));
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    // Processar valor aprovado se fornecido
    if (updateData.amountApproved) {
      updateData.amountApproved = Math.round(parseFloat(updateData.amountApproved) * 100);
    }
    
    // Atualizar o claim
    const updatedClaim = await storage.updateClaim(parseInt(id), {
      ...updateData,
      reviewedAt: new Date(),
    });
    
    res.json(updatedClaim);
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/claims/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { storage } = await import('./storage');
    
    // Verificar se o claim existe
    const claim = await storage.getClaim(parseInt(id));
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    // Deletar o claim
    const success = await storage.deleteClaim(parseInt(id));
    
    if (success) {
      res.json({ message: 'Claim deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete claim' });
    }
  } catch (error) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics/overview', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    
    // Obter dados reais
    const allUsers = await storage.getAllUsers();
    const patients = allUsers.filter(u => u.role === 'patient');
    const doctors = allUsers.filter(u => u.role === 'doctor');
    const partners = allUsers.filter(u => u.role === 'partner');
    
    // Calcular usuários ativos (com plano não free)
    const activePatients = patients.filter(p => p.subscriptionPlan && p.subscriptionPlan !== 'free');
    
    // Obter sinistros
    const claims = await storage.getAllClaims();
    const pendingClaims = claims.filter(c => c.status === 'pending');
    
    // Calcular receita mensal estimada
    const basicPlanPatients = patients.filter(p => p.subscriptionPlan === 'basic').length;
    const premiumPlanPatients = patients.filter(p => p.subscriptionPlan === 'premium').length;
    const monthlyRevenue = (basicPlanPatients * 49.90) + (premiumPlanPatients * 99.90);
    
    // Calcular crescimento mensal (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersLastMonth = patients.filter(p => new Date(p.createdAt) > thirtyDaysAgo).length;
    const monthlyGrowth = patients.length > 0 ? (newUsersLastMonth / patients.length) * 100 : 0;
    
    res.json({ 
      totalUsers: allUsers.length,
      totalPatients: patients.length,
      totalDoctors: doctors.length,
      totalPartners: partners.length,
      activeUsers: activePatients.length,
      totalClaims: claims.length,
      pendingClaims: pendingClaims.length,
      monthlyRevenue: monthlyRevenue.toFixed(2),
      monthlyGrowth: monthlyGrowth.toFixed(1),
      subscriptionBreakdown: {
        free: patients.filter(p => !p.subscriptionPlan || p.subscriptionPlan === 'free').length,
        basic: basicPlanPatients,
        premium: premiumPlanPatients
      }
    });
  } catch (error) {
    console.error('Error in admin analytics route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para dados de crescimento mensal
router.get('/analytics/growth', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const { months = 6 } = req.query;
    
    const allUsers = await storage.getAllUsers();
    const now = new Date();
    const monthsData = [];
    
    // Gerar dados para os últimos N meses
    for (let i = parseInt(months as string) - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const usersInMonth = allUsers.filter(u => {
        const createdAt = new Date(u.createdAt);
        return createdAt >= monthStart && createdAt <= monthEnd;
      });
      
      const monthName = monthStart.toLocaleDateString('pt-BR', { month: 'short' });
      
      monthsData.push({
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        newUsers: usersInMonth.length,
        totalUsers: allUsers.filter(u => new Date(u.createdAt) <= monthEnd).length
      });
    }
    
    res.json(monthsData);
  } catch (error) {
    console.error('Error in admin growth analytics route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para dados de receita
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { storage } = await import('./storage');
    const { months = 6 } = req.query;
    
    const allUsers = await storage.getAllUsers();
    const patients = allUsers.filter(u => u.role === 'patient');
    const now = new Date();
    const monthsData = [];
    
    // Gerar dados para os últimos N meses
    for (let i = parseInt(months as string) - 1; i >= 0; i--) {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      // Calcular pacientes ativos até o final do mês
      const activePatients = patients.filter(p => {
        const createdAt = new Date(p.createdAt);
        return createdAt <= monthEnd && p.subscriptionPlan && p.subscriptionPlan !== 'free';
      });
      
      const basicCount = activePatients.filter(p => p.subscriptionPlan === 'basic').length;
      const premiumCount = activePatients.filter(p => p.subscriptionPlan === 'premium').length;
      const revenue = (basicCount * 49.90) + (premiumCount * 99.90);
      
      const monthName = monthEnd.toLocaleDateString('pt-BR', { month: 'short' });
      
      monthsData.push({
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        total: revenue,
        basic: basicCount * 49.90,
        premium: premiumCount * 99.90
      });
    }
    
    res.json(monthsData);
  } catch (error) {
    console.error('Error in admin revenue analytics route:', error);
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

// Rota duplicada removida - implementação correta está na linha 429

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

// Rota para limpar imagens inexistentes
router.post('/cleanup-missing-images', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🧹 Iniciando limpeza de imagens inexistentes...');

    const { storage } = await import('./storage');
    
    // Buscar todos os usuários com imagem de perfil
    const usersWithImages = await storage.getUsersWithProfileImages();
    console.log(`📋 Encontrados ${usersWithImages.length} usuários com imagem de perfil`);

    const publicPath = path.join(process.cwd(), 'public');
    let cleanedCount = 0;
    let errorCount = 0;
    const cleanedUsers = [];

    for (const user of usersWithImages) {
      const imagePath = user.profileImage;
      
      if (!imagePath || !imagePath.startsWith('/uploads/')) {
        continue;
      }

      // Construir caminho completo do arquivo
      const fullPath = path.join(publicPath, imagePath);
      
      // Verificar se o arquivo existe
      if (!fs.existsSync(fullPath)) {
        console.log(`❌ Imagem não encontrada: ${imagePath} (${user.email})`);
        
        try {
          // Remover referência do banco de dados
          await storage.updateUser(user.id, { profileImage: null });
          
          cleanedUsers.push({
            id: user.id,
            email: user.email,
            imagePath: imagePath
          });
          
          console.log(`✅ Referência removida do banco de dados para ${user.email}`);
          cleanedCount++;
        } catch (error) {
          console.error(`❌ Erro ao limpar referência para usuário ${user.id}:`, error);
          errorCount++;
        }
      }
    }

    const result = {
      success: true,
      message: 'Limpeza de imagens concluída',
      summary: {
        totalChecked: usersWithImages.length,
        cleaned: cleanedCount,
        errors: errorCount
      },
      cleanedUsers
    };

    console.log('📊 RESUMO DA LIMPEZA:', result.summary);
    res.json(result);

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    res.status(500).json({
      success: false,
      message: 'Erro durante a limpeza de imagens',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export { router as adminRoutes };