import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { AppError } from '../utils/app-error';
import { users, User, legalAcceptances } from '../../shared/schema';
import { db } from '../db';
import { storage } from '../storage';
import { eq } from 'drizzle-orm';
import { hash, compare } from 'bcrypt';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { NotificationService } from '../utils/notification-service';

const scryptAsync = promisify(scrypt);
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { emailVerifications, passwordResets } from '../../shared/schema';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import passport from 'passport';
import { toNumberOrThrow } from '../utils/id-converter';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { getCookieOptions } from '../utils/cookie-config';

const authRouter = Router();

console.log('AuthRouter carregado - rotas disponíveis:');
console.log('- POST /register');
console.log('- POST /login');
console.log('- POST /test');
console.log('- GET /user (verificação de autenticação)');

// Middleware de autenticação
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    throw new AppError('Não autorizado', 401);
  }
  next();
};

// Middleware de tratamento de erros
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Registra um novo usuário
 * POST /api/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('Registro - dados recebidos:', req.body);
    const { 
      email, 
      password, 
      fullName, 
      role = 'patient', 
      username, 
      cpf, 
      cnpj,
      acceptTerms,
      acceptPrivacy,
      acceptContract,
      acceptPartnerContract,
      acceptRecording
    } = req.body;
    
    if (!email || !password || !fullName) {
      throw new AppError('Email, senha e nome completo são obrigatórios', 400);
    }

    // Validar aceitação de termos obrigatórios
    if (!acceptTerms || !acceptPrivacy) {
      throw new AppError('Você deve aceitar os Termos de Uso e a Política de Privacidade', 400);
    }

    // Validar aceitação específica baseada no tipo de usuário
    if (role === 'patient' && !acceptContract) {
      throw new AppError('Você deve aceitar o Contrato de Adesão para pacientes', 400);
    }

    if (role === 'partner' && !acceptPartnerContract) {
      throw new AppError('Você deve aceitar o Contrato de Parceria para empresas', 400);
    }

    // Usar SQL direto para verificar se usuário já existe
    const existingUserResult = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    
    if (existingUserResult.length > 0) {
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }

    // Gerar username se não foi fornecido
    let finalUsername = username;
    if (!finalUsername) {
      if (role === 'patient' && cpf) {
        finalUsername = `p${cpf.replace(/\D/g, '')}`;
      } else if (role === 'partner' && cnpj) {
        finalUsername = `e${cnpj.replace(/\D/g, '')}`;
      } else {
        finalUsername = `u_${Date.now()}`;
      }
    }

    // Verificar se username já existe
    const existingUsernameResult = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.username, finalUsername));
    
    if (existingUsernameResult.length > 0) {
      finalUsername = `${finalUsername}_${Date.now()}`;
    }

    // Hash da senha usando bcrypt
    const hashedPassword = await hash(password, 10);

    // Criar usuário usando Drizzle
    const newUserResult = await db.insert(users)
      .values({
        email,
        username: finalUsername,
        password: hashedPassword,
        fullName,
        role,
        emailVerified: true
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        role: users.role
      });
    
    const newUser = newUserResult[0];

    console.log('Usuário criado com sucesso:', { id: newUser.id, email: newUser.email });

    // Salvar aceitações de documentos legais
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const acceptances = [];
    
    // Sempre adicionar Termos de Uso e Política de Privacidade
    acceptances.push({
      userId: newUser.id,
      documentType: 'terms',
      documentVersion: '1.0.0',
      ipAddress: clientIp,
      userAgent: userAgent
    });
    
    acceptances.push({
      userId: newUser.id,
      documentType: 'privacy',
      documentVersion: '1.0.0',
      ipAddress: clientIp,
      userAgent: userAgent
    });

    // Adicionar contratos específicos baseados no tipo de usuário
    if (role === 'patient' && acceptContract) {
      acceptances.push({
        userId: newUser.id,
        documentType: 'contract',
        documentVersion: '1.0.0',
        ipAddress: clientIp,
        userAgent: userAgent
      });
    }

    if (role === 'partner' && acceptPartnerContract) {
      acceptances.push({
        userId: newUser.id,
        documentType: 'partner_contract',
        documentVersion: '1.0.0',
        ipAddress: clientIp,
        userAgent: userAgent
      });
    }

    // Inserir todas as aceitações em lote
    await db.insert(legalAcceptances).values(acceptances);
    
    console.log(`Salvas ${acceptances.length} aceitações de documentos legais para usuário ${newUser.id}`);

    // Criar notificação de boas-vindas
    try {
      await NotificationService.createWelcomeNotification(newUser.id, newUser.fullName);
    } catch (notificationError) {
      console.error('Erro ao criar notificação de boas-vindas:', notificationError);
      // Não falhar o registro se a notificação falhar
    }

    // Criar prontuário médico automaticamente para pacientes
    if (role === 'patient') {
      try {
        await storage.createMedicalRecord(newUser.id);
        console.log(`Prontuário médico criado para paciente ${newUser.id}`);
      } catch (medicalRecordError) {
        console.error('Erro ao criar prontuário médico:', medicalRecordError);
        // Não falhar o registro se a criação do prontuário falhar
      }
    }

    // Salvar configurações de privacidade do usuário (incluindo consentimento de gravação)
    // Criar configurações para todos os tipos de usuário
    try {
      const defaultPrivacySettings = {
        shareWithDoctors: true,
        shareWithPartners: false,
        shareFullMedicalHistory: false,
        allowAnonymizedDataUse: true,
        profileVisibility: 'contacts'
      };

      // Adicionar consentimento de gravação para pacientes e médicos
      if ((role === 'patient' || role === 'doctor') && acceptRecording !== undefined) {
        Object.assign(defaultPrivacySettings, {
          allowConsultationRecording: acceptRecording === true
        });
      }

      await storage.saveUserSettings(newUser.id, {
        privacy: defaultPrivacySettings
      });
      console.log(`Configurações de privacidade salvas para usuário ${newUser.id}`);
    } catch (settingsError) {
      console.error('Erro ao salvar configurações de privacidade:', settingsError);
      // Não falhar o registro se a criação das configurações falhar
    }

    // Enviar email de verificação
    try {
      const verificationToken = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas

      // Salvar token de verificação no banco de dados
      await db.insert(emailVerifications).values({
        token: verificationToken,
        userId: newUser.id,
        expiresAt,
        createdAt: new Date(),
      });

      // Enviar email
      await sendVerificationEmail(newUser.email, verificationToken);
      console.log(`Email de verificação enviado para ${newUser.email}`);
    } catch (emailError) {
      console.error('Erro ao enviar email de verificação:', emailError);
      // Não falhar o registro se o email falhar
    }

    // Fazer login automático após registro bem-sucedido
    const jwtSecret = process.env.JWT_SECRET || 'cnvidas-secret-key-2024';
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );
    
    // Configurar cookie httpOnly para segurança
    res.cookie('auth_token', token, getCookieOptions(req));

    // Retornar dados do usuário criado com login automático
    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role
      },
      token: token,
      message: 'Usuário registrado com sucesso'
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Rota de teste simples
 * POST /api/auth/test
 */
authRouter.post('/test', async (req: Request, res: Response) => {
  console.log('=== ROTA TEST CHAMADA ===');
  res.json({ message: 'Rota funcionando!', body: req.body });
});



/**
 * Autentica um usuário
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  console.log('=== ROTA LOGIN CHAMADA ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  // Buscar usuário diretamente no banco usando SQL
  try {
    console.log('Buscando usuário no banco:', email);
    console.log('Iniciando query no banco de dados...');
    
    // Usar select() sem campos específicos para evitar erro do Drizzle
    const result = await db.select()
    .from(users)
    .where(eq(users.email, email));
    
    console.log('Query executada, resultado:', result.length, 'usuários encontrados');
    const user = result[0];
    console.log('Usuário encontrado:', !!user);
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    
    if (!user.emailVerified) {
      return res.status(401).json({ error: 'Por favor, verifique seu email antes de fazer login' });
    }
    
    // Verificar a senha (suporte para scrypt e bcrypt)
    let isPasswordValid = false;
    
    try {
      if (!user.password) {
        console.error('User password is null or undefined');
        return res.status(500).json({ error: 'Erro na configuração da conta' });
      }
      
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
        // Formato bcrypt
        console.log('Verificando senha com bcrypt');
        isPasswordValid = await compare(password, user.password);
      } else if (user.password.includes('.') && !user.password.startsWith('$')) {
        // Formato scrypt (hash.salt)
        console.log('Verificando senha com scrypt');
        const [hashed, salt] = user.password.split(".");
        if (hashed && salt) {
          const hashedBuf = Buffer.from(hashed, "hex");
          const suppliedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
          isPasswordValid = timingSafeEqual(hashedBuf, suppliedBuf);
        }
      } else {
        // Formato bcrypt como fallback
        console.log('Verificando senha com bcrypt (fallback)');
        isPasswordValid = await compare(password, user.password);
      }
    } catch (passwordError) {
      console.error('Erro ao verificar senha:', passwordError);
      return res.status(500).json({ error: 'Erro ao verificar credenciais' });
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    
    // Login bem-sucedido - gerar JWT token
    console.log('Login bem-sucedido para:', user.email);
    
    const jwtSecret = process.env.JWT_SECRET || 'cnvidas-secret-key-2024';
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );
    
    // Configurar cookie httpOnly para segurança
    res.cookie('auth_token', token, getCookieOptions(req));
    
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      emergencyConsultationsLeft: user.emergencyConsultationsLeft,
      profileImage: user.profileImage,
      phone: user.phone,
      cpf: user.cpf,
      city: user.city,
      state: user.state,
      address: user.address,
      zipcode: user.zipcode,
      token: token,
      message: 'Login realizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no login:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Autentica um usuário via QR Code
 * POST /api/auth/login-qr
 */
authRouter.post('/login-qr', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'QR Code não fornecido' });
    }
    
    // Buscar o usuário pelo token QR
    const user = await storage.getUserByQrToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'QR Code inválido ou expirado' });
    }
    
    // Registrar o uso do QR token
    try {
      await storage.logQrAuthentication({
        tokenUserId: user.id,
        scannerUserId: user.id, // No login, o scanner é o próprio usuário
        scannedAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: true,
        token: token
      });
    } catch (logError) {
      console.error('Erro ao registrar log de QR auth:', logError);
      // Continue com o login mesmo se o log falhar
    }
    
    // Login bem-sucedido - gerar JWT token
    console.log('Login via QR Code bem-sucedido para:', user.email);
    
    const jwtSecret = process.env.JWT_SECRET || 'cnvidas-secret-key-2024';
    const jwtToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );
    
    // Configurar cookie httpOnly para segurança
    res.cookie('auth_token', jwtToken, getCookieOptions(req));
    
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      emergencyConsultationsLeft: user.emergencyConsultationsLeft,
      profileImage: user.profileImage,
      phone: user.phone,
      cpf: user.cpf,
      city: user.city,
      state: user.state,
      address: user.address,
      zipcode: user.zipcode,
      token: jwtToken,
      message: 'Login via QR Code realizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no login via QR Code:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Verifica se um QR Code é válido
 * POST /api/auth/verify-qr
 */
authRouter.post('/verify-qr', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'QR Code não fornecido' });
    }
    
    // Buscar o usuário pelo token QR
    const user = await storage.getUserByQrToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'QR Code inválido ou expirado' });
    }
    
    res.json({
      valid: true,
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro ao verificar QR Code:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Desautentica um usuário
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    // Primeiro, definir o cookie como string vazia com tempo de expiração imediato
    res.cookie('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expirar imediatamente
      expires: new Date(0) // Data no passado
    });
    
    // Em seguida, limpar o cookie completamente
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined // Adicionar domínio se configurado
    });
    
    // Também limpar qualquer outro cookie relacionado
    res.cookie('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });
    
    res.clearCookie('session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });
    
    // Definir cabeçalhos para evitar cache
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Clear-Site-Data': '"cookies"' // Adicionar header para limpar dados do site
    });
    
    console.log('Logout realizado com sucesso - cookies removidos');
    res.status(200).json({ 
      success: true,
      message: 'Usuário desautenticado com sucesso' 
    });
  } catch (error) {
    console.error('Erro no logout:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Verificar token
authRouter.get('/verify', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new AppError('Token não fornecido', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { id: string | number };
    const userId = toNumberOrThrow(decoded.id);
    
    const result = await db.select().from(users)
      .where(eq(users.id, userId));

    const user = result[0];
    if (!user) {
      throw new AppError('Token inválido', 401);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Token inválido' });
    }
  }
});

/**
 * Rota para obter dados do usuário logado
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      res.json({ user: authReq.user });
    } else {
      res.status(401).json({ message: 'Não autenticado' });
    }
  } catch (error) {
    console.error('Erro ao obter dados do usuário logado:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao obter dados do usuário logado' });
    }
  }
});

// Rota para verificar o email
authRouter.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new AppError('Token inválido', 400);
    }

    // Buscar token de verificação
    const [verificationToken] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token));

    if (!verificationToken) {
      throw new AppError('Token de verificação não encontrado', 404);
    }

    // Verificar se o token expirou
    if (new Date() > verificationToken.expiresAt) {
      throw new AppError('Token de verificação expirado', 400);
    }

    // Atualizar o usuário para verificado
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, verificationToken.userId));

    // Remover o token usado
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.token, token));

    res.json({ message: 'Email verificado com sucesso' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao verificar email' });
    }
  }
});

// Rota para reenviar email de verificação
authRouter.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      // Por segurança, não informamos que o email não existe
      return res.status(200).json({ message: 'Se o email estiver cadastrado, enviaremos um link de verificação' });
    }

    // Verificar se o usuário já está verificado
    if (user.emailVerified) {
      return res.status(400).json({ message: 'Este email já foi verificado' });
    }

    // Remover tokens antigos
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id));

    // Gerar novo token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas

    // Salvar token de verificação no banco de dados
    await db.insert(emailVerifications).values({
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
    });

    // Enviar email de verificação
    await sendVerificationEmail(email, token);

    res.status(200).json({ message: 'Email de verificação reenviado com sucesso' });
  } catch (error) {
    console.error('Erro ao reenviar email de verificação:', error);
    res.status(500).json({ message: 'Erro ao reenviar email de verificação' });
  }
});

// Rota para solicitar redefinição de senha
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      // Por segurança, não informamos que o email não existe
      return res.status(200).json({ message: 'Se o email estiver cadastrado, enviaremos um link de redefinição de senha' });
    }

    // Remover tokens antigos
    await db
      .delete(passwordResets)
      .where(eq(passwordResets.userId, user.id));

    // Gerar novo token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

    // Salvar token de redefinição no banco de dados
    await db.insert(passwordResets).values({
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
    });

    // Enviar email de redefinição de senha
    await sendPasswordResetEmail(email, token);

    res.status(200).json({ message: 'Email de redefinição de senha enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao solicitar redefinição de senha:', error);
    res.status(500).json({ message: 'Erro ao processar a solicitação' });
  }
});

// Rota para redefinir a senha
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token e nova senha são obrigatórios' });
    }

    // Buscar token de redefinição
    const [resetToken] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token));

    if (!resetToken) {
      return res.status(404).json({ message: 'Token de redefinição não encontrado' });
    }

    // Verificar se o token expirou
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: 'Token de redefinição expirado' });
    }

    // Atualizar a senha do usuário
    const hashedPassword = await hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    // Remover o token usado
    await db
      .delete(passwordResets)
      .where(eq(passwordResets.token, token));

    res.status(200).json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ message: 'Erro ao processar redefinição de senha' });
  }
});

/**
 * Obtém dados do usuário autenticado
 * GET /api/auth/user
 */
authRouter.get('/user', async (req: Request, res: Response) => {
  try {
    // Verificar token JWT do cookie ou header Authorization
    let token = null;
    
    // Primeiro, tentar obter do cookie
    if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }
    
    // Se não tiver no cookie, tentar do header Authorization
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação não encontrado' });
    }
    
    // Verificar e decodificar o token JWT
    const jwtSecret = process.env.JWT_SECRET || 'cnvidas-secret-key-2024';
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      console.error('Token JWT inválido:', jwtError);
      return res.status(401).json({ error: 'Token de autenticação inválido' });
    }
    
    // Buscar dados atualizados do usuário no banco
    const result = await db.select()
    .from(users)
    .where(eq(users.id, decoded.userId));
    
    const user = result[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    // Retornar dados do usuário autenticado
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      emergencyConsultationsLeft: user.emergencyConsultationsLeft,
      profileImage: user.profileImage,
      phone: user.phone,
      cpf: user.cpf,
      city: user.city,
      state: user.state,
      address: user.address,
      zipcode: user.zipcode
    });
    
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default authRouter;