import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomDailyVideoCall from '@/components/telemedicine/CustomDailyVideoCall';
import HeadlessDailyVideoCall from '@/components/telemedicine/HeadlessDailyVideoCall';
import MinimalistVideoCall from '@/components/telemedicine/MinimalistVideoCall';

export default function TestHeadlessDaily() {
  const [roomUrl, setRoomUrl] = useState('');
  const [token, setToken] = useState('');
  const [showCall, setShowCall] = useState(false);

  const handleStartCall = () => {
    if (roomUrl) {
      setShowCall(true);
    }
  };

  const handleEndCall = () => {
    setShowCall(false);
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle>Teste de Video Chamada Headless</CardTitle>
          <CardDescription>
            Compare diferentes implementações do Daily.co
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showCall ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="roomUrl">URL da Sala Daily.co</Label>
                <Input
                  id="roomUrl"
                  placeholder="https://cnvidas.daily.co/room-name"
                  value={roomUrl}
                  onChange={(e) => setRoomUrl(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="token">Token (opcional)</Label>
                <Input
                  id="token"
                  placeholder="Token de autenticação"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
              <Button onClick={handleStartCall} disabled={!roomUrl}>
                Iniciar Chamada
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="headless" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="headless">Headless Completo</TabsTrigger>
                <TabsTrigger value="custom">Custom Simples</TabsTrigger>
                <TabsTrigger value="original">Original (iframe)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="headless" className="mt-4">
                <div className="relative w-full h-[600px] bg-black rounded-xl overflow-hidden">
                  <HeadlessDailyVideoCall
                    roomUrl={roomUrl}
                    token={token}
                    onLeaveCall={handleEndCall}
                  />
                </div>
                <div className="mt-4 p-4 bg-zinc-100 rounded-lg">
                  <h3 className="font-semibold mb-2">HeadlessDailyVideoCall</h3>
                  <ul className="text-sm text-zinc-600 space-y-1">
                    <li>✓ Controle total sobre elementos de vídeo</li>
                    <li>✓ Suporte para múltiplos participantes</li>
                    <li>✓ Interface estilo FaceTime</li>
                    <li>✓ Indicadores de áudio/vídeo desligados</li>
                    <li>✓ Gerenciamento avançado de tracks</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="custom" className="mt-4">
                <div className="relative w-full h-[600px] bg-black rounded-xl overflow-hidden">
                  <CustomDailyVideoCall
                    roomUrl={roomUrl}
                    token={token}
                    onLeaveCall={handleEndCall}
                  />
                </div>
                <div className="mt-4 p-4 bg-zinc-100 rounded-lg">
                  <h3 className="font-semibold mb-2">CustomDailyVideoCall</h3>
                  <ul className="text-sm text-zinc-600 space-y-1">
                    <li>✓ Implementação básica sem iframe</li>
                    <li>✓ Layout PIP fixo</li>
                    <li>✓ 3 botões de controle</li>
                    <li>✓ Suporte para 2 participantes</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="original" className="mt-4">
                <div className="relative w-full h-[600px] bg-black rounded-xl overflow-hidden">
                  <MinimalistVideoCall
                    roomUrl={roomUrl}
                    token={token}
                    onLeaveCall={handleEndCall}
                  />
                </div>
                <div className="mt-4 p-4 bg-zinc-100 rounded-lg">
                  <h3 className="font-semibold mb-2">MinimalistVideoCall (Original)</h3>
                  <ul className="text-sm text-zinc-600 space-y-1">
                    <li>• Usa iframe do Daily.co</li>
                    <li>• Interface pré-construída</li>
                    <li>• Menos controle sobre UI</li>
                    <li>• Configuração mais simples</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}