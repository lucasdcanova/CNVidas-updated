import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DashboardLayout from '@/components/layouts/dashboard-layout';

// Schema de validação
const dependentSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter exatamente 11 dígitos'),
  relationship: z.string().optional(),
  birthDate: z.string().optional(),
});

type DependentForm = z.infer<typeof dependentSchema>;

interface Dependent {
  id: number;
  fullName: string;
  cpf: string;
  relationship?: string;
  birthDate?: string;
  userId: number;
}

export default function DependentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DependentForm>({
    resolver: zodResolver(dependentSchema),
    defaultValues: {
      fullName: '',
      cpf: '',
      relationship: '',
      birthDate: '',
    },
  });

  // Buscar dependentes
  const { data: dependents = [], isLoading } = useQuery({
    queryKey: ['/api/dependents'],
    queryFn: () => apiRequest('GET', '/api/dependents').then(res => res.json()),
  });

  // Mutation para criar dependente
  const createDependentMutation = useMutation({
    mutationFn: (data: DependentForm) => 
      apiRequest('POST', '/api/dependents', data).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: 'Sucesso!',
        description: 'Dependente cadastrado com sucesso.',
      });
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/dependents'] });
    },
    onError: (error: any) => {
      console.error('Erro ao cadastrar dependente:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Erro ao cadastrar dependente. Tente novamente.',
        variant: 'destructive',
      });
    },
  });



  const onSubmit = (data: DependentForm) => {
    // Limpar CPF (remover espaços e caracteres especiais)
    const cleanData = {
      ...data,
      cpf: data.cpf.replace(/\D/g, ''),
    };
    
    console.log('Enviando dados:', cleanData);
    createDependentMutation.mutate(cleanData);
  };



  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Meus Dependentes</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Gerencie até 3 dependentes no seu plano familiar
            </p>
          </div>
        
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                disabled={dependents.length >= 3}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Adicionar Dependente</span>
                <span className="sm:hidden">Adicionar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Dependente</DialogTitle>
              <DialogDescription>
                Cadastre um dependente no seu plano familiar.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  {...form.register('fullName')}
                  placeholder="Digite o nome completo"
                />
                {form.formState.errors.fullName && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  {...form.register('cpf')}
                  placeholder="Digite apenas números"
                  maxLength={11}
                />
                {form.formState.errors.cpf && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.cpf.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="relationship">Parentesco</Label>
                <Select onValueChange={(value) => form.setValue('relationship', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o parentesco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filho">Filho(a)</SelectItem>
                    <SelectItem value="conjuge">Cônjuge</SelectItem>
                    <SelectItem value="pai">Pai</SelectItem>
                    <SelectItem value="mae">Mãe</SelectItem>
                    <SelectItem value="irmao">Irmão(ã)</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  {...form.register('birthDate')}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={createDependentMutation.isPending}
                >
                  {createDependentMutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerta sobre limite */}
      {dependents.length >= 3 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você atingiu o limite máximo de 3 dependentes para planos familiares.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de dependentes */}
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {dependents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum dependente cadastrado
              </h3>
              <p className="text-gray-600 text-center mb-4">
                Adicione dependentes ao seu plano familiar para que eles também possam 
                usar os serviços da CN Vidas.
              </p>
            </CardContent>
          </Card>
        ) : (
          dependents.map((dependent: Dependent) => (
            <Card key={dependent.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{dependent.fullName}</CardTitle>
                    <div className="text-sm text-gray-600 space-y-1 mt-2">
                      <p><strong>CPF:</strong> {formatCpf(dependent.cpf)}</p>
                      {dependent.relationship && (
                        <p><strong>Parentesco:</strong> {dependent.relationship}</p>
                      )}
                      {dependent.birthDate && (
                        <p><strong>Data de nascimento:</strong> {new Date(dependent.birthDate).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    Dependente
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Informações sobre o plano */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">
            Informações do Plano Familiar
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>• Você pode adicionar até 3 dependentes no seu plano familiar</p>
          <p>• Os dependentes têm acesso aos mesmos benefícios do seu plano</p>
          <p>• Dependentes utilizados: {dependents.length}/3</p>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}