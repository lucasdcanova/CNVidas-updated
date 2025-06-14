import express, { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';
import { createConsultationPaymentIntent, captureConsultationPayment, cancelConsultationPayment } from '../utils/stripe-payment.js';
import { User } from '../../shared/schema';
import { AppError } from '../utils/app-error';
import { isAuthenticated } from '../middleware/auth.js';
import { checkSubscriptionFeature } from '../middleware/subscription-check.js';
import { toNumberOrThrow } from '../utils/id-converter';
import { db } from '../db';
import { AuthenticatedRequest } from '../types/authenticated-request';

const consultationPaymentRouter = Router();

/**
 * Middleware de autenticação compatível com Express
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
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
    const authReq = req as AuthenticatedRequest;
    const { amount, doctorId, doctorName, date, isEmergency } = req.body;
    
    if (!amount || !doctorId) {
      throw new AppError("Dados insuficientes para criar intenção de pagamento", 400);
    }
    
    // Verificar se o usuário tem um customerId no Stripe
    if (!authReq.user?.stripeCustomerId) {
      throw new AppError("Você precisa ter um método de pagamento cadastrado para realizar consultas", 400);
    }
    
    // Criar intenção de pagamento com pré-autorização
    const paymentIntent = await createConsultationPaymentIntent(
      amount,
      authReq.user.stripeCustomerId,
      {
        userId: String(authReq.user.id),
        doctorId: String(doctorId),
        doctorName: doctorName || "Médico",
        appointmentDate: new Date(date).toISOString(),
        isEmergency: isEmergency ? 'true' : 'false',
        appointmentId: req.body.appointmentId ? String(req.body.appointmentId) : '0'
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
    const authReq = req as AuthenticatedRequest;
    const { appointmentId } = req.params;
    const appointmentIdNumber = toNumberOrThrow(appointmentId);
    
    // Apenas administradores e médicos podem capturar pagamentos
    if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'doctor') {
      throw new AppError("Você não tem permissão para capturar pagamentos", 403);
    }
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(appointmentIdNumber);
    
    if (!appointment) {
      throw new AppError("Consulta não encontrada", 404);
    }
    
    // Verificar se a consulta tem um paymentIntentId
    if (!appointment.paymentIntentId) {
      throw new AppError("Esta consulta não possui um pagamento associado", 400);
    }
    
    // Verificar se o pagamento já foi capturado
    if (appointment.paymentStatus === 'completed') {
      throw new AppError("O pagamento desta consulta já foi capturado", 400);
    }
    
    // Capturar o pagamento
    const paymentIntent = await captureConsultationPayment(appointment.paymentIntentId);
    
    // Atualizar o status da consulta no banco de dados
    await storage.updateAppointment(appointmentIdNumber, {
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
    const authReq = req as AuthenticatedRequest;
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const appointmentIdNumber = toNumberOrThrow(appointmentId);
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(appointmentIdNumber);
    
    if (!appointment) {
      return res.status(404).json({ message: "Consulta não encontrada" });
    }
    
    // Verificar se o usuário tem permissão para cancelar
    // Apenas o próprio paciente, o médico ou um admin podem cancelar
    if (
      authReq.user?.id !== appointment.userId && 
      authReq.user?.role !== 'admin' && 
      (authReq.user?.role !== 'doctor' || authReq.user?.id !== appointment.doctorId)
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
    await storage.updateAppointment(appointmentIdNumber, {
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
  try {
    const { consultationId } = req.body;
    
    if (!consultationId) {
      throw new AppError('ID da consulta é obrigatório', 400);
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
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      throw new AppError('ID do pagamento é obrigatório', 400);
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