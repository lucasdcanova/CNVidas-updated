import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Camera, CheckCircle, XCircle, User } from 'lucide-react';
import DashboardLayout from '@/components/layouts/dashboard-layout';

export default function PartnerVerification() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const startScanning = async () => {
    try {
      // Check for camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      
      setIsScanning(true);
      
      // Initialize QR scanner (you would integrate with a QR scanning library here)
      toast({
        title: 'Scanner Ativo',
        description: 'Posicione o QR Code na frente da câmera'
      });
    } catch (error) {
      toast({
        title: 'Erro de Câmera',
        description: 'Não foi possível acessar a câmera. Verifique as permissões.',
        variant: 'destructive'
      });
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const verifyQRCode = async (code: string) => {
    setLoading(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/users/verify-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: code })
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setVerificationResult({
          valid: true,
          user: data.user,
          plan: data.user.subscriptionPlan || 'free',
          expiresAt: null
        });
        
        toast({
          title: 'Verificação Bem-sucedida',
          description: `Usuário ${data.user.fullName} verificado com sucesso`
        });
      } else {
        setVerificationResult({
          valid: false,
          error: data.error || 'QR Code inválido ou expirado'
        });
        
        toast({
          title: 'Verificação Falhou',
          description: data.error || 'QR Code inválido ou expirado',
          variant: 'destructive'
        });
      }
    } catch (error) {
      setVerificationResult({
        valid: false,
        error: 'Erro de conexão'
      });
      
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o QR Code',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerification = () => {
    if (!manualCode.trim()) {
      toast({
        title: 'Código Necessário',
        description: 'Por favor, insira o código QR para verificação',
        variant: 'destructive'
      });
      return;
    }
    
    verifyQRCode(manualCode.trim());
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-4 md:py-8 px-4 max-w-6xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
          <QrCode className="h-6 w-6 md:h-8 md:w-8" />
          Verificação de Usuários
        </h1>
        
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Scanner Section */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Camera className="h-4 w-4 md:h-5 md:w-5" />
              Scanner de QR Code
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Use a câmera para escanear o QR Code do cartão virtual do usuário
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {isScanning ? (
              <div className="space-y-4">
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center p-4">
                    <Camera className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 text-sm md:text-base">Câmera ativa</p>
                    <p className="text-xs md:text-sm text-gray-500">Posicione o QR Code aqui</p>
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  onClick={stopScanning}
                  className="w-full"
                >
                  Parar Scanner
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border">
                  <div className="text-center p-4">
                    <QrCode className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 text-sm md:text-base">Scanner Inativo</p>
                  </div>
                </div>
                
                <Button 
                  onClick={startScanning}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Iniciar Scanner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Input Section */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-base md:text-lg">Verificação Manual</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Digite o código QR manualmente se o scanner não estiver funcionando
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-code">Código QR</Label>
              <Input
                id="manual-code"
                placeholder="Digite ou cole o código aqui..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleManualVerification}
              disabled={loading || !manualCode.trim()}
              className="w-full"
            >
              {loading ? 'Verificando...' : 'Verificar Código'}
            </Button>
          </CardContent>
        </Card>
      </div>

        {/* Verification Result */}
        {verificationResult && (
          <Card className="mt-4 md:mt-6 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verificationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado da Verificação
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            {verificationResult.valid ? (
              <Alert className="border-green-200 bg-green-50">
                <User className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="text-sm md:text-base"><strong>Usuário Verificado:</strong> {verificationResult.user.fullName}</p>
                    <p className="text-sm md:text-base"><strong>Plano:</strong> {verificationResult.plan}</p>
                    <p className="text-sm md:text-base"><strong>Email:</strong> {verificationResult.user.email}</p>
                    {verificationResult.user.cpf && (
                      <p className="text-sm md:text-base"><strong>CPF:</strong> {verificationResult.user.cpf}</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Verificação Falhou:</strong> {verificationResult.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

        {/* Instructions */}
        <Card className="mt-4 md:mt-6 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Como Usar</CardTitle>
          </CardHeader>
          
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-xs md:text-sm">
              <li>Solicite ao cliente para mostrar seu cartão virtual CNVidas</li>
              <li>Use o scanner para ler o QR Code ou digite o código manualmente</li>
              <li>Aguarde a verificação e confirme os dados do usuário</li>
              <li>Proceda com o atendimento após verificação bem-sucedida</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}