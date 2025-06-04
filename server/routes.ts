import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, requireDoctor, requirePatient, requirePartner } from './middleware/auth';
import { AuthenticatedRequest } from './types/authenticated-request';
import { storage } from './storage';
import { setupSubscriptionPlans } from './migrations/plans-setup';
import { verifyEmailConnection } from './services/email';
import { setupAuth } from './auth';
import { ensureJsonResponse } from './middleware/json-response';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth-routes';
import diagnosticRouter from './routes/diagnostic-routes';
import { setupVite, serveStatic, log } from './vite';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { createToken } from './utils/daily';
import { randomBytes } from 'crypto';
import { sendEmail } from './services/email';
import { AppError } from './utils/app-error';
import { chatRouter } from "./chat-routes";
import fs from 'fs';
import multer from 'multer';
import { Router } from 'express';
import { adminRouter } from './admin-routes';
import { checkEmergencyConsultationLimit, checkSubscriptionFeature } from './middleware/subscription-check';
import { requirePlan } from './middleware/plan-check';
import { dailyRouter } from './routes/telemedicine-daily';
import { telemedicineRouter as dailyRouterV2 } from './routes/telemedicine-daily-v2';
import emergencyRouter from './routes/emergency-consultation';
import appointmentJoinRouter from './routes/appointment-join';
import emergencyPatientRouter from './routes/emergency-patient';
import { doctorRouter } from './doctor-routes';
import { doctorFinanceRouter } from './doctor-finance-routes';
import { db } from './db';
import { users, subscriptionPlans, auditLogs } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { normalizeNull } from './utils/normalize';
import { telemedicineRouter } from './routes/telemedicine-routes';
import diagnosticsRouter from './telemedicine-diagnostics';
import { User } from '../shared/schema';
import { insertAppointmentSchema, insertClaimSchema } from './schemas';

const router = Router();

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const randomName = randomBytes(16).toString("hex");
      const extension = path.extname(file.originalname);
      cb(null, `${randomName}${extension}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow certain file types
    const allowedTypes = [
      "image/jpeg", 
      "image/png", 
      "application/pdf", 
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // docx
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido"));
    }
  }
});

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Middleware de autenticação
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Aplicar middleware de erro globalmente
router.use(errorHandler);

// Rota temporária para testar o envio de email
router.get('/api/test-email', async (req, res) => {
  const to = req.query.email as string || 'lucas.canova@icloud.com';
  
  try {
    await sendEmail(
      to,
      'Teste de Email - CN Vidas',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8e8e8; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e88e5;">CN Vidas</h1>
        </div>
        <div style="margin-bottom: 30px;">
          <p>Olá,</p>
          <p>Este é um email de teste para verificar se o serviço de email da CN Vidas está funcionando corretamente.</p>
          <p>Se você recebeu este email, significa que a configuração de email está funcionando!</p>
          <p>Data e hora do teste: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; font-size: 12px; color: #757575;">
          <p>Atenciosamente,<br>Equipe CN Vidas</p>
        </div>
      </div>
      `
    );
    res.status(200).json({ success: true, message: 'Email de teste enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao enviar email de teste', 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

// Setup authentication routes
// setupAuth(router); // Removendo esta linha pois já é chamado em index.ts

// Registrar rotas administrativas
router.use('/api/admin', adminRouter);

// Registrar rotas do chatbot
router.use('/api/chat', chatRouter);

// Corrigir o middleware de autenticação
const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Corrigir o middleware de admin
const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Corrigir o middleware de partner
const isPartner = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'partner') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Corrigir o middleware de doctor
const isDoctor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'doctor') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Corrigir o middleware de patient
const isPatient = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'patient') {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

// Função auxiliar para verificar roles
const requireRole = (roles: User['role'][]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user || !roles.includes(req.user.role)) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
  };
};

// User routes
router.get("/api/users", requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    let usersList: User[] = [];
    const { role } = req.query;

    if (role) {
      usersList = await storage.getUsersByRole(role as User['role']);
    } else {
      usersList = await storage.getAllUsers();
    }

    res.json(usersList);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

router.get("/api/users/profile", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  const user = normalizeNull(req.user, [
    'phone', 'address', 'zipCode', 'street', 'number', 'complement', 
    'neighborhood', 'city', 'state', 'birthDate', 'stripeCustomerId', 
    'stripeSubscriptionId', 'subscriptionStatus', 'subscriptionPlan', 
    'subscriptionChangedAt', 'profileImage', 'emergencyConsultationsLeft', 
    'lastSubscriptionCancellation'
  ]);
  
  res.json(user);
});

router.put("/api/users/seller", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
    const { sellerName } = req.body;
    const normalizedSellerName = sellerName?.trim();

    if (!normalizedSellerName) {
      return res.status(400).json({ message: "Nome do vendedor é obrigatório" });
    }

    await storage.updateUser(req.user.id, {
      sellerName: normalizedSellerName
    });

    res.json({ message: "Vendedor atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar vendedor:", error);
    res.status(500).json({ message: "Erro ao atualizar vendedor" });
  }
});

router.post("/api/users/profile-image", isAuthenticated, async (req: Request, res: Response) => {
  if (!req.user || !req.user.id) return res.status(401).json({ message: "Usuário não autenticado corretamente" });
  try {
    const { profileImage } = req.body;
    if (!profileImage) return res.status(400).json({ message: "Imagem não fornecida" });
    const updatedUser = await storage.updateUser(req.user.id, { profileImage });
    req.login(updatedUser, (err) => {
      if (err) console.error("Erro ao atualizar sessão após atualizar imagem:", err);
      res.json({ message: "Imagem de perfil atualizada com sucesso", profileImage: updatedUser.profileImage });
    });
  } catch (error) {
    console.error("Erro ao atualizar imagem de perfil:", error);
    res.status(500).json({ message: "Erro ao atualizar imagem de perfil" });
  }
});

// Endpoint específico para atualizar apenas os dados de endereço
router.put("/api/users/address", isAuthenticated, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    
    // Obter apenas os campos de endereço
    const { 
      zipcode, 
      street, 
      number, 
      complement, 
      neighborhood, 
      city, 
      state 
    } = req.body;
    
    console.log("Atualizando endereço do usuário:", req.user.id);
    console.log("Dados de endereço recebidos:", {
      zipcode, street, number, complement, neighborhood, city, state
    });
    
    // Atualizar também o campo address legado para compatibilidade
    const fullAddress = street && number ? 
      `${street}, ${number}${complement ? `, ${complement}` : ""} - ${neighborhood || ""} - ${city || ""}/${state || ""} - CEP: ${zipcode || ""}` : 
      null;
    
    // Atualizar apenas os campos de endereço
    const addressData = {
      zipcode: zipcode || "", 
      street: street || "", 
      number: number || "", 
      complement: complement || "", 
      neighborhood: neighborhood || "", 
      city: city || "", 
      state: state || "",
      address: fullAddress, // Incluir também o endereço formatado completo
      updatedAt: new Date()
    };
    
    try {
      // Forçar um INSERT/UPDATE direto no banco de dados para cada campo de endereço
      // Esta abordagem garante que os campos sejam atualizados mesmo se estiverem vazios
      const query = `
        UPDATE users 
        SET 
          zipcode = $1, 
          street = $2, 
          number = $3, 
          complement = $4, 
          neighborhood = $5,
          city = $6, 
          state = $7,
          address = $8,
          updated_at = $9
        WHERE id = $10
        RETURNING *
      `;
      
      const result = await pool.query(query, [
        addressData.zipcode,
        addressData.street,
        addressData.number,
        addressData.complement,
        addressData.neighborhood,
        addressData.city,
        addressData.state,
        addressData.address,
        addressData.updatedAt,
        req.user.id
      ]);
      
      if (result.rowCount === 0) {
        throw new Error("Falha ao atualizar o endereço no banco de dados");
      }
      
      const updatedUserData = result.rows[0];
      
      // Converter para o formato esperado pela aplicação
      const updatedUser = {
        ...req.user,
        zipcode: updatedUserData.zipcode,
        street: updatedUserData.street,
        number: updatedUserData.number,
        complement: updatedUserData.complement,
        neighborhood: updatedUserData.neighborhood,
        city: updatedUserData.city,
        state: updatedUserData.state,
        address: updatedUserData.address,
        updatedAt: new Date(updatedUserData.updated_at)
      };
      
      console.log("Endereço atualizado com sucesso! Novos dados:", {
        zipcode: updatedUser.zipcode,
        street: updatedUser.street,
        number: updatedUser.number,
        city: updatedUser.city,
        state: updatedUser.state
      });
      
      // Verifica se o usuário está autenticado via sessão ou via token
      if (req.isAuthenticated()) {
        // Se estiver autenticado via sessão, atualize a sessão
        req.login(updatedUser, (err) => {
          if (err) {
            console.error("Erro ao atualizar sessão após alterar endereço:", err);
            // Mesmo com erro na atualização da sessão, retornamos sucesso e os dados
          }
          res.json(updatedUser);
        });
      } else {
        // Se estiver autenticado via token, apenas retorne os dados atualizados
        console.log("Usuário autenticado via token, pulando atualização de sessão");
        res.json(updatedUser);
      }
    } catch (dbError) {
      console.error("Erro ao atualizar endereço no banco de dados:", dbError);
      res.status(500).json({ message: "Erro ao atualizar endereço" });
    }
  } catch (error) {
    console.error("Erro na requisição de atualização de endereço:", error);
    res.status(500).json({ message: "Erro ao processar requisição de endereço" });
  }
});

router.put("/api/users/profile", isAuthenticated, async (req, res) => {
  try {
    // Validate the input - exclude sensitive fields from being updated here
    if (!req.user || !req.user.id) {
      console.error("Tentativa de atualização sem usuário autenticado");
      return res.status(401).json({ message: "Usuário não autenticado corretamente" });
    }
    
    const { password, role, ...updateData } = req.body;
    
    console.log(`Recebendo atualização de perfil para usuário ${req.user.id}:`, JSON.stringify(updateData));
    
    // Log detalhado de todos os campos de endereço
    console.log("Campos de endereço recebidos:", JSON.stringify({
      zipcode: updateData.zipcode,
      street: updateData.street,
      number: updateData.number,
      complement: updateData.complement,
      neighborhood: updateData.neighborhood,
      city: updateData.city,
      state: updateData.state
    }));
    
    // Correção: Garantir que os campos de endereço não serão perdidos na atualização
    // Modificamos a forma como os campos de endereço são tratados
    const addressFields = {
      zipcode: updateData.zipcode,
      street: updateData.street,
      number: updateData.number,
      complement: updateData.complement,
      neighborhood: updateData.neighborhood,
      city: updateData.city,
      state: updateData.state
    };
    
    // Processar strings vazias nos campos normais
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === "") {
        updateData[key] = null;
      }
    });
    
    // Adicione timestamp de atualização para garantir que o banco reconheça esta alteração como nova
    updateData.updatedAt = new Date();
    
    try {
      // Verifique se o usuário existe antes de atualizar
      const existingUser = await storage.getUser(req.user.id);
      if (!existingUser) {
        console.error(`Usuário com ID ${req.user.id} não encontrado para atualização`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Log para verificar os dados antes da atualização
      console.log("Detalhes do usuário existente:", JSON.stringify({
        id: existingUser.id,
        username: existingUser.username,
        fullName: existingUser.fullName
      }));
      
      // Atualização direta no banco para garantir que os campos de endereço sejam salvos
      // Primeiro atualizamos o usuário com os dados gerais
      const updatedUser = await storage.updateUser(req.user.id, {
        ...updateData,
        ...addressFields // Incluímos explicitamente os campos de endereço
      });
      
      console.log("Perfil atualizado com sucesso:", updatedUser.id);
      
      // Log para verificar o resultado após atualização
      console.log("Detalhes do usuário após atualização:", JSON.stringify({
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName
      }));
      
      // Atualize também a sessão do usuário para refletir as mudanças
      req.login(updatedUser, (err) => {
        if (err) {
          console.error("Erro ao atualizar sessão após modificar perfil:", err);
          // Continue mesmo com erro na sessão
        }
        
        // Responder com usuário atualizado
        res.json(updatedUser);
      });
    } catch (dbError) {
      console.error("Erro no banco de dados ao atualizar perfil:", dbError);
      res.status(500).json({ message: "Erro no banco de dados ao atualizar perfil" });
    }
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
});

// QR Code Authentication
router.post("/api/users/generate-qr", isAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Não autorizado');
    }
    const { token, expiresAt } = await storage.generateQrToken(req.user.id);
    res.json({ token, expiresAt });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

router.post("/api/users/verify-qr", isAuthenticated, async (req, res) => {
  try {
    const { token } = req.body;
    const scannerUser = req.user;
    
    if (!token) {
      return res.status(400).send({ 
        valid: false, 
        message: "Token não fornecido" 
      });
    }
    
    if (!scannerUser) {
      return res.status(401).send({
        valid: false,
        message: "Usuário não autenticado"
      });
    }
    
    // Verificar se o usuário que está escaneando é um admin ou parceiro
    if (scannerUser.role !== "admin" && scannerUser.role !== "partner") {
      return res.status(403).send({
        valid: false,
        message: "Apenas administradores e parceiros podem verificar códigos QR"
      });
    }
    
    const tokenUser = await storage.getUserByQrToken(token);
    let success = false;
    
    if (!tokenUser) {
      // Registrar a tentativa mal sucedida
      if (scannerUser) {
        await storage.logQrAuthentication({
          token,
          scannerUserId: scannerUser.id,
          tokenUserId: 0, // Usuário inexistente/inválido
          success: false,
          ipAddress: req.ip || "",
          userAgent: req.headers["user-agent"] || ""
        });
      }
      
      return res.status(401).send({ 
        valid: false,
        message: "Token inválido, expirado ou já utilizado" 
      });
    }
    
    // Verificar se o usuário do token é um paciente ou médico
    if (tokenUser.role !== "patient" && tokenUser.role !== "doctor") {
      return res.status(403).send({
        valid: false,
        message: "Apenas pacientes e médicos podem gerar códigos QR válidos"
      });
    }
    
    success = true;
    
    // Registrar a autenticação bem-sucedida
    await storage.logQrAuthentication({
      token,
      scannerUserId: scannerUser.id,
      tokenUserId: tokenUser.id,
      success: true,
      ipAddress: req.ip || "",
      userAgent: req.headers["user-agent"] || ""
    });
    
    res.json({
      valid: true,
      user: {
        id: tokenUser.id,
        name: tokenUser.fullName,
        email: tokenUser.email,
        role: tokenUser.role,
        status: tokenUser.emailVerified ? "Verificado" : "Não verificado",
        subscriptionStatus: tokenUser.subscriptionStatus || "Inativo"
      },
      message: "Token válido"
    });
  } catch (error) {
    console.error("Erro ao verificar token QR:", error);
    res.status(500).send({ 
      valid: false,
      message: "Erro ao verificar token QR" 
    });
  }
});

// Doctor routes
// Rota para listar todos os médicos
router.get("/api/doctors", async (req, res) => {
  try {
    const doctors = await storage.getAllDoctors();
    
    // Os nomes e fotos de perfil já estão incluídos na query SQL de getAllDoctors
    console.log("Todos os médicos:", JSON.stringify(doctors.map(d => ({id: d.id}))));
    
    res.json(doctors);
  } catch (error) {
    console.error("Erro ao buscar médicos:", error);
    res.status(500).json({ message: "Erro ao buscar médicos" });
  }
});

// Rota para listar médicos disponíveis para emergência
router.get("/api/doctors/available", async (req, res) => {
  try {
    const availableDoctors = await storage.getAvailableDoctors();
    
    // Os nomes e fotos de perfil já estão incluídos na query SQL de getAvailableDoctors
    console.log("Médicos disponíveis:", JSON.stringify(availableDoctors.map(d => ({id: d.id}))));
    
    res.json(availableDoctors);
  } catch (error) {
    console.error("Erro ao buscar médicos disponíveis:", error);
    res.status(500).json({ message: "Erro ao buscar médicos disponíveis" });
  }
});

// Rota para atualizar informações do perfil médico
router.put("/api/doctors/:id", isAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }
    const doctorId = parseInt(req.params.id);
    const doctor = await storage.getDoctor(doctorId);
    
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    
    // Verificar se o usuário é dono deste perfil de médico ou é admin
    const isOwner = req.user.role === "doctor" && doctor.userId === req.user.id;
    const isAdmin = req.user.role === "admin";
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Você não tem permissão para editar este perfil" });
    }
    
    console.log("Dados recebidos para atualização do médico:", req.body);
    
    // Atualizar detalhes do médico, incluindo a imagem de perfil
    const updatedDoctor = await storage.updateDoctor(doctorId, req.body);
    
    // Adicionar logs detalhados para depuração
    console.log("Perfil médico atualizado com sucesso:", {
      doctorId,
      userId: doctor.userId,
      updatedBy: req.user.id,
      role: req.user.role,
      hasProfileImage: !!req.body.profileImage
    });
    
    res.json(updatedDoctor);
  } catch (error) {
    console.error("Erro ao atualizar perfil médico:", error);
    res.status(500).json({ message: "Erro ao atualizar perfil médico" });
  }
});

// Endpoint para buscar perfil do médico removido daqui
// Já existe uma versão mais abaixo (linha ~699)

router.post("/api/doctors", async (req, res) => {
  try {
    // Permitir criar perfil de médico sem autenticação (para fins de teste e desenvolvimento)
    const userId = req.body.userId;
    
    if (!userId) {
      return res.status(400).json({ message: "O ID do usuário é obrigatório" });
    }
    
    const existingDoctor = await storage.getDoctorByUserId(userId);
    
    if (existingDoctor) {
      return res.status(400).json({ message: "Este usuário já possui um perfil médico" });
    }
    
    const doctor = await storage.createDoctor({
      ...req.body,
      userId: userId
    });
    
    res.status(201).json(doctor);
  } catch (error) {
    console.error("Erro ao criar perfil médico:", error);
    res.status(500).json({ message: "Erro ao criar perfil médico" });
  }
});

// Rota para buscar as consultas de um médico
// Comentando aqui - será substituída pela versão mais completa abaixo

// Endpoint para toggle de disponibilidade removido daqui
// Foi consolidado com a versão mais segura abaixo (linha ~765)

// Partner routes
router.get("/api/partners", async (req, res) => {
  try {
    const partners = await storage.getAllPartners();
    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar parceiros" });
  }
});

router.get("/api/partners/:id", async (req, res) => {
  try {
    const partner = await storage.getPartner(parseInt(req.params.id));
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    res.json(partner);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar parceiro" });
  }
});

// Rota para buscar parceiro pelo ID do usuário
router.get("/api/partners/user/:userId", isAuthenticated, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const partner = await storage.getPartnerByUserId(userId);
    
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado para este usuário" });
    }
    
    res.json(partner);
  } catch (error) {
    console.error("Erro ao buscar parceiro por ID de usuário:", error);
    res.status(500).json({ message: "Erro ao buscar parceiro" });
  }
});

router.post("/api/partners", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== "partner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Apenas parceiros ou administradores podem registrar um parceiro" });
    }

    const partner = await storage.createPartner({
      ...req.body,
      userId: req.user.id
    });
    res.status(201).json(partner);
  } catch (error) {
    res.status(500).json({ message: "Erro ao criar parceiro" });
  }
});

router.put("/api/partners/:id", isPartner, async (req, res) => {
  try {
    const partner = await storage.getPartner(parseInt(req.params.id));
    
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    
    // Only allow the owner or an admin to update
    if (partner.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Você não tem permissão para editar este parceiro" });
    }
    
    // Garantir que os campos de endereço sejam incluídos explicitamente
    const partnerData = {
      ...req.body,
      // Garantir que estes campos sejam definidos mesmo como string vazia
      zipcode: req.body.zipcode || "",
      street: req.body.street || "",
      number: req.body.number || "",
      complement: req.body.complement || "",
      neighborhood: req.body.neighborhood || "",
      city: req.body.city || "",
      state: req.body.state || ""
    };
    
    console.log("Atualizando parceiro com dados completos de endereço:", {
      id: partner.id,
      street: partnerData.street,
      number: partnerData.number,
      complement: partnerData.complement,
      neighborhood: partnerData.neighborhood
    });
    
    const updatedPartner = await storage.updatePartner(partner.id, partnerData);
    res.json(updatedPartner);
  } catch (error) {
    console.error("Erro ao atualizar parceiro:", error);
    res.status(500).json({ message: "Erro ao atualizar parceiro" });
  }
});

// Partner services routes
router.get("/api/services", 
  // Adicionar verificação de autenticação
  isAuthenticated,
  // Aplicar middleware de verificação de plano apenas para pacientes (não para parceiros ou admins)
  async (req, res, next) => {
    // Se for parceiro, admin ou médico, não requer verificação de plano
    if (req.user.role === 'partner' || req.user.role === 'admin' || req.user.role === 'doctor') {
      return next();
    }
    
    // Apenas pacientes precisam ter plano pago
    return requirePlan({
      allowedPlans: ['basic', 'premium', 'ultra', 'basic_family', 'premium_family', 'ultra_family'],
      redirectPath: "/subscription",
      message: "Acesso a serviços médicos requer um plano pago. Faça upgrade do seu plano para continuar."
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const partnerId = req.query.partnerId ? parseInt(req.query.partnerId as string) : undefined;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const searchAll = req.query.searchAll === 'true'; // Parâmetro para buscar todos os serviços
      
      // Log para debugging
      console.log("GET /api/services - Query parameters:", { partnerId, userId, searchAll });
    
    // Se temos um userId, primeiro encontramos o parceiro associado
    if (userId) {
      console.log(`GET /api/services - Buscando serviços pelo userId: ${userId}`);
      
      const partner = await storage.getPartnerByUserId(userId);
      if (!partner) {
        console.log(`GET /api/services - Nenhum parceiro encontrado para o userId: ${userId}`);
        return res.json([]);
      }
      
      console.log(`GET /api/services - Parceiro encontrado: ${partner.id} para userId: ${userId}`);
      const services = await storage.getPartnerServicesByPartnerId(partner.id);
      console.log(`GET /api/services - ${services.length} serviços encontrados para parceiro ID: ${partner.id}`);
      return res.json(services);
    }
    
    // Se temos um partnerId, usamos ele diretamente
    if (partnerId) {
      console.log(`GET /api/services - Buscando serviços pelo partnerId: ${partnerId}`);
      const services = await storage.getPartnerServicesByPartnerId(partnerId);
      console.log(`GET /api/services - ${services.length} serviços encontrados para partnerId: ${partnerId}`);
      return res.json(services);
    }
    
    // Obter cidade do usuário para filtragem por proximidade
    const userCity = req.user?.city;
    console.log("GET /api/services - Cidade do usuário:", userCity);
    
    // Get featured services if no partnerId or userId is provided
    console.log("GET /api/services - Buscando serviços em destaque");
    const featuredServices = await storage.getFeaturedServices();
    console.log(`GET /api/services - ${featuredServices.length} serviços em destaque encontrados`);
    
    let services;
    
    // Se não encontrou serviços em destaque, busca todos os serviços disponíveis
    if (featuredServices.length === 0) {
      console.log("GET /api/services - Nenhum serviço em destaque encontrado, buscando todos os serviços");
      services = await storage.getAllPartnerServices();
      console.log(`GET /api/services - ${services.length} serviços encontrados no total`);
    } else {
      services = featuredServices;
    }
    
    // Se o usuário tem cidade e não está fazendo busca manual, filtrar por proximidade
    if (userCity && !searchAll) {
      console.log(`GET /api/services - Filtrando serviços por proximidade de ${userCity} (50km)`);
      const nearbyServices = filterServicesByProximity(services, userCity, 50);
      console.log(`GET /api/services - ${nearbyServices.length} serviços encontrados próximos a ${userCity}`);
      
      // Adicionar informação de distância aos serviços próximos
      const servicesWithDistance = addDistanceToServices(nearbyServices, userCity);
      res.json(servicesWithDistance);
    } else {
      // Se não tem cidade ou está fazendo busca manual, retorna todos os serviços
      const servicesWithDistance = userCity ? addDistanceToServices(services, userCity) : services;
      res.json(servicesWithDistance);
    }
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({ message: "Erro ao buscar serviços" });
  }
});

router.get("/api/services/:id", async (req, res) => {
  try {
    const service = await storage.getPartnerService(parseInt(req.params.id));
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar serviço" });
  }
});

router.post("/api/services", isPartner, async (req, res) => {
  try {
    console.log("POST /api/services - Request body:", JSON.stringify(req.body));
    
    // Make sure the partner exists and belongs to the user first
    const partner = await storage.getPartnerByUserId(req.user.id);
    console.log("POST /api/services - Partner search for userId:", req.user.id);
    
    if (!partner) {
      console.log("POST /api/services - Partner not found for user:", req.user.id);
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    
    console.log("POST /api/services - Partner found:", partner.id);
    
    // Create a schema without partnerId requirement for frontend validation
    const serviceDataSchema = z.object({
      name: z.string().min(3),
      description: z.string().min(10),
      category: z.string().min(1),
      regularPrice: z.number().positive(),
      discountPrice: z.number().positive(),
      discountPercentage: z.number().min(0).max(100).optional().default(0),
      duration: z.number().min(5).optional().default(30),
      isFeatured: z.boolean().optional().default(false),
      isActive: z.boolean().optional().default(true),
    });
    
    // Validate the input with our custom schema
    const validatedData = serviceDataSchema.parse(req.body);
    console.log("POST /api/services - Validated data:", JSON.stringify(validatedData));
    
    // Create the service with partnerId
    const serviceData = {
      ...validatedData,
      partnerId: partner.id
    };
    console.log("POST /api/services - Creating service with data:", JSON.stringify(serviceData));
    
    const service = await storage.createPartnerService(serviceData);
    
    console.log("POST /api/services - Service created:", service.id);
    res.status(201).json(service);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("POST /api/services - Validation error:", JSON.stringify(error.errors));
      return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
    }
    console.error("POST /api/services - Error creating service:", error);
    res.status(500).json({ message: "Erro ao criar serviço" });
  }
});

router.put("/api/services/:id", isPartner, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await storage.getPartnerService(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    // Make sure the partner exists and belongs to the user
    const partner = await storage.getPartnerByUserId(req.user.id);
    if (!partner || service.partnerId !== partner.id) {
      return res.status(403).json({ message: "Você não tem permissão para editar este serviço" });
    }
    
    // Update the service
    const updatedService = await storage.updatePartnerService(serviceId, req.body);
    res.json(updatedService);
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar serviço" });
  }
});

router.delete("/api/services/:id", isPartner, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await storage.getPartnerService(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    // Make sure the partner exists and belongs to the user
    const partner = await storage.getPartnerByUserId(req.user.id);
    if (!partner || service.partnerId !== partner.id) {
      return res.status(403).json({ message: "Você não tem permissão para excluir este serviço" });
    }
    
    // Delete the service
    await storage.deletePartnerService(serviceId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir serviço" });
  }
});

// Partner services specific API
router.get("/api/partner-services/by-partner", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== "partner") {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    // Get partner by user ID
    const partner = await storage.getPartnerByUserId(req.user.id);
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    
    // Get services for this partner
    const services = await storage.getPartnerServicesByPartnerId(partner.id);
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar serviços" });
  }
});

router.post("/api/partner-services", isPartner, async (req, res) => {
  try {
    console.log("Create service request body:", req.body);
    
    // Make sure the partner exists and belongs to the user
    const partner = await storage.getPartnerByUserId(req.user.id);
    if (!partner) {
      return res.status(404).json({ message: "Parceiro não encontrado" });
    }
    
    // Preparar dados para criação - garantir que isFeatured seja false para parceiros
    const serviceData = {
      ...req.body,
      partnerId: partner.id,
      isFeatured: false // Apenas administradores podem marcar serviços como destaque
    };
    
    // Validate the input
    const validatedData = insertPartnerServiceSchema.parse(serviceData);
    
    // Create the service
    const service = await storage.createPartnerService({
      ...validatedData,
      partnerId: partner.id
    });
    
    res.status(201).json(service);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
    }
    res.status(500).json({ message: "Erro ao criar serviço" });
  }
});

router.patch("/api/partner-services/:id", isPartner, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await storage.getPartnerService(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    // Make sure the partner exists and belongs to the user
    const partner = await storage.getPartnerByUserId(req.user.id);
    if (!partner || service.partnerId !== partner.id) {
      return res.status(403).json({ message: "Você não tem permissão para editar este serviço" });
    }
    
    // Se o parceiro tentar definir o serviço como destacado, remova essa tentativa
    // Apenas administradores podem destacar serviços
    const updateData = { ...req.body };
    if ('isFeatured' in updateData && updateData.isFeatured === true) {
      // Remover a tentativa de marcar como destacado
      updateData.isFeatured = false;
    }
    
    // Validate the update data
    // Update the service
    const updatedService = await storage.updatePartnerService(serviceId, updateData);
    res.json(updatedService);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
    }
    res.status(500).json({ message: "Erro ao atualizar serviço" });
  }
});

router.delete("/api/services/:id", isPartner, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await storage.getPartnerService(serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    
    // Make sure the partner exists and belongs to the user
    const partner = await storage.getPartnerByUserId(req.user.id);
    if (!partner || service.partnerId !== partner.id) {
      return res.status(403).json({ message: "Você não tem permissão para excluir este serviço" });
    }
    
    // Delete the service
    await storage.deletePartnerService(serviceId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir serviço" });
  }
});

// Appointment routes

// Rota para buscar uma consulta específica por ID
router.get("/api/appointments/:id([0-9]+)", isAuthenticated, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Não autorizado" });
    const appointmentId = parseInt(req.params.id, 10);
    if (isNaN(appointmentId)) return res.status(400).json({ message: "ID inválido" });
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Consulta não encontrada" });
    }
    if (appointment.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "doctor") {
      return res.status(403).json({ message: "Você não tem permissão para ver esta consulta" });
    }
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar detalhes da consulta" });
  }
});

// Endpoint para médicos obterem a última consulta de emergência
router.get("/api/appointments/latest-emergency", isAuthenticated, async (req, res) => {
  try {
    // Verificar se o usuário é um médico ou um administrador
    if (req.user.role !== "doctor" && req.user.role !== "admin") {
      return res.status(403).json({ 
        message: "Apenas médicos podem acessar informações de emergência" 
      });
    }
    
    // Buscar a consulta de emergência mais recente
    const lastEmergencyConsultation = await storage.getLatestEmergencyConsultation();
    
    if (!lastEmergencyConsultation) {
      return res.status(404).json({ 
        message: "Não há consultas de emergência ativas no momento" 
      });
    }
    
    res.json(lastEmergencyConsultation);
  } catch (error) {
    console.error("Erro ao buscar última consulta de emergência:", error);
    res.status(500).json({ 
      message: "Não foi possível obter a consulta de emergência" 
    });
  }
});

router.get("/api/appointments", isAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    let appointments: any[] = [];
    
    if (req.user.role === "partner") {
      const partner = await storage.getPartnerByUserId(req.user.id);
      if (partner) {
        appointments = await storage.getPartnerAppointments(partner.id);
      }
    } else {
      appointments = await storage.getUserAppointments(req.user.id);
    }
    
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar consultas" });
  }
});

// Cancelar consulta (médicos podem cancelar suas consultas)
router.post("/api/appointments/:id/cancel", isAuthenticated, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: "Motivo do cancelamento é obrigatório" });
    }
    
    // Verificar se o médico tem permissão para cancelar esta consulta
    let hasPermission = false;
    
    if (req.user.role === "doctor") {
      const doctor = await storage.getDoctorByUserId(req.user.id);
      if (doctor) {
        const appointment = await storage.getAppointment(appointmentId);
        if (appointment && appointment.doctorId === doctor.id) {
          hasPermission = true;
        }
      }
    } else if (req.user.role === "admin") {
      hasPermission = true; // Admins podem cancelar qualquer consulta
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para cancelar esta consulta" });
    }
    
    // Buscar informações do paciente para notificação
    const appointmentWithPatient = await storage.getAppointmentWithPatientInfo(appointmentId);
    
    // Cancelar a consulta
    const canceledAppointment = await storage.cancelAppointment(appointmentId, reason);
    
    // Enviar notificação para o paciente
    if (appointmentWithPatient.userId) {
      await storage.createNotification({
        userId: appointmentWithPatient.userId,
        title: "Consulta cancelada",
        message: `Sua consulta com ${req.user.fullName} foi cancelada. Motivo: ${reason}`,
        type: "appointment",
        relatedId: appointmentId
      });
      
      console.log(`Notificação enviada para o paciente ${appointmentWithPatient.patientName} (ID: ${appointmentWithPatient.userId}) sobre o cancelamento da consulta ${appointmentId}`);
    }
    
    res.json({ 
      success: true, 
      message: "Consulta cancelada com sucesso",
      appointment: canceledAppointment
    });
  } catch (error) {
    console.error("Erro ao cancelar consulta:", error);
    res.status(500).json({ message: "Erro ao cancelar consulta" });
  }
});

// Excluir consulta (apenas médicos e admin)
router.delete("/api/appointments/:id", isAuthenticated, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    // Verificar se o médico tem permissão para excluir esta consulta
    let hasPermission = false;
    
    if (req.user.role === "doctor") {
      const doctor = await storage.getDoctorByUserId(req.user.id);
      if (doctor) {
        const appointment = await storage.getAppointment(appointmentId);
        if (appointment && appointment.doctorId === doctor.id) {
          hasPermission = true;
        }
      }
    } else if (req.user.role === "admin") {
      hasPermission = true; // Admins podem excluir qualquer consulta
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: "Você não tem permissão para excluir esta consulta" });
    }
    
    // Buscar informações do paciente para notificação
    const appointmentWithPatient = await storage.getAppointmentWithPatientInfo(appointmentId);
    
    // Excluir a consulta
    await storage.deleteAppointment(appointmentId);
    
    // Enviar notificação para o paciente
    if (appointmentWithPatient.userId) {
      await storage.createNotification({
        userId: appointmentWithPatient.userId,
        title: "Consulta removida",
        message: `Sua consulta com ${req.user.fullName} foi removida do sistema.`,
        type: "appointment",
        relatedId: appointmentId
      });
      
      console.log(`Notificação enviada para o paciente ${appointmentWithPatient.patientName} (ID: ${appointmentWithPatient.userId}) sobre a exclusão da consulta ${appointmentId}`);
    }
    
    res.json({ 
      success: true, 
      message: "Consulta excluída com sucesso"
    });
  } catch (error) {
    console.error("Erro ao excluir consulta:", error);
    res.status(500).json({ message: "Erro ao excluir consulta" });
  }
});

router.get("/api/appointments/upcoming", isAuthenticated, async (req, res) => {
  try {
    const appointments = await storage.getUpcomingAppointments(req.user.id);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar consultas agendadas" });
  }
});



// Join doctor emergency room endpoint
router.post('/api/emergency/join-doctor-room', isAuthenticated, async (req, res) => {
  try {
    const { doctorId, patientId } = req.body;
    
    if (!doctorId || !patientId) {
      return res.status(400).json({ message: 'doctorId and patientId are required' });
    }

    // Verificar se o médico existe e está disponível
    const doctor = await storage.getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    // Nome da sala será baseado no ID do médico
    const roomName = `doctor-${doctorId}-emergency`;
    
    // Criar ou obter a sala usando a API da Daily.co
    const dailyResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    let roomUrl;
    
    if (dailyResponse.status === 404) {
      // Sala não existe, criar uma nova
      const createResponse = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'public',
          properties: {
            max_participants: 10,
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
            exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 ano
          },
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Falha ao criar sala na Daily.co');
      }

      const roomData = await createResponse.json();
      roomUrl = roomData.url;
    } else if (dailyResponse.ok) {
      // Sala já existe
      const roomData = await dailyResponse.json();
      roomUrl = roomData.url;
    } else {
      throw new Error('Erro ao verificar sala na Daily.co');
    }

    console.log(`🚨 Paciente ${patientId} entrando na sala de emergência do médico ${doctorId}: ${roomUrl}`);

    res.json({
      success: true,
      roomUrl,
      roomName,
      doctorId,
      patientId
    });

  } catch (error: any) {
    console.error('Erro ao entrar na sala de emergência do médico:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
});

router.post("/api/appointments", isAuthenticated, checkEmergencyConsultationLimit, async (req, res) => {
  try {
    // Log detalhado da requisição
    console.log("POST /api/appointments - Body:", req.body);
    
    // Certificar-se de que a data está em formato correto
    let appointmentData = {...req.body};
    
    // Substituir userId incluído do cliente pelo userId da sessão
    appointmentData.userId = req.user.id;
    
    // Adicionar tratamento de erro para data não fornecida
    if (!appointmentData.date) {
      return res.status(400).json({ 
        message: "Data da consulta é obrigatória"
      });
    }
    
    // Validar data como objeto Date - converter string para objeto Date
    try {
      appointmentData.date = new Date(appointmentData.date);
    } catch (error) {
      return res.status(400).json({ 
        message: "Formato de data inválido"
      });
    }
    
    console.log("POST /api/appointments - Dados formatados:", appointmentData);
    
    // Validate the input com os dados formatados
    const validatedData = insertAppointmentSchema.parse(appointmentData);
    
    // Create the appointment - não precisa adicionar userId aqui pois já foi adicionado acima
    const appointment = await storage.createAppointment(validatedData);
    
    // Create a notification for the user
    await storage.createNotification({
      userId: req.user.id,
      title: "Nova consulta agendada",
      message: `Sua consulta foi agendada para ${new Date(appointment.date).toLocaleString()}`,
      type: "appointment",
      link: `/appointments/${appointment.id}`
    });
    
    // Se for consulta de emergência e o usuário tiver plano basic, decrementar contador
    if (req.body.isEmergency && req.user.subscriptionPlan === 'basic' && req.emergencyConsultationToDecrement) {
      const currentConsultations = req.user.emergencyConsultationsLeft || 0;
      if (currentConsultations > 0) {
        // Atualizar contador de consultas de emergência
        await db.update(users)
          .set({ emergencyConsultationsLeft: currentConsultations - 1 })
          .where(eq(users.id, req.user.id));
        
        console.log(`Consulta de emergência registrada. Contador decrementado para o usuário ${req.user.id}`);
      }
    }
    
    res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
    }
    console.error("Erro ao criar consulta:", error);
    res.status(500).json({ message: "Erro ao criar consulta" });
  }
});

router.put("/api/appointments/:id", isAuthenticated, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const appointment = await storage.getAppointment(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ message: "Consulta não encontrada" });
    }
    
    // Check if user is authorized to update this appointment
    if (appointment.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Você não tem permissão para editar esta consulta" });
    }
    
    // Update the appointment
    const updatedAppointment = await storage.updateAppointment(appointmentId, req.body);
    res.json(updatedAppointment);
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar consulta" });
  }
});

// Claims routes
router.get("/api/claims", isAuthenticated, 
  requirePlan({
    allowedPlans: ['basic', 'premium', 'ultra', 'basic_family', 'premium_family', 'ultra_family'],
    redirectPath: "/subscription",
    message: "Acesso a sinistros requer um plano pago. Faça upgrade do seu plano para continuar."
  }), 
  async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Não autorizado" });
      let claims = [];
      if (req.user.role === "admin") {
        claims = await storage.getAllClaims();
      } else {
        claims = await storage.getUserClaims(req.user.id);
      }
      res.json(claims);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar sinistros" });
    }
  }
);

router.get("/api/claims/pending", isAdmin, async (req, res) => {
  try {
    const claims = await storage.getPendingClaims();
    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar sinistros pendentes" });
  }
});

router.post("/api/claims", isAuthenticated, checkSubscriptionFeature("file_claim"), upload.array("documents", 5), async (req, res) => {
  try {
    // Get files
    const files = req.files as Express.Multer.File[];
    const documentPaths = files.map(file => file.path);
    
    // Validate the claim data
    const validatedData = insertClaimSchema.parse(req.body);
    
    // Create the claim
    const claim = await storage.createClaim(
      {
        ...validatedData,
        userId: req.user.id
      },
      documentPaths
    );
    
    // Create a notification for the user
    await storage.createNotification({
      userId: req.user.id,
      title: "Novo sinistro enviado",
      message: "Seu sinistro foi enviado e está em análise.",
      type: "claim",
      link: `/claims/${claim.id}`
    });
    
    // Notify admin users
    const admins = await storage.getUsersByRole("admin");
    
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        title: "Novo sinistro recebido",
        message: `Um novo sinistro foi enviado pelo usuário ${req.user.fullName}`,
        type: "claim",
        link: `/admin/claims/${claim.id}`
      });
    }
    
    res.status(201).json(claim);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
    }
    res.status(500).json({ message: "Erro ao criar sinistro" });
  }
});

router.put("/api/claims/:id", isAdmin, async (req, res) => {
  try {
    const claimId = parseInt(req.params.id);
    const claim = await storage.getClaim(claimId);
    
    if (!claim) {
      return res.status(404).json({ message: "Sinistro não encontrado" });
    }
    
    // Update the claim
    const updatedClaim = await storage.updateClaim(claimId, {
      ...req.body,
      reviewedBy: req.user.id,
      updatedAt: new Date()
    });
    
    // Create a notification for the claim owner
    await storage.createNotification({
      userId: claim.userId,
      title: "Atualização de sinistro",
      message: `Seu sinistro foi atualizado para: ${updatedClaim.status}`,
      type: "claim",
      link: `/claims/${claim.id}`
    });
    
    res.json(updatedClaim);
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar sinistro" });
  }
});

// Notification routes
// Doctor routes
router.get("/api/doctors/profile", isAuthenticated, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Apenas médicos podem acessar este recurso" });
    }
    const doctor = await storage.getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ message: "Perfil médico não encontrado" });
    }
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar perfil do médico" });
  }
});

router.get("/api/doctors/appointments", isAuthenticated, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Apenas médicos podem acessar este recurso" });
    }
    const doctor = await storage.getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ message: "Perfil médico não encontrado" });
    }
    const appointments = await storage.getDoctorAppointments(doctor.id);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar consultas do médico" });
  }
});

router.post("/api/doctors/toggle-availability", isAuthenticated, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Apenas médicos podem acessar este recurso" });
    }
    
    const { available } = req.body;
    if (typeof available !== 'boolean') {
      return res.status(400).json({ message: "O parâmetro 'available' deve ser um booleano" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ message: "Perfil médico não encontrado" });
    }
    
    const updatedDoctor = await storage.toggleDoctorAvailability(doctor.id, available);
    
    // Notificar os administradores sobre a alteração de disponibilidade
    const admins = await storage.getUsersByRole("admin");
    const actionText = available ? "disponível" : "indisponível";
    
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        title: `Status do médico alterado`,
        message: `Dr. ${req.user.fullName || req.user.username} agora está ${actionText} para consultas de emergência.`,
        type: "doctor_availability"
      });
    }
    
    res.json(updatedDoctor);
  } catch (error) {
    res.status(500).json({ message: "Erro ao alterar disponibilidade" });
  }
});

// Rotas para gerenciamento de slots de disponibilidade
router.get("/api/doctors/availability-slots", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Apenas médicos podem gerenciar slots de disponibilidade" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    
    const slots = await storage.getDoctorAvailabilitySlots(doctor.id);
    res.json({ slots });
  } catch (error) {
    console.error("Erro ao buscar slots de disponibilidade:", error);
    res.status(500).json({ message: "Erro ao buscar slots de disponibilidade" });
  }
});

router.post("/api/doctors/availability-slots", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ message: "Apenas médicos podem gerenciar slots de disponibilidade" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    
    const { slots } = req.body;
    if (!Array.isArray(slots)) {
      return res.status(400).json({ message: "Formato inválido para slots de disponibilidade" });
    }
    
    // Garantir que todos os slots pertencem ao médico correto
    const validatedSlots = slots.map(slot => ({
      ...slot,
      doctorId: doctor.id
    }));
    
    const savedSlots = await storage.saveDoctorAvailabilitySlots(validatedSlots);
    res.json({ slots: savedSlots });
  } catch (error) {
    console.error("Erro ao salvar slots de disponibilidade:", error);
    res.status(500).json({ message: "Erro ao salvar slots de disponibilidade" });
  }
});

// Notifications routes
router.get("/api/notifications", isAuthenticated, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Não autorizado" });
    const notifications = await storage.getNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar notificações" });
  }
});

router.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
  try {
    const count = await storage.getUnreadNotificationsCount(req.user.id);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar contagem de notificações" });
  }
});

router.put("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    await storage.markNotificationAsRead(notificationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Erro ao marcar notificação como lida" });
  }
});

router.put("/api/notifications/read-all", isAuthenticated, async (req, res) => {
  try {
    await storage.markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Erro ao marcar notificações como lidas" });
  }
});

// Rotas Daily.co para telemedicina (versão original)
router.use('/api/telemedicine', telemedicineRouter);

// Rota para paciente entrar na sua sala de emergência personalizada
router.post("/api/emergency-room/create", isAuthenticated, async (req, res) => {
  console.log('🚨 REQUISIÇÃO RECEBIDA: /api/emergency-room/create');
  console.log('📋 Headers:', req.headers);
  console.log('👤 Usuário autenticado:', req.user?.fullName || req.user?.username);
  
  try {
    console.log('=== ACESSANDO SALA DE EMERGÊNCIA PERSONALIZADA ===');
    
    const user = req.user!;
    
    // Verificar se é paciente
    if (user.role !== 'patient') {
      return res.status(403).json({ 
        message: "Acesso permitido apenas para pacientes" 
      });
    }

    // Criar nome da sala baseado no username do paciente
    const cleanName = (user.username || user.fullName || `patient-${user.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const roomName = `${cleanName}-emergency`;
    const roomUrl = `https://cnvidas.daily.co/${roomName}`;

    console.log('🏠 Sala personalizada do paciente:', roomName);
    console.log('👤 Paciente:', user.fullName || user.username);
    console.log('🔗 URL da sala:', roomUrl);

    // A sala já foi criada anteriormente, então apenas retornamos os dados
    res.json({
      roomName: roomName,
      roomUrl: roomUrl,
      roomId: roomName, // Usando o nome como ID
      message: `Entrando na sala de emergência de ${user.fullName || user.username}`
    });

    console.log('✅ Redirecionando paciente para sua sala personalizada');

  } catch (error) {
    console.error('❌ Erro ao acessar sala de emergência:', error);
    res.status(500).json({ 
      message: "Erro ao acessar sala de emergência",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
});

// Rota para debugar as informações do PIX salvas no banco
router.get('/api/save-pix-info-debug', async (req, res) => {
  try {
    const doctorId = req.query.doctorId;
    
    if (!doctorId) {
      return res.status(400).json({ message: "ID do médico é obrigatório" });
    }
    
    // Buscar dados do PIX diretamente do banco
    const result = await db.execute(`
      SELECT pix_key_type, pix_key, bank_name, account_type 
      FROM doctors 
      WHERE id = ${doctorId}
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Dados PIX não encontrados" });
    }
    
    // Retornar os dados brutos do banco
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar informações de PIX:", error);
    return res.status(500).json({ message: "Erro ao buscar informações de PIX" });
  }
});

// Rota direta para salvar informações do PIX do médico
router.put('/api/save-pix-info', async (req, res) => {
  try {
    const schema = z.object({
      pixKeyType: z.string().min(1, "Tipo de chave PIX obrigatório"),
      pixKey: z.string().min(1, "Chave PIX obrigatória"),
      bankName: z.string().min(1, "Nome do banco obrigatório"),
      accountType: z.string().min(1, "Tipo de conta obrigatório"),
    });

    const data = schema.parse(req.body);
    const doctorId = req.body.doctorId;
    
    if (!doctorId) {
      return res.status(400).json({ message: "ID do médico é obrigatório" });
    }
    
    await db.execute(`
      UPDATE doctors 
      SET pix_key_type = '${data.pixKeyType}',
          pix_key = '${data.pixKey}',
          bank_name = '${data.bankName}',
          account_type = '${data.accountType}',
          updated_at = NOW()
      WHERE id = ${doctorId}
    `);
    
    return res.status(200).json({ success: true, message: "Informações de PIX atualizadas com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar informações de PIX:", error);
    return res.status(500).json({ message: "Erro ao atualizar informações de PIX" });
  }
});

// Endpoint para obter token Daily.co específico para salas de emergência
router.post('/api/daily-token/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    const { userName } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ error: 'Nome da sala é obrigatório' });
    }
    
    const token = await createToken(roomName, {
      user_id: '1',
      user_name: userName || 'Usuário',
      is_owner: false
    });
    
    console.log('Token Daily.co criado:', token);
    
    res.json({ 
      token: token.token,
      roomName 
    });
  } catch (error) {
    console.error('Erro ao gerar token Daily.co:', error);
    res.status(500).json({ error: 'Não foi possível gerar o token' });
  }
});

// Telemedicine routes
router.post("/api/telemedicine/integrate", isAuthenticated, checkSubscriptionFeature("emergency_consultation"), async (req, res) => {
  try {
    const { appointmentId } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({ message: "appointmentId é obrigatório" });
    }
    
    const appointment = await storage.getAppointment(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ message: "Consulta não encontrada" });
    }
    
    const roomName = `consultation-${appointment.id}`;
    
    const updatedAppointment = await storage.updateAppointment(appointment.id, {
      telemedProvider: "daily",
      telemedLink: `/telemedicine/${appointment.id}`,
      telemedRoomName: roomName,
      type: "telemedicine",
    });
    
    res.json({
      appointmentId: updatedAppointment.id,
      telemedLink: updatedAppointment.telemedLink,
      provider: updatedAppointment.telemedProvider,
      roomName: updatedAppointment.telemedRoomName
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao integrar com telemedicina" });
  }
});

// Generate token for Twilio Video
router.post("/api/telemedicine/token", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({ message: "appointmentId é obrigatório" });
    }
    
    const appointmentIdInt = parseInt(appointmentId);
    if (isNaN(appointmentIdInt)) {
      return res.status(400).json({ message: "ID da consulta inválido" });
    }
    
    const appointment = await storage.getAppointment(appointmentIdInt);
    if (!appointment) {
      return res.status(404).json({ message: "Consulta não encontrada" });
    }
    
    if (appointment.userId !== req.user?.id && appointment.doctorId !== req.user?.id && appointment.partnerId !== req.user?.id) {
      return res.status(403).json({ message: "Não autorizado para esta consulta" });
    }
    
    const roomName = `consultation-${appointment.id}`;
    
    if (appointment.telemedRoomName !== roomName) {
      await storage.updateAppointment(appointment.id, {
        telemedRoomName: roomName
      });
    }
    
    console.log(`Nome da sala definido como: ${roomName}`);
    console.log(`Criando sala de telemedicina: ${roomName} para consulta ${appointment.id}`);
    
    let userRole = "guest";
    
    if (req.user) {
      if (req.user.id === appointment.userId) {
        userRole = "patient";
      } else if (req.user.id === appointment.doctorId) {
        userRole = "doctor";
        
        if (appointment.status === 'scheduled') {
          await storage.updateAppointment(appointment.id, {
            status: 'in_progress'
          });
        }
      }
    }
    
    const identity = String(req.user?.id || '0');
    
    console.log(`Gerando token Daily.co para usuário: ${identity}, função: ${userRole}`);
    const token = await createToken(roomName, {
      user_id: identity,
      user_name: req.user?.fullName || req.user?.username || 'Usuário',
      is_owner: userRole === 'doctor'
    });
    
    res.json({
      token: token.token,
      roomName,
      identity,
      appointment: {
        id: appointment.id,
        type: appointment.type,
        status: appointment.status,
        date: appointment.date,
        doctorId: appointment.doctorId,
        userId: appointment.userId,
        doctorName: appointment.doctorName,
        patientName: req.user ? req.user.fullName : null
      }
    });
  } catch (error) {
    console.error("Erro ao gerar token para videochamada:", error);
    res.status(500).json({ message: "Erro ao gerar token para videochamada" });
  }
});

// Schema para validação de serviços de parceiros
const insertPartnerServiceSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  category: z.string().min(1),
  regularPrice: z.number().positive(),
  discountPrice: z.number().positive(),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  duration: z.number().min(5).optional().default(30),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  partnerId: z.number()
});

// Função para adicionar distância aos serviços
const addDistanceToServices = (services: any[], userCity: string) => {
  return services.map(service => ({
    ...service,
    distance: calculateDistance(userCity, service.city)
  }));
};

// Função para calcular distância entre cidades (simplificada)
const calculateDistance = (city1: string, city2: string) => {
  // Implementação simplificada - retorna 0 se for a mesma cidade
  return city1.toLowerCase() === city2.toLowerCase() ? 0 : 50;
};

export const filterServicesByProximity = (services: any[], userLocation: any) => {
  // Implementação do filtro de proximidade
  return services;
};

// Registrar rotas de telemedicina
router.use('/api/telemedicine', telemedicineRouter);

// Registrar rotas de diagnóstico
router.use('/api/diagnostics', diagnosticsRouter);

export default router;
