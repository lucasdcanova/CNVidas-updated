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

export default async function setupRoutes(app: express.Express) {
  // Rotas de autenticação
  app.use('/api/auth', authRouter);
  
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
  
  return app;
} 