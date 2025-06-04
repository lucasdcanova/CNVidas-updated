import React from "react";
import { Helmet } from "react-helmet";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import QRAuthGenerator from "@/components/user/qr-auth-generator";
import { useAuth } from "@/hooks/use-auth";
import Breadcrumb from "@/components/ui/breadcrumb";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const QRCodePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState("");

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (scannerActive) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: 250 },
        false
      );

      scanner.render(
        async (decodedText) => {
          // Sucesso
          scanner?.clear();
          setScannerActive(false);
          setScanResult(decodedText);
          
          try {
            // Validar o token QR
            const response = await apiRequest("POST", "/api/auth/qr-validate", {
              token: decodedText
            });
            
            if (response.ok) {
              toast({
                title: "Autenticação bem-sucedida",
                description: "QR Code validado com sucesso.",
                variant: "default",
              });
            } else {
              const error = await response.json();
              toast({
                title: "Erro na autenticação",
                description: error.message || "QR Code inválido ou expirado.",
                variant: "destructive",
              });
            }
          } catch (error) {
            toast({
              title: "Erro na autenticação",
              description: "Ocorreu um erro ao validar o QR Code.",
              variant: "destructive",
            });
          }
        },
        (errorMessage) => {
          // Erro
          console.error(errorMessage);
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scannerActive, toast]);

  const startScanner = () => {
    setScannerActive(true);
    setScanResult("");
  };

  const stopScanner = () => {
    setScannerActive(false);
  };

  // Definir quais tabs mostrar com base na função do usuário
  const canGenerateQR = user?.role === 'doctor' || user?.role === 'patient';
  const canScanQR = user?.role === 'admin' || user?.role === 'partner';
  
  // Determinar qual tab deve ser ativa por padrão
  const defaultTab = canGenerateQR ? "generate" : "scan";

  return (
    <DashboardLayout>
      <Helmet>
        <title>QR Code | CN Vidas</title>
        <meta name="description" content="Gerencie QR Codes para autenticação rápida e segura no sistema CN Vidas" />
      </Helmet>
      
      <div className="container px-4 py-6 mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {canScanQR ? "Validação QR Code" : "Meu QR Code"}
          </h1>
        </div>
        
        {canGenerateQR && (
          <Card>
            <CardHeader>
              <CardTitle>QR Code de Autenticação</CardTitle>
              <CardDescription>
                {user?.role === 'doctor' 
                  ? "Use este QR Code para comprovar sua identidade como médico durante consultas e procedimentos." 
                  : "Você pode usar este QR Code para identificação rápida em consultas e procedimentos."}
                Este é seu QR Code permanente e único para identificação no sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <QRAuthGenerator />
              </div>
            </CardContent>
          </Card>
        )}
        
        {canScanQR && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Escanear QR Code</CardTitle>
              <CardDescription>
                {user?.role === 'admin'
                  ? "Como administrador, você pode escanear QR Codes para verificar a identidade dos usuários."
                  : "Como parceiro, você pode escanear QR Codes para verificar a identidade dos pacientes e médicos."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                {!scannerActive && !scanResult && (
                  <Button onClick={startScanner}>
                    <span className="material-icons mr-2">qr_code_scanner</span>
                    Iniciar Scanner
                  </Button>
                )}
                
                {scannerActive && (
                  <>
                    <div id="qr-reader" style={{ width: '100%', maxWidth: '500px' }}></div>
                    <Button variant="outline" onClick={stopScanner}>
                      <span className="material-icons mr-2">cancel</span>
                      Cancelar
                    </Button>
                  </>
                )}
                
                {scanResult && (
                  <div className="mt-4 p-4 border rounded bg-gray-50 w-full">
                    <p className="font-medium">QR Code escaneado:</p>
                    <p className="text-sm text-gray-500 break-all">{scanResult}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QRCodePage;