// @ts-nocheck
import express from 'express';
import { Response, NextFunction, RequestHandler } from 'express';
import { Router } from 'express';
import { storage } from './storage';
import { hashPassword } from './auth';
import { db } from './db';
import { chatRouter } from './chat-routes';
import { users, subscriptionPlans, auditLogs, dependents, claims, notifications, appointments, doctorPayments, doctors, partners, Dependent, User, InsertUser } from '../shared/schema';
import { requireAuth, requireAdmin } from './middleware/auth';
import { AppError } from './utils/app-error';
import { eq, desc, and, isNotNull, ne } from 'drizzle-orm';
import dailyRouter from './routes/telemedicine-daily';

// Middleware para verificar se o usuário é admin
export const isAdmin: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  if (authReq.user.role !== 'admin') {
    return res.status(403).json({ message: "Acesso negado. Somente administradores podem acessar este recurso." });
  }

  next();
};

// Criar router administrativo
export const adminRouter = Router();

// Aplicar middleware de autenticação primeiro (para popular req.user)
adminRouter.use(requireAuth);

// Aplicar proteção admin global
adminRouter.use(isAdmin);

// Helper para garantir que as funções async com AuthenticatedRequest sejam aceitas pelo Express
const asHandler = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>) => fn as unknown as RequestHandler;

// Rota para obter estatísticas da plataforma
adminRouter.get('/stats', asHandler(async (req, res) => {
  try {
    console.log('🔍 Admin /stats - Buscando estatísticas...');
    
    // Usar SQL direto para evitar problemas com Drizzle
    const { pool } = await import('./db');
    
    // Estatísticas de usuários
    const userStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'patient' THEN 1 END) as total_patients,
        COUNT(CASE WHEN role = 'doctor' THEN 1 END) as total_doctors,
        COUNT(CASE WHEN role = 'partner' THEN 1 END) as total_partners,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
        COUNT(CASE WHEN subscription_plan IS NOT NULL AND subscription_plan != 'free' THEN 1 END) as subscribed_users,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users
      FROM users
    `);
    
    const userStats = userStatsResult.rows[0];
    
    // Tentar buscar estatísticas de appointments (se a tabela existir)
    let appointmentsCount = 0;
    try {
      const appointmentsResult = await pool.query('SELECT COUNT(*) as count FROM appointments');
      appointmentsCount = parseInt(appointmentsResult.rows[0].count);
    } catch (error) {
      console.log('Tabela appointments não encontrada, continuando sem ela...');
    }
    
    // Tentar buscar estatísticas de claims (se a tabela existir)
    let pendingClaimsCount = 0;
    try {
      const claimsResult = await pool.query("SELECT COUNT(*) as count FROM claims WHERE status = 'pending'");
      pendingClaimsCount = parseInt(claimsResult.rows[0].count);
    } catch (error) {
      console.log('Tabela claims não encontrada, continuando sem ela...');
    }

    const statsData = {
      totalUsers: parseInt(userStats.total_users),
      totalPatients: parseInt(userStats.total_patients),
      totalDoctors: parseInt(userStats.total_doctors),
      totalPartners: parseInt(userStats.total_partners),
      totalAdmins: parseInt(userStats.total_admins),
      subscribedUsers: parseInt(userStats.subscribed_users),
      verifiedUsers: parseInt(userStats.verified_users),
      totalAppointments: appointmentsCount,
      pendingClaims: pendingClaimsCount
    };
    
    console.log('✅ Admin /stats - Estatísticas obtidas:', statsData);
    res.json(statsData);
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas" });
  }
}));

// Rota para obter estatísticas de vendedores
adminRouter.get('/sellers', asHandler(async (req, res) => {
  try {
    // Obter todos os nomes de vendedores únicos
    const sellers = await db.selectDistinct({ sellerName: users.sellerName })
      .from(users)
      .where(and(isNotNull(users.sellerName), ne(users.sellerName, '')));

    const sellerDetails = [];

    for (const { sellerName } of sellers) {
      if (!sellerName) continue;

      // Obter todos os usuários daquele vendedor
      const usersOfSeller = await db.query.users.findMany({
        where: eq(users.sellerName, sellerName),
        columns: {
          subscriptionPlan: true,
        },
      });

      const totalPlans = usersOfSeller.length;

      // Contar planos por tipo
      const planMap: Record<string, number> = {};
      for (const { subscriptionPlan } of usersOfSeller) {
        if (subscriptionPlan) {
          planMap[subscriptionPlan] = (planMap[subscriptionPlan] || 0) + 1;
        }
      }
      const plansByType = Object.entries(planMap).map(([plan, count]) => ({ plan, count }));

      sellerDetails.push({ sellerName, totalPlans, plansByType });
    }

    res.json(sellerDetails);
  } catch (error) {
    console.error("Erro ao buscar estatísticas de vendedores:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas de vendedores" });
  }
}));

// Obter lista de usuários recentes
adminRouter.get('/recent-users', async (req: AuthenticatedRequest, res) => {
  try {
    const recentUsers = await db.query.users.findMany({
      limit: 10,
      orderBy: desc(users.createdAt)
    });

    res.json(recentUsers);
  } catch (error) {
    console.error("Erro ao obter usuários recentes:", error);
    res.status(500).json({ message: "Erro ao buscar usuários recentes" });
  }
});

// Obter lista de consultas recentes
adminRouter.get('/recent-appointments', async (req: AuthenticatedRequest, res) => {
  try {
    const recentAppointments = await db.query.appointments.findMany({
      limit: 10,
      orderBy: desc(appointments.createdAt)
    });

    res.json(recentAppointments);
  } catch (error) {
    console.error("Erro ao obter consultas recentes:", error);
    res.status(500).json({ message: "Erro ao buscar consultas recentes" });
  }
});

// Obter lista de sinistros pendentes
adminRouter.get('/pending-claims', async (req: AuthenticatedRequest, res) => {
  try {
    const pendingClaims = await db
      .select()
      .from(claims)
      .where(eq(claims.status, 'pending'))
      .orderBy(desc(claims.createdAt));

    res.json(pendingClaims);
  } catch (error) {
    console.error("Erro ao obter sinistros pendentes:", error);
    res.status(500).json({ message: "Erro ao buscar sinistros pendentes" });
  }
});

// Rota para obter todos os sinistros
adminRouter.get('/claims', async (req: AuthenticatedRequest, res) => {
  try {
    const allClaims = await db
      .select()
      .from(claims)
      .orderBy(desc(claims.createdAt));

    res.json(allClaims);
  } catch (error) {
    console.error("Erro ao obter sinistros:", error);
    res.status(500).json({ message: "Erro ao buscar sinistros" });
  }
});

// Rota para obter um sinistro específico
adminRouter.get('/claims/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const claimId = parseInt(req.params.id);
    if (isNaN(claimId)) {
      throw new AppError('ID do sinistro inválido', 400);
    }

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, claimId));
    
    if (!claim) {
      throw new AppError('Sinistro não encontrado', 404);
    }
    
    res.json(claim);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      console.error("Erro ao obter sinistro:", error);
      res.status(500).json({ message: "Erro ao buscar sinistro" });
    }
  }
});

// Rota para atualizar o status de um sinistro
adminRouter.patch('/claims/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError('Não autorizado', 401);
    }

    const claimId = parseInt(req.params.id);
    if (isNaN(claimId)) {
      throw new AppError('ID do sinistro inválido', 400);
    }

    const { status, reviewNotes } = req.body;
    
    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, claimId));
    
    if (!claim) {
      throw new AppError('Sinistro não encontrado', 404);
    }
    
    const claimData = { 
      status, 
      reviewNotes,
      reviewedAt: status !== 'pending' ? new Date() : undefined,
      reviewedBy: status !== 'pending' ? req.user.id : undefined
    };
    
    const [updatedClaim] = await db
      .update(claims)
      .set(claimData)
      .where(eq(claims.id, claimId))
      .returning();
    
    // Criar notificação para o usuário
    if (status !== claim.status) {
      const statusMessage: Record<string, string> = {
        'approved': 'aprovado',
        'rejected': 'rejeitado',
        'pending': 'pendente',
        'processing': 'em processamento',
        'paid': 'pago'
      };
      
      await db.insert(notifications).values({
        userId: claim.userId,
        title: `Status do sinistro atualizado`,
        message: `O status do seu sinistro #${claim.id} foi atualizado para ${statusMessage[status] || status}.`,
        type: 'claim',
        relatedId: claim.id
      });
    }
    
    res.json(updatedClaim);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
    } else {
      console.error("Erro ao atualizar sinistro:", error);
      res.status(500).json({ message: "Erro ao atualizar sinistro" });
    }
  }
});

// Listar todos os usuários
adminRouter.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🔍 Admin /users - Usuário autenticado:', !!req.user);
    console.log('🔍 Admin /users - Role do usuário:', req.user?.role);
    
    // Usar SQL direto para evitar problemas com Drizzle
    const { pool } = await import('./db');
    const result = await pool.query(`
      SELECT id, email, username, full_name, role, cpf, phone, 
             subscription_plan, subscription_status, email_verified, 
             created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
    `);
    
    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      cpf: row.cpf,
      phone: row.phone,
      subscriptionPlan: row.subscription_plan,
      subscriptionStatus: row.subscription_status,
      emailVerified: row.email_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    console.log(`✅ Admin /users - Retornando ${users.length} usuários`);
    res.json(users);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ message: "Erro ao buscar usuários" });
  }
});

// Criar novo usuário
adminRouter.post('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const { email, username, password, fullName, role, phone, address } = req.body;
    
    // Verificar se usuário já existe
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    
    if (existingUser) {
      return res.status(400).json({ message: "Um usuário com este email já existe" });
    }
    
    const [existingUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    
    if (existingUsername) {
      return res.status(400).json({ message: "Nome de usuário já está em uso" });
    }
    
    // Criar hash da senha
    const hashedPassword = await hashPassword(password);
    
    // Criar usuário
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        username,
        password: hashedPassword,
        fullName,
        role,
        phone: phone || null,
        address: address || null,
        emailVerified: true,
      })
      .returning();
    
    // Criar registro associado com base no papel (médico ou parceiro)
    if (role === 'doctor') {
      await db.insert(doctors).values({
        userId: newUser.id,
        specialization: "",
        licenseNumber: "",
        biography: "",
        experienceYears: 0,
        availableForEmergency: false,
        consultationFee: 0,
        status: "inactive"
      });
    } else if (role === 'partner') {
      await db.insert(partners).values({
        userId: newUser.id,
        businessName: fullName,
        businessType: "Serviços",
        status: "pending"
      });
    }
    
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ message: "Erro ao criar usuário" });
  }
});

// Atualizar usuário existente
adminRouter.patch('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { email, username, password, fullName, role, phone, address } = req.body;
    
    // Verificar se usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Se alterou o email, verificar se já está em uso
    if (email !== user.email) {
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Este email já está em uso por outro usuário" });
      }
    }
    
    // Se alterou o username, verificar se já está em uso
    if (username !== user.username) {
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername && existingUsername.id !== userId) {
        return res.status(400).json({ message: "Este nome de usuário já está em uso" });
      }
    }
    
    // Preparar dados para atualização
    const updateData: Partial<InsertUser> = {
      email,
      username,
      fullName,
      role,
      phone: phone || null,
      address: address || null,
      emailVerified: req.body.emailVerified,
    };
    
    // Se tiver senha nova, fazer hash
    if (password) {
      updateData.password = await hashPassword(password);
    }
    
    console.log("Atualizando usuário com dados:", JSON.stringify(updateData, null, 2));
    
    // Atualizar usuário
    const updatedUser = await storage.updateUser(userId, updateData);
    
    // Se alterou o papel, criar os registros associados se necessário
    if (role !== user.role) {
      if (role === 'doctor') {
        const existingDoctor = await storage.getDoctorByUserId(userId);
        if (!existingDoctor) {
          await storage.createDoctor({
            userId: userId,
            specialization: "",
            licenseNumber: "",
            biography: "",
            experienceYears: 0,
            availableForEmergency: false,
            consultationFee: 0,
            status: "inactive"
          });
        }
      } else if (role === 'partner') {
        const existingPartner = await storage.getPartnerByUserId(userId);
        if (!existingPartner) {
          await storage.createPartner({
            userId: userId,
            businessName: fullName,
            businessType: "Serviços",
            status: "pending"
          });
        }
      }
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
});

// Excluir usuário
adminRouter.delete('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    console.log(`🔥 Admin DELETE /users/${userId} - Iniciando exclusão`);
    
    // Verificar se usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`❌ Usuário ${userId} não encontrado`);
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    console.log(`✅ Usuário encontrado: ${user.fullName} (${user.email})`);
    
    // Não permitir excluir o próprio usuário
    if (req.user && user.id === req.user!.id) {
      console.log(`❌ Tentativa de auto-exclusão impedida`);
      return res.status(400).json({ message: "Você não pode excluir seu próprio usuário" });
    }
    
    console.log(`🗑️ Chamando storage.deleteUser(${userId})`);
    // Excluir usuário
    await storage.deleteUser(userId);
    
    console.log(`✅ Usuário ${userId} excluído com sucesso`);
    res.json({ message: "Usuário excluído com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao excluir usuário:", error);
    console.error("❌ Stack trace:", error.stack);
    res.status(500).json({ message: "Erro ao excluir usuário" });
  }
});

// Listar todos os médicos com detalhes
adminRouter.get('/doctors', async (req: AuthenticatedRequest, res) => {
  try {
    const doctors = await storage.getAllDoctors();
    res.json(doctors);
  } catch (error) {
    console.error("Erro ao listar médicos:", error);
    res.status(500).json({ message: "Erro ao listar médicos" });
  }
});

// Obter médico pelo ID de usuário
adminRouter.get('/users/:userId/doctor', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor) {
      return res.status(404).json({ message: "Perfil médico não encontrado para este usuário" });
    }
    
    res.json(doctor);
  } catch (error) {
    console.error("Erro ao buscar médico por ID de usuário:", error);
    res.status(500).json({ message: "Erro ao buscar perfil médico" });
  }
});

// Listar todos os parceiros com detalhes
adminRouter.get('/partners', async (req: AuthenticatedRequest, res) => {
  try {
    const partners = await storage.getAllPartners();
    res.json(partners);
  } catch (error) {
    console.error("Erro ao listar parceiros:", error);
    res.status(500).json({ message: "Erro ao listar parceiros" });
  }
});

// Criar novo parceiro como administrador
adminRouter.post('/partners', async (req: AuthenticatedRequest, res) => {
  try {
    console.log("POST /api/admin/partners - Request body:", req.body);
    
    // Validate input
    if (!req.body.businessName || !req.body.businessType || !req.body.email) {
      return res.status(400).json({ 
        message: "Dados incompletos. Nome da empresa, tipo de negócio e email são obrigatórios." 
      });
    }
    
    // Check if email is already in use
    const existingUser = await storage.getUserByEmail(req.body.email);
    if (existingUser) {
      return res.status(400).json({ message: "Este email já está em uso." });
    }
    
    // Create a partner user first
    const partnerUser = await storage.createUser({
      username: req.body.email.split('@')[0],
      email: req.body.email,
      password: await hashPassword(Math.random().toString(36).substring(2, 10)), // Senha temporária aleatória
      fullName: req.body.businessName,
      role: "partner",
      emailVerified: true // Auto-verify when created by admin
    });
    
    // Then create the partner profile
    const partner = await storage.createPartner({
      userId: partnerUser.id,
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      phone: req.body.phone || null,
      address: req.body.address || null,
      status: req.body.status || "pending"
    });
    
    // Create notification for the new partner
    await storage.createNotification({
      userId: partnerUser.id,
      title: "Bem-vindo ao CN Vidas",
      message: "Sua conta de parceiro foi criada por um administrador. Você pode atualizar seus dados e criar seus serviços.",
      type: "system"
    });
    
    console.log("POST /api/admin/partners - Partner created:", partner);
    
    // Return the created partner data
    res.status(201).json(partner);
  } catch (error) {
    console.error("POST /api/admin/partners - Error:", error);
    res.status(500).json({ message: "Erro ao criar parceiro" });
  }
});

// Rota para obter detalhes do usuário (para página de dependentes)
adminRouter.get('/user-for-dependents/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Verificar se o usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Retornar apenas as informações necessárias
    const userDetails = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      isFamilyPlan: user.subscriptionPlan?.includes('family') || false
    };
    
    res.json(userDetails);
  } catch (error) {
    console.error("Erro ao buscar detalhes do usuário:", error);
    res.status(500).json({ message: "Erro ao buscar detalhes do usuário" });
  }
});

// Rotas para gerenciamento de dependentes por administradores
adminRouter.get('/user-dependents/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Verificar se o usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Buscar dependentes do usuário
    const dependents = await storage.getDependentsByUserId(userId);
    res.json(dependents);
  } catch (error) {
    console.error("Erro ao buscar dependentes do usuário:", error);
    res.status(500).json({ message: "Erro ao buscar dependentes" });
  }
});

// Adicionar dependente como administrador (sem restrições de plano)
adminRouter.post('/user-dependents/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { name, cpf, birthDate, relationship } = req.body;
    
    // Verificar se o usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Verificar se o CPF já está em uso como dependente
    const existingDependent = await storage.getDependentByCpf(cpf);
    if (existingDependent) {
      return res.status(400).json({ message: "CPF já cadastrado como dependente" });
    }
    
    // Criar dependente (sem verificar limite ou tipo de plano)
    const dependent = await storage.createDependent({
      userId,
      name,
      cpf,
      birthDate,
      relationship
    });
    
    res.status(201).json(dependent);
  } catch (error) {
    console.error("Erro ao adicionar dependente:", error);
    res.status(500).json({ message: "Erro ao adicionar dependente" });
  }
});

// Atualizar dependente
adminRouter.put('/user-dependents/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const dependentId = parseInt(req.params.id);
    const { name, birthDate, relationship } = req.body;
    
    // Verificar se o dependente existe
    const dependent = await storage.getDependent(dependentId);
    if (!dependent) {
      return res.status(404).json({ message: "Dependente não encontrado" });
    }
    
    // Atualizar dependente (sem o CPF, que é imutável)
    const updatedDependent = await storage.updateDependent(dependentId, {
      name,
      birthDate,
      relationship
    });
    
    res.json(updatedDependent);
  } catch (error) {
    console.error("Erro ao atualizar dependente:", error);
    res.status(500).json({ message: "Erro ao atualizar dependente" });
  }
});

// Remover dependente
adminRouter.delete('/user-dependents/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const dependentId = parseInt(req.params.id);
    
    // Verificar se o dependente existe
    const dependent = await storage.getDependent(dependentId);
    if (!dependent) {
      return res.status(404).json({ message: "Dependente não encontrado" });
    }
    
    // Remover dependente
    await storage.deleteDependent(dependentId);
    
    res.json({ message: "Dependente removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover dependente:", error);
    res.status(500).json({ message: "Erro ao remover dependente" });
  }
});

// Rota para obter os logs de autenticação QR
adminRouter.get('/qr-auth-logs', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const logs = await storage.getQrAuthLogs(limit, offset);
    res.json(logs);
  } catch (error) {
    console.error("Erro ao buscar logs de autenticação QR:", error);
    res.status(500).json({ message: "Erro ao buscar logs de autenticação QR" });
  }
});

// Listar todos os serviços de parceiros
adminRouter.get('/services', async (req: AuthenticatedRequest, res) => {
  try {
    const services = await storage.getAllPartnerServices();
    
    // Enriquecer com informações dos parceiros
    const enrichedServices = await Promise.all(services.map(async (service) => {
      const partner = await storage.getPartner(service.partnerId);
      return {
        ...service,
        partnerName: partner ? partner.businessName : 'Parceiro não encontrado'
      };
    }));
    
    res.json(enrichedServices);
  } catch (error) {
    console.error("Erro ao listar serviços:", error);
    res.status(500).json({ message: "Erro ao listar serviços" });
  }
});

// Atualizar serviço
adminRouter.patch('/services/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await storage.getPartnerService(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    const updatedService = await storage.updatePartnerService(serviceId, req.body);
    res.json(updatedService);
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    res.status(500).json({ message: "Erro ao atualizar serviço" });
  }
});

// Excluir serviço
adminRouter.delete('/services/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await storage.getPartnerService(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    await storage.deletePartnerService(serviceId);
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({ message: "Erro ao excluir serviço" });
  }
});

// Destacar/remover destaque de serviço
adminRouter.patch('/services/:id/feature', async (req: AuthenticatedRequest, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const { isFeatured } = req.body;
    
    const service = await storage.getPartnerService(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    const updatedService = await storage.updatePartnerService(serviceId, { 
      isFeatured: Boolean(isFeatured) 
    });
    
    res.json(updatedService);
  } catch (error) {
    console.error("Erro ao atualizar destaque do serviço:", error);
    res.status(500).json({ message: "Erro ao atualizar destaque do serviço" });
  }
});

// Criar novo serviço para um parceiro
adminRouter.post('/partners/:partnerId/services', async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    
    // Verificar se o parceiro existe
    const partner = await storage.getPartner(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    
    // Criar o serviço
    const serviceData = {
      ...req.body,
      partnerId,
      active: req.body.active === true || req.body.active === 'true',
      isFeatured: req.body.isFeatured === true || req.body.isFeatured === 'true',
      price: parseFloat(req.body.price) || 0
    };
    
    const service = await storage.createPartnerService(serviceData);
    
    res.status(201).json(service);
  } catch (error) {
    console.error("Erro ao criar serviço:", error);
    res.status(500).json({ message: "Erro ao criar serviço" });
  }
});

// Listar todas as consultas
adminRouter.get('/appointments', async (req: AuthenticatedRequest, res) => {
  try {
    const appointments = await storage.getAllAppointments();
    res.json(appointments);
  } catch (error) {
    console.error("Erro ao listar consultas:", error);
    res.status(500).json({ message: "Erro ao listar consultas" });
  }
});

// Atualizar detalhes do médico (informações profissionais)
adminRouter.patch('/doctors/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const doctor = await storage.getDoctor(doctorId);
    
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    
    // Atualizar detalhes do médico
    const updatedDoctor = await storage.updateDoctor(doctorId, req.body);
    
    // Se o valor da consulta foi atualizado, notificar o médico
    if (req.body.consultationFee !== undefined && req.body.consultationFee !== doctor.consultationFee) {
      await storage.createNotification({
        userId: doctor.userId,
        type: 'system',
        title: 'Valor da consulta atualizado',
        message: `O valor da sua consulta foi atualizado para R$ ${req.body.consultationFee.toFixed(2)}.`,
      });
    }
    
    res.json(updatedDoctor);
  } catch (error) {
    console.error("Erro ao atualizar médico:", error);
    res.status(500).json({ message: "Erro ao atualizar informações do médico" });
  }
});

// Atualizar detalhes do parceiro
adminRouter.patch('/partners/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = parseInt(req.params.id);
    const partner = await storage.getPartner(partnerId);
    
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    
    // Atualizar detalhes do parceiro
    const updatedPartner = await storage.updatePartner(partnerId, req.body);
    
    // Se o status do parceiro foi atualizado, notificar o parceiro
    if (req.body.status !== undefined && req.body.status !== partner.status) {
      await storage.createNotification({
        userId: partner.userId,
        type: 'system',
        title: 'Status da parceria atualizado',
        message: `O status da sua parceria foi atualizado para: ${req.body.status}`,
      });
    }
    
    res.json(updatedPartner);
  } catch (error) {
    console.error("Erro ao atualizar parceiro:", error);
    res.status(500).json({ message: "Erro ao atualizar informações do parceiro" });
  }
});

// Gerenciar planos de assinatura dos usuários
adminRouter.patch('/users/:id/subscription', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { subscriptionPlan, subscriptionStatus } = req.body;
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Atualizar plano de assinatura
    const updatedUser = await storage.updateUser(userId, {
      subscriptionPlan,
      subscriptionStatus: subscriptionStatus || 'active'
    });
    
    // Notificar usuário sobre mudança de plano
    await storage.createNotification({
      userId,
      type: 'subscription',
      title: 'Plano de assinatura atualizado',
      message: `Seu plano de assinatura foi atualizado para: ${subscriptionPlan || 'Free'}`,
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar plano de assinatura:", error);
    res.status(500).json({ message: "Erro ao atualizar plano de assinatura" });
  }
});

// Conceder gratuidade para pacientes premium/básico
adminRouter.post('/users/:id/premium-access', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { plan, reason } = req.body;
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Validar o plano solicitado
    const planosValidos = ['free', 'basic', 'premium', 'ultra', 'basic_family', 'premium_family', 'ultra_family'];
    if (!planosValidos.includes(plan)) {
      return res.status(400).json({ message: "Plano inválido. Use um dos planos disponíveis: " + planosValidos.join(', ') });
    }
    
    // Atualizar o plano do usuário para premium gratuitamente
    const updatedUser = await storage.updateUser(userId, {
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      // Adicionar metadados sobre a concessão gratuita, se necessário
    });
    
    // Criar um registro do motivo da gratuidade (opcional)
    console.log(`Acesso ${plan} concedido gratuitamente para o usuário ${userId}. Motivo: ${reason}`);
    
    // Notificar o usuário
    await storage.createNotification({
      userId,
      type: 'subscription',
      title: `Acesso ${plan === 'premium' ? 'Premium' : 'Básico'} concedido`,
      message: `Você recebeu acesso gratuito ao plano ${plan === 'premium' ? 'Premium' : 'Básico'} em nossa plataforma.`,
    });
    
    res.json({ 
      success: true, 
      message: `Acesso ${plan} concedido com sucesso`,
      user: updatedUser
    });
  } catch (error) {
    console.error("Erro ao conceder acesso premium:", error);
    res.status(500).json({ message: "Erro ao conceder acesso premium" });
  }
});

// Ativar/desativar consultas de emergência para médicos
adminRouter.patch('/doctors/:id/emergency', async (req: AuthenticatedRequest, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const { availableForEmergency } = req.body;
    
    const doctor = await storage.getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    
    // Atualizar disponibilidade de emergência
    const updatedDoctor = await storage.toggleDoctorAvailability(doctorId, availableForEmergency);
    
    // Notificar o médico
    await storage.createNotification({
      userId: doctor.userId,
      type: 'system',
      title: 'Disponibilidade para emergências atualizada',
      message: availableForEmergency 
        ? 'Você foi marcado como disponível para consultas de emergência.' 
        : 'Você não está mais disponível para consultas de emergência.',
    });
    
    res.json(updatedDoctor);
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade para emergências:", error);
    res.status(500).json({ message: "Erro ao atualizar disponibilidade para emergências" });
  }
});

// Excluir qualquer tipo de perfil (sem restrições)
adminRouter.delete('/profiles/:role/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { role, id } = req.params;
    const profileId = parseInt(id);
    
    if (!['doctor', 'partner'].includes(role)) {
      return res.status(400).json({ message: "Tipo de perfil inválido. Use 'doctor' ou 'partner'" });
    }
    
    let userId;
    
    // Excluir o perfil específico primeiro
    if (role === 'doctor') {
      const doctor = await storage.getDoctor(profileId);
      if (!doctor) {
        return res.status(404).json({ message: "Perfil de médico não encontrado" });
      }
      userId = doctor.userId;
      
      // Aqui seria implementada a lógica para excluir o perfil do médico
      // Como não temos um método específico na interface IStorage para isso,
      // assumimos que deleteUser irá excluir em cascata
    } else if (role === 'partner') {
      const partner = await storage.getPartner(profileId);
      if (!partner) {
        return res.status(404).json({ message: "Perfil de parceiro não encontrado" });
      }
      userId = partner.userId;
      
      // Excluir todos os serviços associados ao parceiro
      const services = await storage.getPartnerServicesByPartnerId(profileId);
      for (const service of services) {
        await storage.deletePartnerService(service.id);
      }
      
      // Aqui seria implementada a lógica para excluir o perfil do parceiro
      // Como não temos um método específico na interface IStorage para isso,
      // assumimos que deleteUser irá excluir em cascata
    }
    
    // Excluir o usuário associado (isso deve excluir em cascata o perfil também)
    if (userId) {
      await storage.deleteUser(userId);
    }
    
    res.json({ message: `Perfil de ${role} excluído com sucesso` });
  } catch (error) {
    console.error(`Erro ao excluir perfil:`, error);
    res.status(500).json({ message: `Erro ao excluir perfil` });
  }
});

// Força atualização da disponibilidade do médico
adminRouter.post('/doctors/:id/availability', async (req: AuthenticatedRequest, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const { slots } = req.body;
    
    const doctor = await storage.getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    
    // Verificar formato dos slots
    if (!Array.isArray(slots)) {
      return res.status(400).json({ message: "Formato inválido. 'slots' deve ser um array" });
    }
    
    // Preparar slots para inserção
    const availabilitySlots = slots.map(slot => ({
      doctorId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'available'
    }));
    
    // Salvar os slots de disponibilidade
    const savedSlots = await storage.saveDoctorAvailabilitySlots(availabilitySlots);
    
    // Notificar o médico
    await storage.createNotification({
      userId: doctor.userId,
      type: 'system',
      title: 'Agenda atualizada',
      message: 'Sua agenda de disponibilidade foi atualizada pelo administrador.',
    });
    
    res.json(savedSlots);
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade:", error);
    res.status(500).json({ message: "Erro ao atualizar disponibilidade" });
  }
});

// Rota para atualizar plano de assinatura de um usuário
adminRouter.patch('/users/:userId/subscription', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { subscriptionPlan, subscriptionStatus } = req.body;
    
    // Verificar se usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Verificar se o plano é válido
    if (!['free', 'basic', 'premium'].includes(subscriptionPlan)) {
      return res.status(400).json({ message: "Plano de assinatura inválido" });
    }
    
    // Atualizar plano de assinatura
    const updatedUser = await storage.updateUser(userId, {
      subscriptionPlan,
      subscriptionStatus: subscriptionStatus || 'active'
    });
    
    // Criar notificação para o usuário
    await storage.createNotification({
      userId: userId,
      title: 'Plano de assinatura atualizado',
      message: `Seu plano de assinatura foi atualizado para ${subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)}.`,
      type: 'subscription',
      relatedId: userId
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar plano de assinatura:", error);
    res.status(500).json({ message: "Erro ao atualizar plano de assinatura" });
  }
});

// Rotas para gerenciamento de planos de assinatura
adminRouter.get('/subscription-plans', async (req: AuthenticatedRequest, res) => {
  try {
    const plansData = await db.select().from(subscriptionPlans);
    console.log('Retornando planos de assinatura:', plansData);
    res.json(plansData);
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    res.status(500).json({ error: 'Erro ao buscar planos de assinatura' });
  }
});

adminRouter.get('/subscription-stats', async (req: AuthenticatedRequest, res) => {
  try {
    const premiumCount = (await db.query.users.findMany({ where: eq(users.subscriptionPlan, 'premium') })).length;
    const basicCount = (await db.query.users.findMany({ where: eq(users.subscriptionPlan, 'basic') })).length;
    res.json({ premiumCount, basicCount });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de assinatura' });
  }
});

adminRouter.patch('/subscription-plans/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const planId = parseInt(id);
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { price } = req.body;
    
    const [updatedPlan] = await db
      .update(subscriptionPlans)
      .set({ 
        price: price,
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();
    
    if (!updatedPlan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    
    res.json(updatedPlan);
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    res.status(500).json({ error: 'Erro ao atualizar plano de assinatura' });
  }
});

adminRouter.get('/dashboard/cards', async (req: AuthenticatedRequest, res) => {
  try {
    const userCount = await storage.getUserCount();
    res.json({ userCount });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de usuários' });
  }
});

adminRouter.get('/dashboard/charts', async (req: AuthenticatedRequest, res) => {
  try {
    const monthlySignups = await storage.getMonthlySignups();
    res.json({ monthlySignups });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de inscrições' });
  }
});

adminRouter.post('/plans', async (req: AuthenticatedRequest, res) => {
  try {
    const newPlan = await storage.createPlan(req.body);
    res.status(201).json(newPlan);
  } catch (error) {
    console.error('Erro ao criar plano:', error);
    res.status(500).json({ error: 'Erro ao criar plano' });
  }
});

adminRouter.put('/plans/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const updatedPlan = await storage.updatePlan(planId, req.body);
    res.json(updatedPlan);
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    res.status(500).json({ error: 'Erro ao atualizar plano' });
  }
});

adminRouter.delete('/plans/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    await storage.deletePlan(planId);
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir plano:', error);
    res.status(500).json({ error: 'Erro ao excluir plano' });
  }
});

adminRouter.get('/audit-logs', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, limit, offset } = req.query;
    const logs = await storage.getAuditLogs(userId, limit, offset);
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs de auditoria:', error);
    res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
  }
});

adminRouter.post('/notifications/send', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, title, message, type } = req.body;
    await storage.sendNotification(userId, title, message, type);
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

adminRouter.patch('/doctors/:id/approve', async (req: AuthenticatedRequest, res) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    await storage.approveDoctor(doctorId);
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao aprovar médico:', error);
    res.status(500).json({ error: 'Erro ao aprovar médico' });
  }
});

adminRouter.patch('/doctors/:id/reject', async (req: AuthenticatedRequest, res) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    await storage.rejectDoctor(doctorId);
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao rejeitar médico:', error);
    res.status(500).json({ error: 'Erro ao rejeitar médico' });
  }
});

adminRouter.patch('/partners/:id/approve', async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = parseInt(req.params.id, 10);
    await storage.approvePartner(partnerId);
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao aprovar parceiro:', error);
    res.status(500).json({ error: 'Erro ao aprovar parceiro' });
  }
});

adminRouter.patch('/partners/:id/reject', async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = parseInt(req.params.id, 10);
    await storage.rejectPartner(partnerId);
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao rejeitar parceiro:', error);
    res.status(500).json({ error: 'Erro ao rejeitar parceiro' });
  }
});

adminRouter.post('/emergency/assign-doctor', async (req: AuthenticatedRequest, res) => {
  try {
    const { appointmentId, doctorId } = req.body;
    await storage.assignDoctorToEmergencyAppointment(appointmentId, doctorId);
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao atribuir médico à consulta de emergência:', error);
    res.status(500).json({ error: 'Erro ao atribuir médico à consulta de emergência' });
  }
});

adminRouter.get('/telemedicine/appointments', async (req: AuthenticatedRequest, res) => {
  try {
    const appointments = await storage.getAllTelemedicineAppointments();
    res.json(appointments);
  } catch (error) {
    console.error('Erro ao buscar consultas de telemedicina:', error);
    res.status(500).json({ error: 'Erro ao buscar consultas de telemedicina' });
  }
});

adminRouter.get('/users/search', async (req: AuthenticatedRequest, res) => {
  try {
    const { query } = req.query;
    const users = await storage.searchUsers(query);
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

adminRouter.get('/system/health', async (req: AuthenticatedRequest, res) => {
  try {
    // Verificar conexão com o banco
    await db.query.users.findMany();
    res.status(200).send();
  } catch (error) {
    console.error('Erro ao verificar saúde do sistema:', error);
    res.status(500).json({ error: 'Erro ao verificar saúde do sistema' });
  }
});

adminRouter.get('/users/:id/details', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar detalhes do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do usuário' });
  }
});

adminRouter.get('/doctors/pending', async (req: AuthenticatedRequest, res) => {
  try {
    const pendingDoctors = await storage.getPendingDoctors();
    res.json(pendingDoctors);
  } catch (error) {
    console.error('Erro ao buscar médicos pendentes:', error);
    res.status(500).json({ error: 'Erro ao buscar médicos pendentes' });
  }
});

adminRouter.get('/partners/pending', async (req: AuthenticatedRequest, res) => {
  try {
    const pendingPartners = await storage.getPendingPartners();
    res.json(pendingPartners);
  } catch (error) {
    console.error('Erro ao buscar parceiros pendentes:', error);
    res.status(500).json({ error: 'Erro ao buscar parceiros pendentes' });
  }
});