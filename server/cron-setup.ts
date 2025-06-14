import cron from 'node-cron';
import { processAppointmentPayments, cancelExpiredPreAuthorizations } from './jobs/process-appointment-payments';

/**
 * Configuração dos jobs agendados do sistema
 */
export function setupCronJobs() {
  console.log('🕐 Configurando jobs agendados...');

  // Job para processar pagamentos de consultas (executa a cada hora)
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Executando job de processamento de pagamentos...');
    await processAppointmentPayments();
  });

  // Job para cancelar pré-autorizações expiradas (executa a cada 6 horas)
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Executando job de cancelamento de pré-autorizações...');
    await cancelExpiredPreAuthorizations();
  });

  console.log('✅ Jobs agendados configurados com sucesso');
}