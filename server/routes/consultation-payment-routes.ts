import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';
import { createConsultationPaymentIntent, captureConsultationPayment, cancelConsultationPayment } from '../utils/stripe-payment.js';
import { User } from '@shared/schema';
import { AppError } from '../utils/app-error';
import { isAuthenticated } from '../middleware/auth.js';

const consultationPaymentRouter = Router();

/**
 * Middleware de autenticação compatível com Express
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

/**
 * Middleware de tratamento de erros
 */
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Cria uma intenção de pagamento com pré-autorização para consulta
 * POST /api/consultations/create-payment-intent
 */
consultationPaymentRouter.post('/create-payment-intent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { amount, doctorId, doctorName, date, isEmergency } = req.body;
    
    if (!amount || !doctorId) {
      throw new AppError(400, "Dados insuficientes para criar intenção de pagamento");
    }
    
    // Verificar se o usuário tem um customerId no Stripe
    if (!req.user?.stripeCustomerId) {
      throw new AppError(400, "Você precisa ter um método de pagamento cadastrado para realizar consultas");
    }
    
    // Criar intenção de pagamento com pré-autorização
    const paymentIntent = await createConsultationPaymentIntent(
      amount,
      req.user.stripeCustomerId,
      {
        userId: req.user.id.toString(),
        doctorId: doctorId.toString(),
        doctorName: doctorName || "Médico",
        appointmentDate: new Date(date).toISOString(),
        isEmergency: isEmergency ? 'true' : 'false',
        appointmentId: req.body.appointmentId?.toString() || '0'
      }
    );
    
    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Erro ao criar intenção de pagamento para consulta:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Erro ao processar pagamento" });
    }
  }
});

/**
 * Captura um pagamento pré-autorizado após a consulta ser realizada
 * POST /api/consultations/capture-payment/:appointmentId
 */
consultationPaymentRouter.post('/capture-payment/:appointmentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    
    // Apenas administradores e médicos podem capturar pagamentos
    if (req.user?.role !== 'admin' && req.user?.role !== 'doctor') {
      throw new AppError(403, "Você não tem permissão para capturar pagamentos");
    }
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(parseInt(appointmentId));
    
    if (!appointment) {
      throw new AppError(404, "Consulta não encontrada");
    }
    
    // Verificar se a consulta tem um paymentIntentId
    if (!appointment.paymentIntentId) {
      throw new AppError(400, "Esta consulta não possui um pagamento associado");
    }
    
    // Verificar se o pagamento já foi capturado
    if (appointment.paymentStatus === 'completed') {
      throw new AppError(400, "O pagamento desta consulta já foi capturado");
    }
    
    // Capturar o pagamento
    const paymentIntent = await captureConsultationPayment(appointment.paymentIntentId);
    
    // Atualizar o status da consulta no banco de dados
    await storage.updateAppointment(parseInt(appointmentId), {
      paymentStatus: 'completed',
      status: 'completed',
      paymentCapturedAt: new Date()
    });
    
    res.json({
      success: true,
      message: 'Pagamento capturado com sucesso',
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100 // Converter centavos para reais
      }
    });
  } catch (error: any) {
    console.error('Erro ao capturar pagamento de consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao capturar pagamento',
      error: error.message
    });
  }
});

/**
 * Cancela um pagamento pré-autorizado caso a consulta seja cancelada
 * POST /api/consultations/cancel-payment/:appointmentId
 */
consultationPaymentRouter.post('/cancel-payment/:appointmentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(parseInt(appointmentId));
    
    if (!appointment) {
      return res.status(404).json({ message: "Consulta não encontrada" });
    }
    
    // Verificar se o usuário tem permissão para cancelar
    // Apenas o próprio paciente, o médico ou um admin podem cancelar
    if (
      req.user?.id !== appointment.userId && 
      req.user?.role !== 'admin' && 
      (req.user?.role !== 'doctor' || req.user?.id !== appointment.doctorId)
    ) {
      return res.status(403).json({ message: "Você não tem permissão para cancelar esta consulta" });
    }
    
    // Verificar se a consulta tem um paymentIntentId
    if (!appointment.paymentIntentId) {
      return res.status(400).json({ message: "Esta consulta não possui um pagamento associado" });
    }
    
    // Verificar se o pagamento já foi capturado
    if (appointment.paymentStatus === 'completed') {
      return res.status(400).json({ message: "O pagamento desta consulta já foi capturado e não pode ser cancelado" });
    }
    
    // Cancelar o pagamento no Stripe
    const paymentIntent = await cancelConsultationPayment(appointment.paymentIntentId);
    
    // Atualizar o status da consulta no banco de dados
    await storage.updateAppointment(parseInt(appointmentId), {
      paymentStatus: 'cancelled',
      status: 'cancelled',
      notes: reason ? `Cancelada: ${reason}` : 'Consulta cancelada'
    });
    
    res.json({
      success: true,
      message: 'Consulta e pagamento cancelados com sucesso',
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status
      }
    });
  } catch (error: any) {
    console.error('Erro ao cancelar pagamento de consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar pagamento',
      error: error.message
    });
  }
});

/**
 * Inicia um pagamento de consulta
 * POST /api/consultation-payment/start
 */
consultationPaymentRouter.post('/start', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { consultationId } = req.body;
    
    if (!consultationId) {
      throw new AppError(400, 'ID da consulta é obrigatório');
    }

    // TODO: Implementar lógica de início de pagamento
    
    res.json({ message: 'Pagamento iniciado com sucesso' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Confirma um pagamento de consulta
 * POST /api/consultation-payment/confirm
 */
consultationPaymentRouter.post('/confirm', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      throw new AppError(400, 'ID do pagamento é obrigatório');
    }

    // TODO: Implementar lógica de confirmação de pagamento
    
    res.json({ message: 'Pagamento confirmado com sucesso' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

export default consultationPaymentRouter;