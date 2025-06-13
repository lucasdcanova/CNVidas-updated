import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface DebugInfo {
  mediaPermissions: boolean | null;
  dailyApiAvailable: boolean | null;
  roomExists: boolean | null;
  tokenGenerated: boolean | null;
  connectionStatus: string;
  errors: string[];
}

interface TelemedicineDebuggerProps {
  roomName?: string;
  onClose?: () => void;
}

export function TelemedicineDebugger({ roomName, onClose }: TelemedicineDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    mediaPermissions: null,
    dailyApiAvailable: null,
    roomExists: null,
    tokenGenerated: null,
    connectionStatus: 'idle',
    errors: []
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Erro de permissões de mídia:', error);
      return false;
    }
  };

  const checkDailyApi = async () => {
    try {
      // Tentar ambas as rotas para verificar qual está funcionando
      const routes = [
        '/api/telemedicine/daily-direct/room-exists',
        '/api/telemedicine/direct/room-exists'
      ];
      
      for (const route of routes) {
        try {
          const response = await apiRequest('GET', `${route}?roomName=test-room`);
          if (response.ok) {
            console.log(`✅ Rota funcionando: ${route}`);
            return true;
          }
        } catch (error) {
          console.log(`❌ Rota falhou: ${route}`);
        }
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar API:', error);
      return false;
    }
  };

  const checkRoomExists = async () => {
    if (!roomName) return false;
    
    try {
      // Tentar ambas as rotas
      const routes = [
        '/api/telemedicine/daily-direct/room-exists',
        '/api/telemedicine/direct/room-exists'
      ];
      
      for (const route of routes) {
        try {
          const response = await apiRequest('GET', `${route}?roomName=${roomName}`);
          if (response.ok) {
            const data = await response.json();
            return data.exists;
          }
        } catch (error) {
          console.log(`Erro na rota ${route}:`, error);
        }
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar sala:', error);
      return false;
    }
  };

  const checkTokenGeneration = async () => {
    if (!roomName) return false;
    
    try {
      // Tentar ambas as rotas
      const routes = [
        '/api/telemedicine/daily-direct/token',
        '/api/telemedicine/direct/token'
      ];
      
      for (const route of routes) {
        try {
          const response = await apiRequest('POST', route, {
            roomName,
            userName: 'Test User',
            isOwner: false
          });
          
          if (response.ok) {
            const data = await response.json();
            return !!data.token;
          }
        } catch (error) {
          console.log(`Erro na rota ${route}:`, error);
        }
      }
      return false;
    } catch (error) {
      console.error('Erro ao gerar token:', error);
      return false;
    }
  };

  const runDiagnostics = async () => {
    setIsChecking(true);
    const errors: string[] = [];
    
    try {
      // Verificar permissões de mídia
      setDebugInfo(prev => ({ ...prev, connectionStatus: 'Verificando permissões de mídia...' }));
      const mediaOk = await checkMediaPermissions();
      setDebugInfo(prev => ({ ...prev, mediaPermissions: mediaOk }));
      if (!mediaOk) errors.push('Permissões de câmera/microfone negadas');
      
      // Verificar API do Daily
      setDebugInfo(prev => ({ ...prev, connectionStatus: 'Verificando API do Daily.co...' }));
      const apiOk = await checkDailyApi();
      setDebugInfo(prev => ({ ...prev, dailyApiAvailable: apiOk }));
      if (!apiOk) errors.push('API do Daily.co não está acessível');
      
      // Verificar se a sala existe
      if (roomName) {
        setDebugInfo(prev => ({ ...prev, connectionStatus: 'Verificando sala...' }));
        const roomOk = await checkRoomExists();
        setDebugInfo(prev => ({ ...prev, roomExists: roomOk }));
        if (!roomOk) errors.push('Sala não encontrada no Daily.co');
        
        // Verificar geração de token
        setDebugInfo(prev => ({ ...prev, connectionStatus: 'Verificando token...' }));
        const tokenOk = await checkTokenGeneration();
        setDebugInfo(prev => ({ ...prev, tokenGenerated: tokenOk }));
        if (!tokenOk) errors.push('Falha ao gerar token de acesso');
      }
      
      setDebugInfo(prev => ({ 
        ...prev, 
        connectionStatus: errors.length === 0 ? 'Tudo funcionando!' : 'Problemas detectados',
        errors 
      }));
    } catch (error) {
      console.error('Erro durante diagnóstico:', error);
      errors.push('Erro geral durante diagnóstico');
      setDebugInfo(prev => ({ ...prev, errors, connectionStatus: 'Erro no diagnóstico' }));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [roomName]);

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertCircle className="h-5 w-5 text-gray-400" />;
    if (status) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="secondary">Verificando...</Badge>;
    if (status) return <Badge className="bg-green-500">OK</Badge>;
    return <Badge variant="destructive">Erro</Badge>;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Diagnóstico de Telemedicina</span>
          <Button
            size="sm"
            variant="outline"
            onClick={runDiagnostics}
            disabled={isChecking}
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.mediaPermissions)}
              <span className="font-medium">Permissões de Mídia</span>
            </div>
            {getStatusBadge(debugInfo.mediaPermissions)}
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.dailyApiAvailable)}
              <span className="font-medium">API Daily.co</span>
            </div>
            {getStatusBadge(debugInfo.dailyApiAvailable)}
          </div>
          
          {roomName && (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(debugInfo.roomExists)}
                  <span className="font-medium">Sala: {roomName}</span>
                </div>
                {getStatusBadge(debugInfo.roomExists)}
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(debugInfo.tokenGenerated)}
                  <span className="font-medium">Token de Acesso</span>
                </div>
                {getStatusBadge(debugInfo.tokenGenerated)}
              </div>
            </>
          )}
        </div>
        
        {debugInfo.errors.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">Problemas Encontrados:</h4>
            <ul className="list-disc list-inside space-y-1">
              {debugInfo.errors.map((error, index) => (
                <li key={index} className="text-sm text-red-700">{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Status: {debugInfo.connectionStatus}</p>
          {isChecking && (
            <p className="text-xs text-gray-500">Executando verificações...</p>
          )}
        </div>
        
        {onClose && (
          <div className="pt-4 border-t">
            <Button onClick={onClose} className="w-full">
              Fechar Diagnóstico
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}