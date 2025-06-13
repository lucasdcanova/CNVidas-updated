// Utilitário de diagnóstico para problemas de telemedicina
import { apiRequest } from '@/lib/queryClient';

export interface DiagnosticResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

export class TelemedicineDiagnostics {
  static async runFullDiagnostic(roomName?: string): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    // 1. Verificar permissões de mídia
    results.push(await this.checkMediaPermissions());
    
    // 2. Verificar conectividade com a API
    results.push(await this.checkApiConnectivity());
    
    // 3. Se tiver roomName, verificar a sala
    if (roomName) {
      results.push(await this.checkRoomExists(roomName));
      results.push(await this.checkTokenGeneration(roomName));
    }
    
    // 4. Verificar WebRTC
    results.push(await this.checkWebRTC());
    
    return results;
  }
  
  static async checkMediaPermissions(): Promise<DiagnosticResult> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      // Verificar se realmente temos tracks
      const hasAudio = stream.getAudioTracks().length > 0;
      const hasVideo = stream.getVideoTracks().length > 0;
      
      // Limpar recursos
      stream.getTracks().forEach(track => track.stop());
      
      if (!hasAudio || !hasVideo) {
        return {
          step: 'Permissões de Mídia',
          success: false,
          message: `Mídia incompleta: Áudio=${hasAudio}, Vídeo=${hasVideo}`,
          data: { hasAudio, hasVideo }
        };
      }
      
      return {
        step: 'Permissões de Mídia',
        success: true,
        message: 'Câmera e microfone permitidos',
        data: { hasAudio, hasVideo }
      };
    } catch (error: any) {
      return {
        step: 'Permissões de Mídia',
        success: false,
        message: `Erro ao acessar mídia: ${error.message}`,
        error
      };
    }
  }
  
  static async checkApiConnectivity(): Promise<DiagnosticResult> {
    try {
      const testRoomName = 'test-diagnostic-' + Date.now();
      
      // Tentar criar uma sala de teste
      const response = await apiRequest('POST', '/api/telemedicine/daily-direct/create-room', {
        roomName: testRoomName,
        forceCreate: true,
        expiryHours: 1
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return {
          step: 'Conectividade API',
          success: false,
          message: `API retornou erro: ${response.status}`,
          error: errorData
        };
      }
      
      const data = await response.json();
      
      // Tentar deletar a sala de teste
      try {
        await apiRequest('DELETE', `/api/telemedicine/daily-direct/rooms/${testRoomName}`);
      } catch (deleteError) {
        console.warn('Não foi possível deletar sala de teste:', deleteError);
      }
      
      return {
        step: 'Conectividade API',
        success: true,
        message: 'API Daily.co funcionando corretamente',
        data
      };
    } catch (error: any) {
      return {
        step: 'Conectividade API',
        success: false,
        message: `Erro de conectividade: ${error.message}`,
        error
      };
    }
  }
  
  static async checkRoomExists(roomName: string): Promise<DiagnosticResult> {
    try {
      const response = await apiRequest('GET', `/api/telemedicine/daily-direct/room-exists?roomName=${roomName}`);
      
      if (!response.ok) {
        return {
          step: 'Verificação de Sala',
          success: false,
          message: `Erro ao verificar sala: ${response.status}`,
          error: await response.json()
        };
      }
      
      const data = await response.json();
      
      return {
        step: 'Verificação de Sala',
        success: data.exists,
        message: data.exists ? 'Sala encontrada no Daily.co' : 'Sala não existe no Daily.co',
        data
      };
    } catch (error: any) {
      return {
        step: 'Verificação de Sala',
        success: false,
        message: `Erro ao verificar sala: ${error.message}`,
        error
      };
    }
  }
  
  static async checkTokenGeneration(roomName: string): Promise<DiagnosticResult> {
    try {
      const response = await apiRequest('POST', '/api/telemedicine/daily-direct/token', {
        roomName,
        userName: 'Diagnostic Test',
        isOwner: false
      });
      
      if (!response.ok) {
        return {
          step: 'Geração de Token',
          success: false,
          message: `Erro ao gerar token: ${response.status}`,
          error: await response.json()
        };
      }
      
      const data = await response.json();
      
      return {
        step: 'Geração de Token',
        success: !!data.token,
        message: data.token ? 'Token gerado com sucesso' : 'Token não foi gerado',
        data: { hasToken: !!data.token }
      };
    } catch (error: any) {
      return {
        step: 'Geração de Token',
        success: false,
        message: `Erro ao gerar token: ${error.message}`,
        error
      };
    }
  }
  
  static async checkWebRTC(): Promise<DiagnosticResult> {
    try {
      // Verificar se WebRTC está disponível
      if (!window.RTCPeerConnection) {
        return {
          step: 'WebRTC',
          success: false,
          message: 'WebRTC não está disponível neste navegador'
        };
      }
      
      // Tentar criar uma conexão de teste
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Criar oferta de teste
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Limpar
      pc.close();
      
      return {
        step: 'WebRTC',
        success: true,
        message: 'WebRTC funcionando corretamente',
        data: {
          browserSupport: true,
          canCreateOffer: true
        }
      };
    } catch (error: any) {
      return {
        step: 'WebRTC',
        success: false,
        message: `Erro WebRTC: ${error.message}`,
        error
      };
    }
  }
  
  static formatResults(results: DiagnosticResult[]): string {
    let output = '=== Diagnóstico de Telemedicina ===\n\n';
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      output += `${status} ${result.step}\n`;
      output += `   ${result.message}\n`;
      if (result.data) {
        output += `   Dados: ${JSON.stringify(result.data, null, 2)}\n`;
      }
      if (result.error) {
        output += `   Erro: ${JSON.stringify(result.error, null, 2)}\n`;
      }
      output += '\n';
    });
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    output += `\nResumo: ${successCount}/${totalCount} testes passaram\n`;
    
    return output;
  }
}

// Exportar para uso global no console do navegador
if (typeof window !== 'undefined') {
  (window as any).TelemedicineDiagnostics = TelemedicineDiagnostics;
}