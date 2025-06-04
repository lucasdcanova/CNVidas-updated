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

// Esquema de validação para o email
const emailSchema = z.object({
  email: z.string()
    .email({ message: 'Por favor, insira um endereço de email válido' })
    .min(1, { message: 'O email é obrigatório' }),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export default function EsqueciSenha() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: EmailFormValues) {
    try {
      setLoading(true);
      
      // Enviar requisição para solicitar redefinição de senha
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Falha ao solicitar redefinição de senha');
      }
      
      // Solicitação bem-sucedida
      setSuccess(true);
      toast({
        title: 'Solicitação enviada',
        description: 'Enviamos um link de redefinição de senha para seu email.',
        variant: 'default',
      });
      
    } catch (err) {
      console.error('Erro ao solicitar redefinição de senha:', err);
      
      toast({
        title: 'Falha ao enviar solicitação',
        description: err instanceof Error ? err.message : 'Erro desconhecido ao solicitar redefinição de senha',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Esqueci Minha Senha</CardTitle>
          <CardDescription className="text-center">
            {success 
              ? 'Email de recuperação enviado!' 
              : 'Informe seu email para receber um link de redefinição de senha'}
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
              <p>Enviamos um link de redefinição de senha para o email informado.</p>
              <p className="mt-2">Verifique sua caixa de entrada e a pasta de spam.</p>
              <p className="mt-4 text-sm text-gray-500">O link expirará em 1 hora.</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="seu-email@exemplo.com" 
                          type="email" 
                          autoComplete="email"
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
                        <span className="mr-2">Enviando</span>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </>
                    ) : 'Solicitar Redefinição de Senha'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setLocation('/auth')}
          >
            Voltar para Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}