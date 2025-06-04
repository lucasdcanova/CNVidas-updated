import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import DailyIframe from '@daily-co/daily-js';
import { Select, SelectItem } from '@/components/ui/select';

export default function EmergencyTest() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDoctorAvailable, setIsDoctorAvailable] = useState(false);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [roomUrl, setRoomUrl] = useState('');
  const [selectedOption, setSelectedOption] = useState<string>('');

  // Verificar disponibilidade de médicos
  useEffect(() => {
    const checkDoctors = async () => {
      try {
        const res = await fetch('/api/emergency/patient/check-doctors');
        const data = await res.json();
        setIsDoctorAvailable(data.doctorsAvailable);
      } catch (error) {
        console.error('Erro ao verificar disponibilidade de médicos:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível verificar a disponibilidade de médicos',
          variant: 'destructive',
        });
      }
    };

    checkDoctors();
  }, [toast]);

  // Iniciar consulta de emergência
  const startEmergency = async () => {
    setIsLoading(true);
    setCallStatus('iniciando');

    try {
      const symptoms = 'Teste de emergência - dor intensa';
      
      // Chamada direta ao endpoint sem autenticação (para teste)
      const roomData = await fetch('/api/daily-room-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          roomName: `emergency-test-${Date.now().toString()}`,
          expirationMinutes: 60,
          symptoms
        }),
      }).then(res => res.json());

      if (!roomData || !roomData.url) {
        throw new Error('Falha ao criar sala de emergência');
      }

      console.log('Sala criada com sucesso:', roomData);
      setRoomInfo(roomData);
      setRoomUrl(roomData.url);
      setCallStatus('criada');

      toast({
        title: 'Consulta iniciada',
        description: 'Sala de emergência criada com sucesso',
      });

      // Após 1 segundo, iniciar a chamada
      setTimeout(() => {
        joinRoom(roomData.url, roomData.token);
      }, 1000);

    } catch (error) {
      console.error('Erro ao iniciar consulta de emergência:', error);
      setCallStatus('erro');
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a consulta de emergência',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Ingressar na sala usando Daily.co
  const joinRoom = (url: string, token: string) => {
    try {
      setCallStatus('conectando');
      
      const divElement = document.getElementById('video-container');
      if (!divElement) {
        throw new Error('Container de vídeo não encontrado');
      }
      
      // Criar iframe do Daily.co
      const dailyFrame = DailyIframe.createFrame(divElement, {
        showLeaveButton: true,
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
        },
      });

      // Guardar referência global para evitar garbage collection
      window.dailyFrame = dailyFrame;
      
      dailyFrame.on('joining-meeting', () => {
        setCallStatus('entrando');
      });
      
      dailyFrame.on('joined-meeting', () => {
        setCallStatus('conectado');
      });
      
      dailyFrame.on('left-meeting', () => {
        setCallStatus('finalizada');
      });
      
      dailyFrame.on('error', (error) => {
        console.error('Erro na chamada Daily.co:', error);
        setCallStatus('erro');
      });
      
      // Iniciando a chamada de vídeo
      dailyFrame.join({ 
        url, 
        token,
        showFullscreenButton: true
      });
      
    } catch (error) {
      console.error('Erro ao ingressar na sala:', error);
      setCallStatus('erro');
    }
  };

  // Encerrar chamada de emergência
  const endCall = () => {
    try {
      if (window.dailyFrame) {
        window.dailyFrame.leave();
        window.dailyFrame.destroy();
        window.dailyFrame = null;
      }
      setCallStatus('finalizada');
      setRoomInfo(null);
      setRoomUrl('');
    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
    }
  };

  return (
    <div className="container max-w-6xl pt-6 pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Teste de Emergência</h1>
        <p className="text-muted-foreground">
          Página de teste para verificar o funcionamento da consulta de emergência sem autenticação.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status do Teste</CardTitle>
            <CardDescription>
              Verifique a disponibilidade dos médicos e inicie uma consulta de teste
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Médicos online:</p>
                <p className={`text-sm font-bold ${isDoctorAvailable ? 'text-green-500' : 'text-red-500'}`}>
                  {isDoctorAvailable ? 'Disponível' : 'Indisponível'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Status da chamada:</p>
                <p className="text-sm font-bold">
                  {callStatus === 'idle' && 'Aguardando'}
                  {callStatus === 'iniciando' && 'Iniciando chamada...'}
                  {callStatus === 'criada' && 'Sala criada'}
                  {callStatus === 'conectando' && 'Conectando...'}
                  {callStatus === 'entrando' && 'Entrando na sala...'}
                  {callStatus === 'conectado' && 'Conectado'}
                  {callStatus === 'finalizada' && 'Finalizada'}
                  {callStatus === 'erro' && 'Erro na chamada'}
                </p>
              </div>
            </div>

            {roomInfo && (
              <div className="rounded bg-muted p-3 text-xs">
                <p className="font-medium mb-1">Informações da sala:</p>
                <p>URL: {roomUrl}</p>
                <p>Criada em: {new Date().toLocaleTimeString()}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              onClick={startEmergency} 
              disabled={isLoading || callStatus === 'conectado'} 
              variant="default"
              className="flex-1"
            >
              {isLoading ? 'Iniciando...' : 'Iniciar Emergência'}
            </Button>
            
            <Button 
              onClick={endCall} 
              disabled={callStatus !== 'conectado'} 
              variant="destructive"
              className="flex-1"
            >
              Encerrar Chamada
            </Button>
          </CardFooter>
        </Card>

        <Card className="relative">
          <CardHeader>
            <CardTitle>Chamada de Emergência</CardTitle>
            <CardDescription>
              Área de videoconferência de emergência
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-[400px]">
            <div 
              id="video-container" 
              className="absolute inset-0 mt-[80px] rounded-b-lg overflow-hidden bg-muted"
              style={{ height: 'calc(100% - 80px)' }}
            >
              {callStatus === 'idle' && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Inicie uma chamada de emergência</p>
                </div>
              )}
              {(callStatus === 'iniciando' || callStatus === 'criada' || callStatus === 'conectando' || callStatus === 'entrando') && (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                  <p>Conectando à consulta de emergência...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Select
        value={selectedOption ?? ''}
        onValueChange={(value) => setSelectedOption(value)}
      >
        <SelectItem value="opcao1">Opção 1</SelectItem>
        <SelectItem value="opcao2">Opção 2</SelectItem>
        <SelectItem value="opcao3">Opção 3</SelectItem>
      </Select>
      {/* Exemplo de uso seguro: */}
      <div className="mt-4">
        <p>Valor selecionado (string): {selectedOption ?? 'Nenhum'}</p>
      </div>
    </div>
  );
}

// Adicionar declaração para window.dailyFrame
declare global {
  interface Window {
    dailyFrame: any;
  }
}