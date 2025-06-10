import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';
import { generateQrToken } from '@/lib/api';

interface QRAuthToken {
  qrCode: string;
}

const QRAuthGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrToken, setQrToken] = useState<QRAuthToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Gerar um novo token QR code (agora permanente)
  const generateQRCode = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await generateQrToken();
      setQrToken(data);
      
      // Não precisamos mais calcular tempo de expiração,
      // pois o QR code é permanente. Definimos um valor
      // alto apenas para manter compatibilidade com o resto do código
      setTimeLeft(3153600000); // 100 anos em segundos
      
    } catch (error) {
      toast({
        title: "Erro ao gerar QR Code",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Não precisamos mais do efeito para atualizar o contador de tempo

  // Gerar QR code quando componente é montado
  useEffect(() => {
    if (user) {
      generateQRCode();
    }
  }, [user]);

  if (loading && !qrToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Código de Autenticação</CardTitle>
          <CardDescription>
            Aguarde enquanto geramos seu código QR
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Código de Autenticação</CardTitle>
            <CardDescription>
              Apresente este QR Code ao parceiro para validar sua identidade
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Permanente
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center py-4">
        {qrToken && qrToken.qrCode ? (
          <div className="p-4 bg-white rounded-lg">
            <QRCode 
              value={qrToken.qrCode} 
              size={200}
              level="H"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center p-10 text-center">
            <p className="text-muted-foreground mb-4">
              O código QR não está disponível.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button 
          onClick={generateQRCode} 
          disabled={loading}
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Mostrar Meu QR Code
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default QRAuthGenerator;