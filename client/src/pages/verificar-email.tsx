import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function VerificarEmail() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Extrair token da URL
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setError('Token de verificação ausente');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Enviar requisição para verificar o email
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        
        if (response.redirected) {
          // Caso de redirecionamento (sucesso)
          setVerified(true);
          toast({
            title: 'Email verificado com sucesso!',
            description: 'Seu email foi verificado. Agora você já pode fazer login.',
            variant: 'default',
          });
          
          // Redirecionar para a página de login após 3 segundos
          setTimeout(() => {
            setLocation('/auth');
          }, 3000);
        } else {
          // Verificar resposta para erros
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Falha ao verificar email');
          }
          
          // Verificação bem-sucedida sem redirecionamento
          setVerified(true);
        }
      } catch (err) {
        console.error('Erro ao verificar email:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao verificar email');
      } finally {
        setLoading(false);
      }
    }

    verifyEmail();
  }, [token, toast, setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Verificação de Email</CardTitle>
          <CardDescription className="text-center">
            {loading ? 'Verificando seu email...' : verified 
              ? 'Email verificado com sucesso!' 
              : 'Não foi possível verificar seu email.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : verified ? (
            <div className="text-center text-green-600">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-16 w-16 mx-auto my-4 text-green-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
              <p>Sua conta foi verificada com sucesso! Agora você já pode fazer login.</p>
              <p className="text-sm mt-2 text-gray-500">Redirecionando para a página de login...</p>
            </div>
          ) : (
            <div className="text-center text-red-600">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-16 w-16 mx-auto my-4 text-red-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
              <p>{error || 'Link de verificação inválido ou expirado.'}</p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center">
          {!loading && !verified && (
            <div className="space-y-4 w-full">
              <Button 
                className="w-full" 
                onClick={() => setLocation('/auth')}
              >
                Ir para login
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => setLocation('/reenviar-verificacao')}
              >
                Reenviar email de verificação
              </Button>
            </div>
          )}
          
          {!loading && verified && (
            <Button 
              className="w-full" 
              onClick={() => setLocation('/login')}
            >
              Ir para login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}