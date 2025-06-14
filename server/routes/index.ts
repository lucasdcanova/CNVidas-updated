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
import emergencyV2Router from './emergency-v2';
import paymentRouter from './payment-routes';
import subscriptionCreateRouter from './subscription-create-route';
import subscriptionPaymentRouter from './subscription-payment-routes';
import telemedicineErrorLogsRouter from './telemedicine-error-logs';
import dailyEmergencyRouter from './daily-emergency-routes';
import addressRouter from './address-routes';
import appointmentJoinRouter from './appointment-join';
import claimsRouter from './claims-routes';
import publicSubscriptionRouter from './public-subscription-routes';
import userRouter from './user-routes';
import partnerRouter from './partner-routes';
import doctorRouter from './doctor-routes';
import notificationRouter from './notification-routes';
import checkoutTrackingRouter from './checkout-tracking-routes';
import { adminRoutes } from '../admin-routes';
import legalDocumentsRouter from './legal-documents-routes';
import profileUploadRouter from './profile-upload';
import chatRouter from '../chat-routes';

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
  app.use('/api/telemedicine/daily-direct', dailyDirectRouter); // Compatibilidade com frontend
  app.use('/api/telemedicine/errors', telemedicineErrorLogsRouter);
  
  // Rotas de consulta
  app.use('/api/consultations', consultationPaymentRouter);
  app.use('/api/emergency', emergencyConsultationRouter);
  app.use('/api/emergency/notifications', emergencyNotificationsRouter);
  app.use('/api/emergency/patient', emergencyPatientRouter);
  app.use('/api/emergency/daily', dailyEmergencyRouter);
  app.use('/api/emergency/v2', emergencyV2Router);
  
  // Rotas de pagamento
  app.use('/api/payments', paymentRouter);
  app.use('/api/subscriptions', subscriptionCreateRouter);
  app.use('/api/subscription', publicSubscriptionRouter); // Rotas públicas de subscription
  app.use('/api/subscriptions/payments', subscriptionPaymentRouter);
  
  // Adicionar rotas de métodos de pagamento no caminho esperado pelo cliente
  app.use('/api/subscription', subscriptionPaymentRouter);
  
  // Rotas de dependentes
  app.use('/api/dependents', dependentsRouter);
  
  // Rotas de perfil (ordem específica para evitar conflitos)
  app.use('/api/profile', profileUploadRouter);
  app.use('/api/address', addressRouter);
  
  // Rotas de agendamento
  app.use('/api/appointments', appointmentJoinRouter);
  
  // Rotas de claims
  app.use('/api/claims', claimsRouter);
  
  // Rotas do Daily
  app.use('/api/daily', dailyRoutesRouter);
  app.use('/api/emergency-notifications', emergencyNotificationsRouter);
  app.use('/api/daily-emergency', dailyEmergencyRouter);
  
  // Rotas de usuários
  console.log('Registrando userRouter em /api/users');
  app.use('/api/users', userRouter);
  
  // Rotas administrativas
  console.log('Registrando adminRoutes em /api/admin');
  app.use('/api/admin', adminRoutes);
  
  // Rotas de parceiros (autenticadas)
  console.log('Registrando partnerRouter em /api/partners');
  app.use('/api/partners', partnerRouter);
  
  // Rotas de médicos (autenticadas)
  console.log('Registrando doctorRouter em /api/doctors');
  app.use('/api/doctors', doctorRouter);
  
  // Rotas de notificações
  console.log('Registrando notificationRouter em /api/notifications');
  app.use('/api/notifications', notificationRouter);
  
  // Rotas de monitoramento de checkouts
  console.log('Registrando checkoutTrackingRouter em /api');
  app.use('/api', checkoutTrackingRouter);
  
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
      const { partnerId, userCity } = req.query;
      
      if (partnerId) {
        // Se partnerId for fornecido, buscar apenas serviços desse parceiro
        const partnerIdNumber = parseInt(partnerId as string);
        if (isNaN(partnerIdNumber)) {
          return res.status(400).json({ error: 'partnerId deve ser um número válido' });
        }
        const services = await (await import('../storage')).storage.getPartnerServicesByPartnerId(partnerIdNumber);
        console.log(`[API] Serviços do parceiro ${partnerIdNumber}:`, services.length, 'encontrados');
        if (services.length > 0) {
          console.log('[API] Exemplo de serviço:', {
            id: services[0].id,
            name: services[0].name,
            serviceImage: services[0].serviceImage ? 'Tem imagem' : 'Sem imagem',
            partner: services[0].partner ? 'Tem parceiro' : 'Sem parceiro'
          });
        }
        res.json(services);
      } else {
        // Buscar serviços com filtro de localização
        const services = await (await import('../storage')).storage.getServicesWithLocationFilter(
          userCity as string | undefined,
          50 // raio de 50km
        );
        console.log('[API] Total de serviços filtrados:', services.length);
        if (userCity) {
          console.log(`[API] Serviços filtrados para cidade: ${userCity}`);
        }
        if (services.length > 0) {
          console.log('[API] Exemplo de serviço:', {
            id: services[0].id,
            name: services[0].name,
            isNational: services[0].isNational,
            distance: services[0].distance,
            serviceImage: services[0].serviceImage ? 'Tem imagem' : 'Sem imagem',
            partner: services[0].partner ? 'Tem parceiro' : 'Sem parceiro'
          });
        }
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
  
  // Rotas de documentos legais
  console.log('Registrando legalDocumentsRouter em /api/legal-documents');
  app.use('/api/legal-documents', legalDocumentsRouter);
  
  // Rotas do chatbot
  console.log('Registrando chatRouter em /api/chat');
  app.use('/api/chat', chatRouter);
  
  return app;
} 