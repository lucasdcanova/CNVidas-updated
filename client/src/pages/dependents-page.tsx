import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CalendarIcon, UserX, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import type { AxiosError } from 'axios';

// Função para formatar CPF (000.000.000-00)
const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  } else if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  } else {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
};
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';

// Schema para validação do formulário
const dependentFormSchema = z.object({
  fullName: z.string().min(3, "Nome completo deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  relationship: z.string().optional(),
  birthDate: z.date().optional(),
});

type DependentFormValues = z.infer<typeof dependentFormSchema>;

export default function DependentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();


  // Consulta para buscar dependentes
  const { data: dependents = [], isLoading, error, isError } = useQuery<any[]>({
    queryKey: ['/api/dependents'],
    retry: 1,
  });

  // Verificar se o usuário tem plano familiar
  useEffect(() => {
    if (isError && (error as AxiosError)?.response?.status === 403) {
      toast({
        title: "Acesso restrito",
        description: "Esta funcionalidade está disponível apenas para planos familiares.",
        variant: "destructive",
      });
      navigate('/subscription');
    }
  }, [isError, error, toast, navigate]);

  // Mutação para adicionar dependente
  const addDependentMutation = useMutation({
    mutationFn: (values: DependentFormValues) => {
      const payload = {
        fullName: values.fullName,
        cpf: values.cpf.replace(/\D/g, ''), // Remove caracteres não numéricos
        relationship: values.relationship || null,
        birthDate: values.birthDate ? format(values.birthDate, 'yyyy-MM-dd') : null,
      };
      console.log('Enviando dados do dependente:', payload);
      return apiRequest('POST', '/api/dependents', payload);
    },
    onSuccess: () => {
      toast({
        title: "Dependente adicionado",
        description: "O dependente foi cadastrado com sucesso."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dependents'] });
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || "Erro ao cadastrar dependente";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });



  // Formulário para adicionar dependente
  const form = useForm<DependentFormValues>({
    resolver: zodResolver(dependentFormSchema),
    defaultValues: {
      fullName: "",
      cpf: "",
      relationship: "",
    },
  });

  const onSubmit = (values: DependentFormValues) => {
    addDependentMutation.mutate(values);
  };

  // Formatação do CPF durante digitação
  const handleCPFChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const formattedCPF = formatCPF(value);
    form.setValue("cpf", formattedCPF);
  };



  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Gerenciamento de Dependentes</h1>
        
        <Tabs defaultValue={dependents.length === 0 && !isLoading ? "add" : "list"}>
          <TabsList className="mb-6">
            <TabsTrigger value="list">Meus Dependentes</TabsTrigger>
            <TabsTrigger value="add">Adicionar Dependente</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Dependentes Cadastrados</CardTitle>
                <CardDescription>
                  Visualize e gerencie os dependentes vinculados ao seu plano familiar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center my-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : dependents.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>Nenhum dependente cadastrado.</p>
                    <p className="mt-2">Você pode cadastrar até 3 dependentes no seu plano familiar.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dependents.map((dependent: any) => (
                      <Card key={dependent.id} className="border border-muted">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{dependent.fullName}</CardTitle>
                              <CardDescription>CPF: {formatCPF(dependent.cpf)}</CardDescription>
                            </div>
                            <div className="flex space-x-1">
                              <Badge variant="secondary">
                                Dependente
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {dependent.relationship && (
                              <div>
                                <span className="text-muted-foreground">Relação: </span>
                                <Badge variant="outline">{dependent.relationship}</Badge>
                              </div>
                            )}
                            {dependent.birthDate && (
                              <div>
                                <span className="text-muted-foreground">Data de Nascimento: </span>
                                <span>{format(new Date(dependent.birthDate), 'dd/MM/yyyy')}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <div className="w-full text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Planos familiares permitem até 3 dependentes. 
                    {dependents.length > 0 && ` Você possui ${dependents.length} de 3 dependentes cadastrados.`}
                  </p>
                  {dependents.length > 0 && (
                    <p className="text-xs text-amber-600">
                      Para remover dependentes, entre em contato com o suporte.
                    </p>
                  )}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Dependente</CardTitle>
                <CardDescription>
                  Cadastre um novo dependente vinculado ao seu plano familiar.
                  {dependents.length >= 3 && (
                    <div className="mt-2 text-destructive">
                      Você já atingiu o limite de 3 dependentes para o seu plano.
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dependents.length >= 3 ? (
                  <div className="text-center py-4">
                    <UserX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Limite de dependentes atingido. Para adicionar um novo dependente, você precisa remover um dos dependentes existentes.
                    </p>
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                            <h4 className="font-semibold text-amber-800 flex items-center">
                              <span className="mr-2">⚠️</span> Importante
                            </h4>
                            <p className="text-sm text-amber-700 mt-1">
                              O CPF cadastrado não poderá ser alterado posteriormente. 
                              Clique aqui para mais informações.
                            </p>
                          </div>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Informação Importante</AlertDialogTitle>
                            <AlertDialogDescription>
                              Por motivos de segurança e integridade dos dados, após o cadastro 
                              do dependente, o CPF não poderá ser alterado. Certifique-se de inserir 
                              o CPF correto.
                              <br /><br />
                              Caso precise alterar informações do dependente, entre em contato 
                              com o suporte.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogAction>Entendi</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <FormField
                        control={form.control}
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
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="000.000.000-00" 
                                {...field}
                                onChange={handleCPFChange}
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
                        control={form.control}
                        name="relationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relação</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a relação com o dependente" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                                <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                                <SelectItem value="Pai/Mãe">Pai/Mãe</SelectItem>
                                <SelectItem value="Outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Relação do dependente com o titular
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="birthDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Data de Nascimento</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                  >
                                    {field.value ? (
                                      format(field.value, "dd/MM/yyyy")
                                    ) : (
                                      <span>Selecione a data</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  locale={ptBR}
                                  disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Data de nascimento do dependente (opcional)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={addDependentMutation.isPending}
                      >
                        {addDependentMutation.isPending ? (
                          <>
                            <span className="mr-2 animate-spin">⏳</span>
                            Processando...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Adicionar Dependente
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </DashboardLayout>
  );
}