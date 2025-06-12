import { storage } from '../storage';
import { InsertNotification } from '../interfaces/notification';

export class NotificationService {
  
  /**
   * Criar notificação de consulta agendada
   */
  static async createAppointmentNotification(userId: number, appointmentId: number, isEmergency: boolean = false) {
    try {
      const notification: InsertNotification = {
        userId,
        type: 'appointment',
        title: isEmergency ? 'Consulta de Emergência Agendada' : 'Consulta Agendada',
        message: isEmergency ? 
          'Sua consulta de emergência foi agendada com sucesso. Você será conectado com um médico em breve.' :
          'Sua consulta foi agendada com sucesso. Você receberá um lembrete antes do horário.',
        read: false,
        data: { appointmentId }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de consulta criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de consulta:', error);
    }
  }

  /**
   * Criar notificação de consulta concluída
   */
  static async createAppointmentCompletedNotification(userId: number, appointmentId: number) {
    try {
      const notification: InsertNotification = {
        userId,
        type: 'appointment',
        title: 'Consulta Concluída',
        message: 'Sua consulta foi concluída com sucesso. Obrigado por usar nossos serviços de telemedicina.',
        read: false,
        data: { appointmentId }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de consulta concluída criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de consulta concluída:', error);
    }
  }

  /**
   * Criar notificação de sinistro submetido
   */
  static async createClaimSubmittedNotification(userId: number, claimId: number) {
    try {
      const notification: InsertNotification = {
        userId,
        type: 'claim',
        title: 'Sinistro Enviado',
        message: 'Seu sinistro foi enviado com sucesso e está sendo analisado por nossa equipe. Você será notificado sobre atualizações.',
        read: false,
        data: { claimId }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de sinistro criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de sinistro:', error);
    }
  }

  /**
   * Criar notificação de atualização de sinistro
   */
  static async createClaimStatusUpdateNotification(userId: number, claimId: number, status: string) {
    try {
      let title = 'Sinistro Atualizado';
      let message = 'Houve uma atualização no status do seu sinistro.';
      
      switch (status) {
        case 'aprovado':
          title = 'Sinistro Aprovado';
          message = 'Parabéns! Seu sinistro foi aprovado e será processado em breve.';
          break;
        case 'rejeitado':
          title = 'Sinistro Rejeitado';
          message = 'Infelizmente seu sinistro foi rejeitado. Entre em contato para mais informações.';
          break;
        case 'em análise':
          title = 'Sinistro em Análise';
          message = 'Seu sinistro está sendo analisado por nossa equipe especializada.';
          break;
      }

      const notification: InsertNotification = {
        userId,
        type: 'claim',
        title,
        message,
        read: false,
        data: { claimId, status }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de atualização de sinistro criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de atualização de sinistro:', error);
    }
  }

  /**
   * Criar notificação de plano ativado
   */
  static async createSubscriptionActivatedNotification(userId: number, planType: string) {
    try {
      const notification: InsertNotification = {
        userId,
        type: 'subscription',
        title: 'Plano Ativado',
        message: `Seu plano ${planType} foi ativado com sucesso! Agora você tem acesso a todos os benefícios inclusos.`,
        read: false,
        data: { planType }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de plano ativado criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de plano:', error);
    }
  }

  /**
   * Criar notificação de pagamento
   */
  static async createPaymentNotification(userId: number, success: boolean, amount?: number, planType?: string) {
    try {
      let title = success ? 'Pagamento Confirmado' : 'Falha no Pagamento';
      let message = success ? 
        `Seu pagamento${amount ? ` de R$ ${amount.toFixed(2).replace('.', ',')}` : ''} foi processado com sucesso.${planType ? ` Seu plano ${planType} está ativo.` : ''}` :
        'Houve um problema ao processar seu pagamento. Tente novamente ou entre em contato conosco.';

      const notification: InsertNotification = {
        userId,
        type: 'payment',
        title,
        message,
        read: false,
        data: { success, amount, planType }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de pagamento criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de pagamento:', error);
    }
  }

  /**
   * Criar notificação de boas-vindas
   */
  static async createWelcomeNotification(userId: number, fullName: string) {
    try {
      const notification: InsertNotification = {
        userId,
        type: 'system',
        title: 'Bem-vindo à CN Vidas!',
        message: `Olá ${fullName}! Seja bem-vindo à CN Vidas. Explore nossos serviços de saúde digital e cuide bem de você.`,
        read: false,
        data: { isWelcome: true }
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de boas-vindas criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de boas-vindas:', error);
    }
  }

  /**
   * Criar notificação de sistema
   */
  static async createSystemNotification(userId: number, title: string, message: string, data?: any) {
    try {
      const notification: InsertNotification = {
        userId,
        type: 'system',
        title,
        message,
        read: false,
        data
      };
      
      await storage.createNotification(notification);
      console.log('✅ Notificação de sistema criada para usuário:', userId);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de sistema:', error);
    }
  }
} 