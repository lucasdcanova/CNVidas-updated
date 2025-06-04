import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';

import AdminLayout from '@/components/layouts/admin-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';

// Schema para adicionar dependente
const dependentSchema = z.object({
  fullName: z.string().min(1, { message: 'Nome completo é obrigatório' }),
  cpf: z.string().min(11, { message: 'CPF deve ter 11 dígitos' }).max(14),
  birthDate: z.string().optional(),
  relationship: z.string().optional()
});

// Schema para editar dependente (sem CPF, que não pode ser alterado)
const editDependentSchema = z.object({
  fullName: z.string().min(1, { message: 'Nome completo é obrigatório' }),
  birthDate: z.string().optional(),
  relationship: z.string().optional()
});

type DependentFormValues = z.infer<typeof dependentSchema>;
type EditDependentFormValues = z.infer<typeof editDependentSchema>;

const UserDependentsPage: React.FC = () => {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Extrair o userId da URL
  const userId = parseInt(location.split('/').pop() || '');

  // Estado para diálogos
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedDependent, setSelectedDependent] = useState<any>(null);

  // Buscar informações do usuário (usando a rota admin específica)
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/admin/user-for-dependents', userId],
    queryFn: async () => {
      console.log("Enviando requisição para buscar usuário (admin):", userId);
      const response = await apiRequest('GET', `/api/admin/user-for-dependents/${userId}`);
      if (!response.ok) {
        throw new Error(`Erro ao buscar usuário: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Dados do usuário recebidos:", data);
      return data;
    },
    enabled: !isNaN(userId)
  });

  // Buscar dependentes do usuário
  const { data: dependents, isLoading: isLoadingDependents } = useQuery({
    queryKey: ['/api/admin/user-dependents', userId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/user-dependents/${userId}`);
      return response.json();
    },
    enabled: !isNaN(userId)
  });

  // Formulário para adicionar dependente
  const addForm = useForm<DependentFormValues>({
    resolver: zodResolver(dependentSchema),
    defaultValues: {
      fullName: '',
      cpf: '',
      birthDate: '',
      relationship: ''
    }
  });

  // Formulário para editar dependente
  const editForm = useForm<EditDependentFormValues>({
    resolver: zodResolver(editDependentSchema),
    defaultValues: {
      fullName: '',
      birthDate: '',
      relationship: ''
    }
  });

  // Mutation para adicionar dependente
  const addDependentMutation = useMutation({
    mutationFn: async (data: DependentFormValues) => {
      const response = await apiRequest('POST', `/api/admin/user-dependents/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-dependents', userId] });
      setShowAddDialog(false);
      addForm.reset();
      toast({
        title: 'Dependente adicionado',
        description: 'O dependente foi adicionado com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao adicionar dependente',
        description: error.message || 'Ocorreu um erro ao adicionar o dependente',
        variant: 'destructive',
      });
    }
  });

  // Mutation para editar dependente
  const editDependentMutation = useMutation({
    mutationFn: async (data: EditDependentFormValues & { id: number }) => {
      const { id, ...formData } = data;
      const response = await apiRequest('PUT', `/api/admin/user-dependents/${id}`, formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-dependents', userId] });
      setShowEditDialog(false);
      editForm.reset();
      toast({
        title: 'Dependente atualizado',
        description: 'O dependente foi atualizado com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar dependente',
        description: error.message || 'Ocorreu um erro ao atualizar o dependente',
        variant: 'destructive',
      });
    }
  });

  // Mutation para remover dependente
  const deleteDependentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/admin/user-dependents/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-dependents', userId] });
      toast({
        title: 'Dependente removido',
        description: 'O dependente foi removido com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover dependente',
        description: error.message || 'Ocorreu um erro ao remover o dependente',
        variant: 'destructive',
      });
    }
  });

  // Formatar CPF
  const formatCpf = (cpf: string) => {
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) return cpf;
    return cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Manipulador para adicionar dependente
  const handleAddDependent = (data: DependentFormValues) => {
    // Formatar CPF antes de enviar
    const formattedData = {
      ...data,
      cpf: data.cpf.replace(/\D/g, '')
    };
    addDependentMutation.mutate(formattedData);
  };

  // Manipulador para editar dependente
  const handleEditDependent = (data: EditDependentFormValues) => {
    if (!selectedDependent) return;
    editDependentMutation.mutate({
      id: selectedDependent.id,
      ...data
    });
  };

  // Manipulador para remover dependente
  const handleDeleteDependent = (id: number) => {
    deleteDependentMutation.mutate(id);
  };

  // Manipulador para abrir diálogo de edição
  const handleEditDialog = (dependent: any) => {
    setSelectedDependent(dependent);
    editForm.reset({
      fullName: dependent.fullName,
      birthDate: dependent.birthDate || '',
      relationship: dependent.relationship || ''
    });
    setShowEditDialog(true);
  };

  // Formatação de CPF no formulário
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    let cpf = value;
    if (value.length > 3) cpf = value.replace(/^(\d{3})/, '$1.');
    if (value.length > 6) cpf = cpf.replace(/^(\d{3})\.(\d{3})/, '$1.$2.');
    if (value.length > 9) cpf = cpf.replace(/^(\d{3})\.(\d{3})\.(\d{3})/, '$1.$2.$3-');
    
    addForm.setValue('cpf', cpf);
  };

  // Verificação do plano do usuário
  const isFamilyPlan = user?.isFamilyPlan || (user?.subscriptionPlan && typeof user.subscriptionPlan === 'string' && 
    user.subscriptionPlan.includes('family'));

  if (isNaN(userId)) {
    return (
      <AdminLayout>
        <div className="container py-6">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">ID de usuário inválido</h1>
            <p className="mt-2">O ID de usuário especificado não é válido.</p>
            <Button className="mt-4" asChild>
              <Link href="/admin/users">Voltar para lista de usuários</Link>
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gerenciamento de Dependentes">
      <div className="container py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Usuários
            </Link>
          </Button>
        </div>

        {isLoadingUser ? (
          <div className="flex justify-center my-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Informações do Usuário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome</p>
                    <p>{user?.fullName || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p>{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Plano</p>
                    <p>{user?.subscriptionPlan || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status do Plano</p>
                    <p>{user?.subscriptionStatus || 'Não informado'}</p>
                  </div>
                </div>
              </CardContent>
              {!isFamilyPlan && (
                <CardFooter className="bg-amber-50 dark:bg-amber-950/30 border-t">
                  <p className="text-amber-600 dark:text-amber-400 text-sm">
                    Atenção: Este usuário não possui um plano familiar. 
                    Como administrador, você ainda pode adicionar dependentes, mas o usuário não terá acesso a esta funcionalidade.
                  </p>
                </CardFooter>
              )}
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Dependentes</CardTitle>
                  <CardDescription>
                    Gerenciamento de dependentes do usuário
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Dependente
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingDependents ? (
                  <div className="flex justify-center my-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : dependents && dependents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Relação</TableHead>
                        <TableHead>Data de Nascimento</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dependents.map((dependent: any) => (
                        <TableRow key={dependent.id}>
                          <TableCell>{dependent.fullName}</TableCell>
                          <TableCell>{formatCpf(dependent.cpf)}</TableCell>
                          <TableCell>{dependent.relationship || 'Não informado'}</TableCell>
                          <TableCell>
                            {dependent.birthDate 
                              ? format(new Date(dependent.birthDate), 'dd/MM/yyyy') 
                              : 'Não informada'}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditDialog(dependent)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover Dependente</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover este dependente? 
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteDependent(dependent.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>Nenhum dependente cadastrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal para adicionar dependente */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Dependente</DialogTitle>
              <DialogDescription>
                Adicione um novo dependente para este usuário
              </DialogDescription>
            </DialogHeader>

            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(handleAddDependent)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo do dependente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00" 
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleCPFChange(e);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        CPF do dependente (apenas números)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relação</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Filho(a), Cônjuge, etc" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddDialog(false);
                      addForm.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addDependentMutation.isPending}
                  >
                    {addDependentMutation.isPending ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Modal para editar dependente */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Dependente</DialogTitle>
              <DialogDescription>
                Edite as informações do dependente
              </DialogDescription>
            </DialogHeader>

            {selectedDependent && (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditDependent)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo do dependente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <p className="text-sm font-medium">CPF</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCpf(selectedDependent.cpf)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (O CPF não pode ser alterado)
                    </p>
                  </div>

                  <FormField
                    control={editForm.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="relationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relação</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Filho(a), Cônjuge, etc" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowEditDialog(false);
                        editForm.reset();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit"
                      disabled={editDependentMutation.isPending}
                    >
                      {editDependentMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default UserDependentsPage;