/**
 * Módulo para registrar e analisar erros de telemedicina
 * Oferece funções para enviar logs detalhados ao servidor
 * e auxiliar no diagnóstico de problemas de conexão
 */

import { apiRequest } from './queryClient';

interface TelemedicineError {
  type: string;
  message: string;
  timestamp?: string;
  details?: any;
  error?: any;
}

interface DiagnosticResult {
  network: any;
  browser: any;
  media: any;
  server: any;
  timestamp: string;
  appointmentId?: number;
  success: boolean;
}

class TelemedicineErrorLogger {
  private lastErrors: Map<string, { timestamp: number, count: number }> = new Map();
  private readonly ERROR_RATE_LIMIT = 30000; // 30 segundos entre logs do mesmo tipo
  private readonly MAX_RETRIES = 3;
  
  /**
   * Registra um erro que ocorreu durante uma consulta de telemedicina
   * @param appointmentId ID da consulta
   * @param error Detalhes do erro
   */
  async logError(appointmentId: number, error: TelemedicineError): Promise<boolean> {
    try {
      const errorKey = `${appointmentId}:${error.type}`;
      const now = Date.now();
      
      // Verifica se esse mesmo erro foi registrado recentemente
      // para evitar flood de logs com o mesmo problema
      const lastError = this.lastErrors.get(errorKey);
      if (lastError && now - lastError.timestamp < this.ERROR_RATE_LIMIT) {
        // Incrementa o contador de repetições
        this.lastErrors.set(errorKey, {
          timestamp: lastError.timestamp,
          count: lastError.count + 1
        });
        // Envia apenas se tiver muito repetições (pode indicar problema persistente)
        if (lastError.count < 5) {
          return false;
        }
      }
      
      // Atualiza o registro do último erro
      this.lastErrors.set(errorKey, {
        timestamp: now,
        count: 1
      });
      
      // Adiciona timestamp se não existir
      if (!error.timestamp) {
        error.timestamp = new Date().toISOString();
      }
      
      // Envia para o servidor
      await this._sendErrorLog({
        appointmentId,
        ...error,
        userAgent: navigator.userAgent,
        // Adiciona informações sobre a conexão
        connectionInfo: {
          onLine: navigator.onLine,
          effectiveType: 'connection' in navigator && 
            'effectiveType' in (navigator as any).connection ? 
            (navigator as any).connection.effectiveType : 'unknown'
        }
      });
      
      return true;
    } catch (err) {
      console.error('Falha ao registrar erro de telemedicina:', err);
      return false;
    }
  }
  
  /**
   * Registra o resultado de um diagnóstico completo
   * @param appointmentId ID da consulta
   * @param result Resultado do diagnóstico
   */
  async logDiagnosticResult(appointmentId: number, result: DiagnosticResult): Promise<boolean> {
    try {
      await this._sendErrorLog({
        appointmentId,
        type: 'DIAGNOSTIC_RESULT',
        timestamp: new Date().toISOString(),
        details: result
      });
      
      return true;
    } catch (err) {
      console.error('Falha ao registrar resultado do diagnóstico:', err);
      return false;
    }
  }
  
  /**
   * Envia dados para a API de log com retry em caso de falha
   */
  private async _sendErrorLog(data: any, retryCount = 0): Promise<void> {
    try {
      await apiRequest('POST', '/api/diagnostics/error-log', data);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        // Espera um tempo antes de tentar novamente (backoff exponencial)
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._sendErrorLog(data, retryCount + 1);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Limpa registros antigos de erros para evitar consumo excessivo de memória
   */
  cleanupOldErrors(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 3600000; // 1 hora
    
    for (const [key, value] of this.lastErrors.entries()) {
      if (now - value.timestamp > CLEANUP_THRESHOLD) {
        this.lastErrors.delete(key);
      }
    }
  }
}

// Exporta uma instância única para uso em toda a aplicação
export const telemedicineErrorLogger = new TelemedicineErrorLogger();

// Limpa erros antigos periodicamente
setInterval(() => {
  telemedicineErrorLogger.cleanupOldErrors();
}, 1800000); // A cada 30 minutos