import { storage } from '../storage';
import { captureConsultationPayment } from '../utils/stripe-payment';

/**
 * Processa pagamentos de consultas agendadas 12 horas antes do horário marcado
 * Este job deve ser executado a cada hora
 */
export async function processAppointmentPayments() {
  console.log('🔄 Iniciando processamento de pagamentos de consultas...');
  
  try {
    // Buscar consultas que acontecerão nas próximas 12 horas
    // e que ainda não tiveram o pagamento capturado
    const twelveHoursFromNow = new Date();
    twelveHoursFromNow.setHours(twelveHoursFromNow.getHours() + 12);
    
    const thirteenHoursFromNow = new Date();
    thirteenHoursFromNow.setHours(thirteenHoursFromNow.getHours() + 13);
    
    // Buscar consultas agendadas (não emergenciais) que:
    // 1. Acontecerão entre 12 e 13 horas a partir de agora
    // 2. Têm paymentIntentId (pré-autorização)
    // 3. Status de pagamento é 'authorized' (ainda não capturado)
    const appointments = await storage.getAppointmentsForPaymentProcessing(
      twelveHoursFromNow,
      thirteenHoursFromNow
    );
    
    console.log(`📋 Encontradas ${appointments.length} consultas para processar pagamento`);
    
    for (const appointment of appointments) {
      try {
        console.log(`💳 Processando pagamento da consulta #${appointment.id}`);
        
        // Capturar o pagamento pré-autorizado
        if (appointment.paymentIntentId) {
          const paymentIntent = await captureConsultationPayment(appointment.paymentIntentId);
          
          // Atualizar status do pagamento no banco
          await storage.updateAppointment(appointment.id, {
            paymentStatus: 'completed',
            paymentCapturedAt: new Date(),
            notes: appointment.notes 
              ? `${appointment.notes}\n\nPagamento capturado automaticamente 12h antes da consulta`
              : 'Pagamento capturado automaticamente 12h antes da consulta'
          });
          
          console.log(`✅ Pagamento capturado com sucesso para consulta #${appointment.id}`);
          
          // Enviar notificação ao paciente
          await storage.createNotification({
            userId: appointment.userId,
            type: 'payment',
            title: 'Pagamento Processado',
            message: `O pagamento da sua consulta foi processado com sucesso. A consulta está confirmada para ${new Date(appointment.date).toLocaleString('pt-BR')}.`,
            isRead: false,
            data: { appointmentId: appointment.id }
          });
        }
      } catch (error) {
        console.error(`❌ Erro ao processar pagamento da consulta #${appointment.id}:`, error);
        
        // Registrar erro no banco
        await storage.updateAppointment(appointment.id, {
          notes: appointment.notes 
            ? `${appointment.notes}\n\nErro ao capturar pagamento: ${error}`
            : `Erro ao capturar pagamento: ${error}`
        });
        
        // Notificar o paciente sobre o erro
        await storage.createNotification({
          userId: appointment.userId,
          type: 'error',
          title: 'Erro no Pagamento',
          message: `Houve um problema ao processar o pagamento da sua consulta. Por favor, entre em contato com o suporte.`,
          read: false,
          data: { appointmentId: appointment.id }
        });
      }
    }
    
    console.log('✅ Processamento de pagamentos concluído');
    
  } catch (error) {
    console.error('❌ Erro no job de processamento de pagamentos:', error);
  }
}

/**
 * Cancela pré-autorizações de consultas que foram canceladas
 * mas ainda têm pagamento pendente
 */
export async function cancelExpiredPreAuthorizations() {
  console.log('🔄 Verificando pré-autorizações expiradas...');
  
  try {
    // Buscar consultas canceladas com pagamento ainda autorizado
    const cancelledAppointments = await storage.getCancelledAppointmentsWithPendingPayment();
    
    console.log(`📋 Encontradas ${cancelledAppointments.length} pré-autorizações para cancelar`);
    
    for (const appointment of cancelledAppointments) {
      try {
        if (appointment.paymentIntentId) {
          const { cancelConsultationPayment } = await import('../utils/stripe-payment');
          await cancelConsultationPayment(appointment.paymentIntentId);
          
          await storage.updateAppointment(appointment.id, {
            paymentStatus: 'cancelled'
          });
          
          console.log(`✅ Pré-autorização cancelada para consulta #${appointment.id}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao cancelar pré-autorização da consulta #${appointment.id}:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao cancelar pré-autorizações:', error);
  }
}