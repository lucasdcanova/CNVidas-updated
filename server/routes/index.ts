import express from 'express';
import authRouter from './auth-routes';
import diagnosticRouter from './diagnostic-routes';
import dailyRouter from './telemedicine-daily';
import { telemedicineRouter as telemedicineDailyV2Router } from './telemedicine-daily-v2';
import dailyDirectRouter from './daily-direct';
import consultationPaymentRouter from './consultation-payment-routes';
import dailyRoutesRouter from './daily-routes';
import dependentsRouter from './dependents-routes-new';
import emergencyConsultationRouter from './emergency-consultation';
import emergencyNotificationsRouter from './emergency-notifications';
import emergencyPatientRouter from './emergency-patient';
import paymentRouter from './payment-routes';
import subscriptionCreateRouter from './subscription-create-route';
import subscriptionPaymentRouter from './subscription-payment-routes';
import telemedicineErrorLogsRouter from './telemedicine-error-logs';
import uploadRouter from './upload-routes';
import dailyEmergencyRouter from './daily-emergency-routes';
import profileImageRouter from './profile-image-routes';
import addressRouter from './address-routes';
import appointmentJoinRouter from './appointment-join';
import publicSubscriptionRouter from './public-subscription-routes';
import userRouter from './user-routes';
import partnerRouter from './partner-routes';
import { adminRouter } from '../admin-routes';

export default async function setupRoutes(app: express.Express) {
  // Rotas de autenticação (PRIMEIRO para evitar conflitos)
  console.log('Registrando authRouter em /api/auth');
  app.use('/api/auth', authRouter);
  
  // Rotas de compatibilidade específicas
  app.post('/api/login', (req, res, next) => {
    console.log('=== ROTA /api/login INTERCEPTADA ===');
    req.url = '/login';
    authRouter(req, res, next);
  });
  
  app.post('/api/register', (req, res, next) => {
    console.log('=== ROTA /api/register INTERCEPTADA ===');
    req.url = '/register';
    authRouter(req, res, next);
  });
  
  app.get('/api/user', (req, res, next) => {
    console.log('=== ROTA /api/user INTERCEPTADA ===');
    req.url = '/user';
    authRouter(req, res, next);
  });
  
  app.post('/api/logout', (req, res, next) => {
    console.log('=== ROTA /api/logout INTERCEPTADA ===');
    req.url = '/logout';
    authRouter(req, res, next);
  });
  
  // Rotas de diagnóstico
  app.use('/api/diagnostics', diagnosticRouter);
  
  // Rotas de telemedicina
  app.use('/api/telemedicine', dailyRouter);
  app.use('/api/telemedicine/v2', telemedicineDailyV2Router);
  app.use('/api/telemedicine/direct', dailyDirectRouter);
  app.use('/api/telemedicine/errors', telemedicineErrorLogsRouter);
  
  // Rotas de consulta
  app.use('/api/consultations', consultationPaymentRouter);
  app.use('/api/emergency', emergencyConsultationRouter);
  app.use('/api/emergency/notifications', emergencyNotificationsRouter);
  app.use('/api/emergency/patient', emergencyPatientRouter);
  app.use('/api/emergency/daily', dailyEmergencyRouter);
  
  // Rotas de pagamento
  app.use('/api/payments', paymentRouter);
  app.use('/api/subscriptions', subscriptionCreateRouter);
  app.use('/api/subscription', publicSubscriptionRouter); // Rotas públicas de subscription
  app.use('/api/subscriptions/payments', subscriptionPaymentRouter);
  
  // Rotas de dependentes
  app.use('/api/dependents', dependentsRouter);
  
  // Rotas de perfil
  app.use('/api/profile/image', profileImageRouter);
  app.use('/api/address', addressRouter);
  
  // Rotas de agendamento
  app.use('/api/appointments', appointmentJoinRouter);
  
  // Rotas de upload
  app.use('/api/upload', uploadRouter);
  
  // Rotas do Daily
  app.use('/api/daily', dailyRoutesRouter);
  app.use('/api/emergency-notifications', emergencyNotificationsRouter);
  app.use('/api/daily-emergency', dailyEmergencyRouter);
  
  // Rotas de usuários
  console.log('Registrando userRouter em /api/users');
  app.use('/api/users', userRouter);
  
  // Rotas administrativas
  console.log('Registrando adminRouter em /api/admin');
  app.use('/api/admin', adminRouter);
  
  // Rotas de parceiros (autenticadas)
  console.log('Registrando partnerRouter em /api/partners');
  app.use('/api/partners', partnerRouter);
  
  // Rota pública para listar todos os parceiros
  app.get('/api/all-partners', async (req, res) => {
    try {
      const partners = await (await import('../storage')).storage.getAllPartners();
      res.json(partners);
    } catch (error) {
      console.error('Erro ao buscar parceiros:', error);
      res.status(500).json({ error: 'Erro ao buscar parceiros' });
    }
  });
  
  // Rotas públicas para médicos
  console.log('Registrando rotas públicas de médicos em /api/doctors');
  app.get('/api/doctors', async (req, res) => {
    try {
      const doctors = await (await import('../storage')).storage.getAllDoctors();
      res.json(doctors);
    } catch (error) {
      console.error('Erro ao buscar médicos:', error);
      res.status(500).json({ error: 'Erro ao buscar médicos' });
    }
  });
  
  app.get('/api/doctors/available', async (req, res) => {
    try {
      const doctors = await (await import('../storage')).storage.getAvailableDoctors();
      res.json(doctors);
    } catch (error) {
      console.error('Erro ao buscar médicos disponíveis:', error);
      res.status(500).json({ error: 'Erro ao buscar médicos disponíveis' });
    }
  });
  
  // Rotas públicas para serviços
  console.log('Registrando rotas públicas de serviços em /api/services');
  app.get('/api/services', async (req, res) => {
    try {
      const { partnerId } = req.query;
      
      if (partnerId) {
        // Se partnerId for fornecido, buscar apenas serviços desse parceiro
        const partnerIdNumber = parseInt(partnerId as string);
        if (isNaN(partnerIdNumber)) {
          return res.status(400).json({ error: 'partnerId deve ser um número válido' });
        }
        const services = await (await import('../storage')).storage.getPartnerServicesByPartnerId(partnerIdNumber);
        res.json(services);
      } else {
        // Caso contrário, buscar todos os serviços
        const services = await (await import('../storage')).storage.getAllPartnerServices();
        res.json(services);
      }
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      res.status(500).json({ error: 'Erro ao buscar serviços' });
    }
  });
  
  // Rota específica para serviços de um parceiro (compatibilidade)
  app.get('/api/services/partner/:partnerId', async (req, res) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      if (isNaN(partnerId)) {
        return res.status(400).json({ error: 'partnerId deve ser um número válido' });
      }
      
      const services = await (await import('../storage')).storage.getPartnerServicesByPartnerId(partnerId);
      res.json(services);
    } catch (error) {
      console.error('Erro ao buscar serviços do parceiro:', error);
      res.status(500).json({ error: 'Erro ao buscar serviços do parceiro' });
    }
  });
  
  app.get('/api/services/featured', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const services = await (await import('../storage')).storage.getFeaturedServices(limit);
      res.json(services);
    } catch (error) {
      console.error('Erro ao buscar serviços em destaque:', error);
      res.status(500).json({ error: 'Erro ao buscar serviços em destaque' });
    }
  });
  
  return app;
} 