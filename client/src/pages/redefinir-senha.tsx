import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Esquema de validação para redefinição de senha
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
    .max(100)
    .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
    .regex(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
    .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número' }),
  confirmPassword: z.string()
    .min(8, { message: 'A senha deve ter pelo menos 8 caracteres' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function RedefinirSenha() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Extrair token da URL
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) {
      setError('Token de redefinição ausente');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Enviar requisição para redefinir a senha
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: values.password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Falha ao redefinir senha');
      }
      
      // Redefinição bem-sucedida
      setSuccess(true);
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Sua senha foi atualizada. Agora você já pode fazer login.',
        variant: 'default',
      });
      
      // Redirecionar para a página de login após 3 segundos
      setTimeout(() => {
        setLocation('/auth');
      }, 3000);
      
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao redefinir senha');
      
      toast({
        title: 'Falha ao redefinir senha',
        description: err instanceof Error ? err.message : 'Erro desconhecido ao redefinir senha',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Redefinição de Senha</CardTitle>
            <CardDescription className="text-center">
              Link inválido
            </CardDescription>
          </CardHeader>
          
          <CardContent>
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
              <p>Token de redefinição ausente. Por favor, verifique se você está usando o link correto enviado para seu email.</p>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-center">
            <Button 
              className="w-full" 
              onClick={() => setLocation('/esqueci-senha')}
            >
              Solicitar nova redefinição
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Redefinição de Senha</CardTitle>
          <CardDescription className="text-center">
            {success 
              ? 'Senha redefinida com sucesso!' 
              : 'Crie uma nova senha para sua conta.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {success ? (
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
              <p>Sua senha foi atualizada com sucesso! Agora você já pode fazer login com sua nova senha.</p>
              <p className="text-sm mt-2 text-gray-500">Redirecionando para a página de login...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Digite sua nova senha" 
                          type="password" 
                          autoComplete="new-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Confirme sua nova senha" 
                          type="password" 
                          autoComplete="new-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="mr-2">Atualizando</span>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </>
                    ) : 'Redefinir Senha'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center">
          {success && (
            <Button 
              className="w-full" 
              onClick={() => setLocation('/auth')}
            >
              Ir para login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}