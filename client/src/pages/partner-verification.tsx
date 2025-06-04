import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Camera, QrCode } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { verifyQrToken } from "@/lib/api";

interface VerificationResult {
  valid: boolean;
  user?: {
    name: string;
    email: string;
    status: string;
    subscriptionStatus: string;
  };
  message: string;
}

export default function PartnerVerification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup scanner when component unmounts
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  const startScanner = () => {
    setScanning(true);
    setResult(null);

    if (scannerContainerRef.current) {
      // Clear previous scanner if exists
      scannerContainerRef.current.innerHTML = '';
      
      // Create scanner with proper configuration
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader", 
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
        },
        /* verbose= */ false
      );

      // Start scanner with callbacks
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    // Stop scanning once we get a result
    stopScanner();
    setVerifying(true);

    try {
      // Verificar o QR code com o servidor
      const data = await verifyQrToken(decodedText);
      setResult(data);
      
      toast({
        title: data.valid ? "Verificação bem-sucedida" : "Verificação falhou",
        description: data.message,
        variant: data.valid ? "default" : "destructive",
      });
    } catch (error) {
      setResult({
        valid: false,
        message: error instanceof Error ? error.message : "Erro ao verificar o QR code",
      });
      
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar o QR code. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const onScanFailure = (error: string) => {
    // Just log error, don't show to user unless scanning fails completely
    console.error("QR scan error:", error);
  };

  if (!user || user.role !== "partner") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center">
            Esta página é exclusiva para empresas parceiras.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verificação de Usuário</h1>
          <p className="text-muted-foreground">
            Verifique se um usuário está cadastrado e ativo na plataforma
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scanner de QR Code</CardTitle>
            <CardDescription>
              Escaneie o QR Code gerado pelo usuário para verificar sua autenticidade
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verifying ? (
              <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p>Verificando o código QR...</p>
              </div>
            ) : result ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                {result.valid ? (
                  <>
                    <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <Check className="h-12 w-12 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-600 mb-2">Usuário Válido</h3>
                    <p className="mb-4">{result.message}</p>
                    {result.user && (
                      <div className="bg-muted p-4 rounded-lg w-full max-w-md mb-6">
                        <p className="font-medium text-lg">{result.user.name}</p>
                        <p className="text-sm text-muted-foreground">{result.user.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            result.user.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {result.user.status === 'active' ? 'Ativo' : 'Pendente'}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            result.user.subscriptionStatus === 'active' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {result.user.subscriptionStatus === 'active' 
                              ? 'Assinatura Ativa' 
                              : 'Sem Assinatura'}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-24 w-24 rounded-full bg-red-100 flex items-center justify-center mb-4">
                      <X className="h-12 w-12 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-red-600 mb-2">Verificação Falhou</h3>
                    <p>{result.message}</p>
                  </>
                )}
              </div>
            ) : scanning ? (
              <div className="flex flex-col items-center">
                <div ref={scannerContainerRef} id="qr-reader" className="w-full max-w-[400px]"></div>
                <p className="text-sm text-muted-foreground mt-4">
                  Posicione o QR Code do usuário no centro da câmera para escaneá-lo.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Scanner Desativado</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Clique no botão abaixo para ativar a câmera e começar a escanear o QR Code do usuário.
                </p>
                <Button onClick={startScanner}>
                  Iniciar Scanner de QR Code
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            {scanning ? (
              <Button variant="outline" onClick={stopScanner}>
                Cancelar Scanner
              </Button>
            ) : result ? (
              <Button onClick={startScanner}>
                Escanear Outro QR Code
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}