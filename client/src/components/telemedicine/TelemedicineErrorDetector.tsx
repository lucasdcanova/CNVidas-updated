import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { WifiOff, AlertCircle, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TroubleshootingDialog from './TroubleshootingDialog';
import React from 'react';

interface TelemedicineErrorDetectorProps {
  appointmentId?: number;
  isVideoActive?: boolean;
  onErrorDetected?: (error: any) => void;
}

interface TroubleshootingDialogProps {
  appointmentId?: number;
  onDiagnosticComplete: (result: { success: boolean; message: string }) => void;
}

/**
 * Componente para monitorar e detectar erros de conexão durante telemedicina
 * Faz verificações periódicas da conexão e oferece diagnóstico quando necessário
 */
const TelemedicineErrorDetector: React.FC<TelemedicineErrorDetectorProps> = ({
  appointmentId,
  isVideoActive = false,
  onErrorDetected
}) => {
  const [hasNetworkIssues, setHasNetworkIssues] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Verifica a conexão com a internet
  const checkConnection = async () => {
    if (isCheckingConnection) return;
    setIsCheckingConnection(true);
    
    try {
      // Verifica se o navegador está online
      if (!navigator.onLine) {
        setHasNetworkIssues(true);
        if (onErrorDetected) {
          onErrorDetected({
            type: 'NETWORK_OFFLINE',
            message: 'Sua conexão com a internet foi perdida'
          });
        }
        return;
      }
      
      // Faz um teste rápido de ping para verificar conectividade real
      const startTime = Date.now();
      const response = await fetch('/api/diagnostics/ping', { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(5000) // 5 segundos de timeout
      });
      
      const pingTime = Date.now() - startTime;
      const pingOk = response.ok;
      
      // Latência alta é considerada um problema potencial
      const hasLatencyIssue = pingTime > 300;
      
      setHasNetworkIssues(!pingOk || hasLatencyIssue);
      
      if (!pingOk || hasLatencyIssue) {
        if (onErrorDetected) {
          onErrorDetected({
            type: 'NETWORK_LATENCY',
            message: 'Sua conexão está com alta latência',
            details: { pingTime }
          });
        }
        
        if (hasLatencyIssue && isVideoActive) {
          toast({
            title: "Conexão lenta detectada",
            description: "Sua internet pode estar com problemas. Use o diagnóstico para verificar.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setHasNetworkIssues(true);
      
      if (onErrorDetected) {
        onErrorDetected({
          type: 'CONNECTION_CHECK_FAILED',
          message: 'Não foi possível verificar sua conexão',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    } finally {
      setIsCheckingConnection(false);
    }
  };
  
  // Verifica a conexão periodicamente se o vídeo estiver ativo
  useEffect(() => {
    if (!isVideoActive) return;
    
    // Primeira verificação
    checkConnection();
    
    // Verificações periódicas
    const interval = setInterval(() => {
      checkConnection();
    }, 30000); // A cada 30 segundos
    
    return () => {
      clearInterval(interval);
    };
  }, [isVideoActive]);
  
  // Se não houver problemas, não renderiza nada
  if (!hasNetworkIssues && isVideoActive) {
    return null;
  }
  
  const handleResult = (result: { success: boolean; message: string }) => {
    if (result && result.success) {
      setHasNetworkIssues(false);
      toast({
        title: "Diagnóstico concluído",
        description: "Sua conexão parece estar funcionando corretamente agora",
        variant: "default"
      });
    }
  };
  
  return (
    <div className="flex items-center justify-center gap-2 p-2">
      {hasNetworkIssues && (
        <Button 
          variant="destructive" 
          size="sm"
          className="gap-2 animate-pulse"
          onClick={() => setIsDialogOpen(true)}
        >
          <WifiOff className="h-4 w-4" />
          Problemas de conexão detectados
        </Button>
      )}
      
      <TroubleshootingDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
};

export default TelemedicineErrorDetector;