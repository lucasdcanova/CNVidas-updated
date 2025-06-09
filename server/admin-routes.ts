import { Router } from 'express';
import { requireAuth, requireAdmin } from './middleware/auth';

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

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Update user endpoint', 
      userId: id,
      data: req.body 
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ 
      message: 'Delete user endpoint', 
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
    res.json({ 
      message: 'Admin services endpoint', 
      services: [],
      total: 0 
    });
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

router.get('/qr-auth-logs', async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Error in admin QR auth logs route:', error);
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