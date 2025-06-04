import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCcw
} from 'lucide-react';
import { telemedicineErrorLogger } from '@/lib/telemedicine-error-logger';

type ConnectionDiagnosticProps = {
  appointmentId?: number;
  isVideoActive?: boolean;
  isOpen?: boolean;
  onReconnect?: () => void;
  onIssue?: (issue: {type: string, severity: 'low' | 'medium' | 'high', details?: any}) => void;
};

/**
 * Componente que monitora e exibe o status da conexão durante uma consulta de telemedicina
 * Detecta problemas como alta latência, perda de pacotes ou quedas de conexão
 */
const ConnectionDiagnostic: React.FC<ConnectionDiagnosticProps> = ({ 
  appointmentId,
  isVideoActive = false,
  isOpen = false,
  onReconnect,
  onIssue
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'stable' | 'unstable' | 'offline'>('stable');
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  
  // Verifica o status da conexão com o servidor
  const checkConnection = async () => {
    if (isCheckingConnection || !isVideoActive) return;
    
    setIsCheckingConnection(true);
    
    try {
      // Verificar conexão básica
      if (!navigator.onLine) {
        setConnectionStatus('offline');
        logConnectionIssue('NETWORK_OFFLINE');
        return;
      }
      
      // Realizar ping ao servidor para verificar latência
      const startTime = Date.now();
      const response = await fetch('/api/diagnostics/ping', { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(5000) // 5 segundos timeout
      });
      
      const endTime = Date.now();
      const pingTime = endTime - startTime;
      setLastPingTime(pingTime);
      
      // Avaliar qualidade da conexão com base na latência
      if (pingTime > 500) {
        setConnectionStatus('unstable');
        logConnectionIssue('HIGH_LATENCY', { pingTime });
      } else {
        setConnectionStatus('stable');
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setConnectionStatus('offline');
      logConnectionIssue('CONNECTION_CHECK_FAILED', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    } finally {
      setIsCheckingConnection(false);
    }
  };
  
  // Registra problemas de conexão para diagnóstico
  const logConnectionIssue = (type: string, details?: any) => {
    // Registrar no sistema de logs
    if (appointmentId) {
      telemedicineErrorLogger.logError(appointmentId, {
        type,
        message: `Problema de conexão detectado: ${type}`,
        details,
        timestamp: new Date().toISOString()
      });
    }
    
    // Notificar componente pai sobre o problema
    if (onIssue) {
      const severity = type === 'NETWORK_OFFLINE' ? 'high' : 
                      type === 'HIGH_LATENCY' ? 'medium' : 'low';
                      
      onIssue({
        type,
        severity,
        details
      });
    }
  };
  
  // Inicia verificação periódica quando o vídeo estiver ativo ou o componente estiver aberto
  useEffect(() => {
    if (!isVideoActive && !isOpen) {
      setConnectionStatus('stable');
      return;
    }
    
    // Verifica conexão imediatamente
    checkConnection();
    
    // Verifica a cada 30 segundos
    const interval = setInterval(() => {
      checkConnection();
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [isVideoActive, isOpen]);
  
  // Se a conexão estiver estável, não exibe nada
  if (connectionStatus === 'stable') return null;
  
  return (
    <div className="absolute top-4 left-0 right-0 mx-auto w-auto max-w-md z-10">
      {connectionStatus === 'unstable' && (
        <Alert className="bg-amber-50 border-amber-200 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700">Conexão instável</AlertTitle>
          <AlertDescription className="text-amber-600 text-sm">
            Sua conexão está lenta. {lastPingTime && `(${lastPingTime}ms)`}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2 h-7 text-xs"
              onClick={checkConnection}
            >
              <RefreshCcw className="h-3 w-3 mr-1" />
              Verificar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {connectionStatus === 'offline' && (
        <Alert variant="destructive" className="animate-pulse">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Conexão perdida</AlertTitle>
          <AlertDescription className="text-sm">
            Verifique sua internet. 
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2 h-7 text-xs bg-white"
              onClick={() => {
                checkConnection();
                if (onReconnect) onReconnect();
              }}
            >
              <RefreshCcw className="h-3 w-3 mr-1" />
              Reconectar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ConnectionDiagnostic;