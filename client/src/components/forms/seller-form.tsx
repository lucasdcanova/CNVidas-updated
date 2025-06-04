import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { GiftIcon, CheckCircle } from 'lucide-react';

// Esquema do formulário
const sellerFormSchema = z.object({
  sellerName: z
    .string()
    .min(3, { message: 'O nome do vendedor deve ter pelo menos 3 caracteres' })
    .max(100, { message: 'O nome do vendedor não pode ter mais de 100 caracteres' })
});

type SellerFormValues = z.infer<typeof sellerFormSchema>;

interface SellerFormProps {
  subscriptionChangedAt?: string | null;
}

export const SellerForm: React.FC<SellerFormProps> = ({ subscriptionChangedAt }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Inicializa o formulário
  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerFormSchema),
    defaultValues: {
      sellerName: '',
    },
  });

  // Verifica se o card deve ser exibido (sempre exibir até que um vendedor tenha sido registrado)
  const shouldShowCard = () => {
    // Apenas esconder o card quando o usuário já tiver um vendedor registrado
    return !isCompleted;
  };

  // Função para submeter o formulário
  const onSubmit = async (values: SellerFormValues) => {
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest('PUT', '/api/users/seller', values);
      
      if (response.ok) {
        toast({
          title: "Vendedor registrado com sucesso!",
          description: "Obrigado por informar quem te indicou nossos serviços.",
        });
        
        // Atualiza o estado e invalida a query para atualizar os dados do usuário
        setIsCompleted(true);
        queryClient.invalidateQueries({ queryKey: ['/api/users/profile'] });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao registrar o vendedor');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao registrar vendedor",
        description: error.message || "Ocorreu um erro inesperado. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Se não deve mostrar o card, retorna null
  if (!shouldShowCard() || isCompleted) {
    return null;
  }

  return (
    <Card className="mb-6 border-2 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center">
          <GiftIcon className="h-5 w-5 mr-2 text-primary" />
          <CardTitle className="text-lg">Quem te indicou a CN Vidas?</CardTitle>
        </div>
        <CardDescription>
          Nos ajude a reconhecer quem te apresentou nossos serviços
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sellerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do vendedor/consultor</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormDescription>
                    Informe o nome de quem te indicou nossos planos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Enviando...
                </>
              ) : (
                'Registrar Vendedor'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default SellerForm;