import { Router } from 'express';
import { Request, Response } from 'express';
import { DatabaseStorage } from '../storage';
import { storage } from '../storage.js';
import {
  createConsultationPaymentIntent,
  captureConsultationPayment,
  cancelConsultationPayment,
  shouldChargeForEmergencyConsultation
} from '../utils/stripe-payment.js';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { User } from '@shared/schema.js';

const paymentRouter = Router();

/**
 * Middleware para verificar se o usuário está autenticado
 */
const isAuthenticated = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !(req as AuthenticatedRequest).user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
};

/**
 * Criar pré-autorização de pagamento para consulta
 * POST /api/payments/preauthorize
 */
paymentRouter.post('/preauthorize', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { 
      appointmentId, 
      amount, 
      doctorId, 
      isEmergency = false 
    } = req.body;

    if (!appointmentId || !amount || !doctorId) {
      return res.status(400).json({ 
        message: 'Dados incompletos para pré-autorização de pagamento' 
      });
    }

    const authenticatedReq = req as AuthenticatedRequest;
    const user = await storage.getUser(authenticatedReq.user!.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        message: 'Usuário não possui cadastro no sistema de pagamento' 
      });
    }

    // Verificar se devemos cobrar por consulta de emergência com base no plano
    if (isEmergency) {
      const shouldCharge = shouldChargeForEmergencyConsultation(
        user.subscriptionPlan, 
        user.emergencyConsultationsLeft
      );

      if (!shouldCharge) {
        console.log(`Consulta de emergência incluída no plano ${user.subscriptionPlan}`);
        
        // Atualizar consulta sem payment intent (é gratuita pelo plano)
        await storage.updateAppointment(appointmentId, {
          paymentStatus: 'included_in_plan'
        });
        
        return res.json({ 
          success: true,
          message: 'Consulta incluída no plano, não há cobrança',
          isPlanIncluded: true
        });
      }
    }

    // Buscar informações do médico para incluir nos metadados
    const doctor = await storage.getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Médico não encontrado' });
    }

    const doctorUser = await storage.getUser(doctor.userId);
    const doctorName = doctorUser ? doctorUser.fullName || doctorUser.username : 'Médico';

    // Criar o payment intent com metadados
    const paymentIntent = await createConsultationPaymentIntent(
      amount,
      user.stripeCustomerId,
      {
        appointmentId: appointmentId.toString(),
        doctorId: doctorId.toString(),
        userId: user.id.toString(),
        doctorName,
        isEmergency: isEmergency.toString(),
        appointmentDate: new Date().toISOString()
      }
    );

    // Atualizar a consulta com as informações de pagamento
    await storage.updateAppointment(appointmentId, {
      paymentIntentId: paymentIntent.id,
      paymentStatus: 'authorized'
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Erro ao criar pré-autorização de pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar pré-autorização de pagamento',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Capturar pagamento após consulta concluída
 * POST /api/payments/capture/:appointmentId
 */
paymentRouter.post('/capture/:appointmentId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    
    // Verificar permissão (apenas médicos e admins podem capturar)
    if (authenticatedReq.user!.role !== 'doctor' && authenticatedReq.user!.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Apenas médicos e administradores podem capturar pagamentos' 
      });
    }
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    // Verificar se a consulta tem um payment intent
    if (!appointment.paymentIntentId) {
      // Verificar se a consulta está marcada como incluída no plano
      if (appointment.paymentStatus === 'included_in_plan') {
        return res.json({
          success: true,
          message: 'Consulta já está marcada como incluída no plano',
          isPlanIncluded: true
        });
      }
      
      return res.status(400).json({ 
        message: 'Esta consulta não possui um pagamento pré-autorizado' 
      });
    }
    
    // Capturar o pagamento
    const paymentIntent = await captureConsultationPayment(appointment.paymentIntentId);
    
    // Atualizar o status da consulta
    await storage.updateAppointment(parseInt(appointmentId), {
      paymentStatus: 'completed',
      status: 'completed'
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
  } catch (error) {
    console.error('Erro ao capturar pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao capturar pagamento',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Cancelar pagamento pré-autorizado
 * POST /api/payments/cancel/:appointmentId
 */
paymentRouter.post('/cancel/:appointmentId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const authenticatedReq = req as AuthenticatedRequest;
    
    // Buscar a consulta
    const appointment = await storage.getAppointment(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ message: 'Consulta não encontrada' });
    }
    
    // Verificar se o usuário é o próprio paciente, o médico da consulta ou um admin
    if (appointment.userId !== authenticatedReq.user!.id && 
        appointment.doctorId !== authenticatedReq.user!.id && 
        authenticatedReq.user!.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Você não tem permissão para cancelar este pagamento' 
      });
    }
    
    // Verificar se a consulta tem um payment intent
    if (!appointment.paymentIntentId) {
      return res.status(400).json({ 
        message: 'Esta consulta não possui um pagamento pré-autorizado' 
      });
    }
    
    // Cancelar o pagamento
    await cancelConsultationPayment(appointment.paymentIntentId);
    
    // Atualizar o status da consulta
    await storage.updateAppointment(parseInt(appointmentId), {
      paymentStatus: 'cancelled',
      status: 'cancelled'
    });
    
    res.json({
      success: true,
      message: 'Pagamento cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar pagamento',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default paymentRouter;