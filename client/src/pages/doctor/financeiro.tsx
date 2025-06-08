import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DoctorProfile {
  id: number;
  consultationFee: number;
  pixKeyType?: string;
  pixKey?: string;
  bankName?: string;
  accountType?: string;
  pix_key?: string;
  pix_key_type?: string;
  bank_name?: string;
  account_type?: string;
}

interface Payment {
  id: number;
  amount: number;
  status: string;
  description: string;
  createdAt: string;
}

// Schema para o formulário de informações de pagamento (PIX)
const paymentInfoSchema = z.object({
  pixKeyType: z.string().min(1, "Tipo de chave PIX obrigatório"),
  pixKey: z.string().min(1, "Chave PIX obrigatória"),
  bankName: z.string().min(1, "Nome do banco obrigatório"),
  accountType: z.string().min(1, "Tipo de conta obrigatório"),
});

type PaymentInfoFormValues = z.infer<typeof paymentInfoSchema>;

export default function FinanceiroPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  
  // Buscar dados do perfil do médico
  const { data: doctor, isLoading: isLoadingDoctor } = useQuery<DoctorProfile | undefined>({
    queryKey: ['/api/doctors/profile'],
    enabled: true,
  });

  // Buscar pagamentos do médico
  const { data: paymentsResponse, isLoading: isLoadingPayments } = useQuery<{payments: Payment[], total: number} | undefined>({
    queryKey: ['/api/doctors/payments'],
    enabled: true,
  });
  
  // Extrair array de pagamentos da resposta
  const payments = paymentsResponse?.payments || [];

  // Formulário para informações de pagamento
  const form = useForm<PaymentInfoFormValues>({
    resolver: zodResolver(paymentInfoSchema),
    defaultValues: {
      pixKeyType: "",
      pixKey: "",
      bankName: "",
      accountType: "",
    },
  });

  // Atualizar valores do formulário quando os dados do médico são carregados
  useEffect(() => {
    if (doctor) {
      console.log("Dados do médico recebidos:", doctor);
      console.log("Chave PIX:", doctor.pixKey);
      console.log("Tipo de Chave PIX:", doctor.pixKeyType);
      console.log("Banco:", doctor.bankName);
      console.log("Tipo de Conta:", doctor.accountType);
      console.log("Chave PIX (camel):", doctor.pixKey);
      console.log("Tipo de Chave PIX (camel):", doctor.pixKeyType);
      
      // Buscar dados diretamente do banco para debug
      fetch('/api/save-pix-info-debug?doctorId=' + doctor.id)
        .then(response => response.json())
        .then(data => {
          console.log("Dados diretos do banco:", data);
          
          // Forçar atualização do formulário com dados do banco
          form.reset({
            pixKeyType: data.pixKeyType || "",
            pixKey: data.pixKey || "",
            bankName: data.bankName || "",
            accountType: data.accountType || "",
          });
        })
        .catch(error => {
          console.error("Erro ao buscar dados PIX:", error);
        });
    }
  }, [doctor, form]);

  // Mutação para atualizar informações de pagamento (usando a nova rota simplificada)
  const updatePaymentInfo = useMutation({
    mutationFn: (data: PaymentInfoFormValues) => 
      apiRequest("PUT", "/api/save-pix-info", data),
    onSuccess: () => {
      toast({
        title: "Informações de pagamento atualizadas",
        description: "Suas informações de pagamento foram atualizadas com sucesso.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar informações",
        description: "Ocorreu um erro ao atualizar suas informações de pagamento. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro detalhado:", error);
    },
  });

  const onSubmit = (data: PaymentInfoFormValues) => {
    // Adicionar o ID do médico ao enviar os dados
    if (doctor?.id) {
      const dataWithId = {
        ...data,
        doctorId: doctor.id
      };
      updatePaymentInfo.mutate(dataWithId);
    } else {
      toast({
        title: "Erro ao atualizar informações",
        description: "Não foi possível identificar seu cadastro de médico. Tente fazer login novamente.",
        variant: "destructive",
      });
    }
  };

  // Calcular o total de pagamentos pendentes
  const totalPendingAmount = payments.filter((p: { status: string }) => p.status === "pending")
    .reduce((sum: number, payment: { amount: number }) => sum + payment.amount, 0);

  // Calcular o total de pagamentos realizados
  const totalPaidAmount = payments.filter((p: { status: string }) => p.status === "paid")
    .reduce((sum: number, payment: { amount: number }) => sum + payment.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total a Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingPayments ? (
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  formatCurrency(totalPendingAmount)
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Já Recebido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingPayments ? (
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  formatCurrency(totalPaidAmount)
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Valor por Consulta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingDoctor ? (
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(doctor?.consultationFee || 0)
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="payment-info" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-3">
            <TabsTrigger value="payment-info" className="text-xs md:text-sm px-1 md:px-3 py-1.5 whitespace-normal h-auto md:h-10 text-center">Informações de Pagamento</TabsTrigger>
            <TabsTrigger value="payment-rules" className="text-xs md:text-sm px-1 md:px-3 py-1.5 whitespace-normal h-auto md:h-10 text-center">Regras de Pagamento</TabsTrigger>
            <TabsTrigger value="payment-history" className="text-xs md:text-sm px-1 md:px-3 py-1.5 whitespace-normal h-auto md:h-10 text-center">Extrato de Pagamentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="payment-info" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações de Pagamento PIX</CardTitle>
                <CardDescription>
                  Configure suas informações para receber pagamentos via PIX
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDoctor ? (
                  <div className="space-y-4">
                    <div className="h-10 bg-muted animate-pulse rounded" />
                    <div className="h-10 bg-muted animate-pulse rounded" />
                    <div className="h-10 bg-muted animate-pulse rounded" />
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="pixKeyType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Chave PIX</FormLabel>
                            <Select
                              disabled={!isEditing}
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo de chave PIX" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cpf">CPF</SelectItem>
                                <SelectItem value="email">E-mail</SelectItem>
                                <SelectItem value="telefone">Telefone</SelectItem>
                                <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="pixKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chave PIX</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Digite sua chave PIX" 
                                {...field} 
                                disabled={!isEditing}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Banco</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Nome do banco" 
                                {...field} 
                                disabled={!isEditing}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="accountType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Conta</FormLabel>
                            <Select
                              disabled={!isEditing}
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo de conta" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="corrente">Conta Corrente</SelectItem>
                                <SelectItem value="poupanca">Conta Poupança</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {isEditing ? (
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false);
                              form.reset({
                                pixKeyType: doctor?.pixKeyType || "",
                                pixKey: doctor?.pixKey || "",
                                bankName: doctor?.bankName || "",
                                accountType: doctor?.accountType || "",
                              });
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="submit"
                            disabled={updatePaymentInfo.isPending}
                          >
                            {updatePaymentInfo.isPending ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() => setIsEditing(true)}
                          >
                            Editar Informações
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
            

          </TabsContent>
          
          <TabsContent value="payment-rules" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Regras de Pagamento</CardTitle>
                <CardDescription>
                  Entenda como funcionam os pagamentos de consultas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Consultas de Emergência</h3>
                  <p className="text-muted-foreground">
                    Para consultas de emergência que durarem mais de 5 minutos, 
                    você receberá R$50,00 por atendimento.
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-medium mb-2">Consultas Agendadas</h3>
                  <p className="text-muted-foreground mb-2">
                    Com base no seu valor de consulta de {formatCurrency(doctor?.consultationFee || 0)}, você receberá:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    <li>
                      <strong>Plano Gratuito:</strong> 100% do valor = {formatCurrency(doctor?.consultationFee || 0)}
                      <div className="text-xs text-slate-500 mt-1">
                        Cálculo: {formatCurrency(doctor?.consultationFee || 0)} × 100% = {formatCurrency(doctor?.consultationFee || 0)}
                      </div>
                    </li>
                    <li>
                      <strong>Plano Basic:</strong> 70% do valor = {formatCurrency((doctor?.consultationFee || 0) * 0.7)}
                      <div className="text-xs text-slate-500 mt-1">
                        Cálculo: {formatCurrency(doctor?.consultationFee || 0)} × 70% = {formatCurrency((doctor?.consultationFee || 0) * 0.7)}
                      </div>
                    </li>
                    <li>
                      <strong>Plano Premium:</strong> 50% do valor = {formatCurrency((doctor?.consultationFee || 0) * 0.5)}
                      <div className="text-xs text-slate-500 mt-1">
                        Cálculo: {formatCurrency(doctor?.consultationFee || 0)} × 50% = {formatCurrency((doctor?.consultationFee || 0) * 0.5)}
                      </div>
                    </li>
                    <li>
                      <strong>Plano Ultra:</strong> 50% do valor = {formatCurrency((doctor?.consultationFee || 0) * 0.5)}
                      <div className="text-xs text-slate-500 mt-1">
                        <span className="block">Paciente paga apenas 30% do valor total: {formatCurrency((doctor?.consultationFee || 0) * 0.3)}</span>
                        <span className="block">CN Vidas cobre 20% do valor: {formatCurrency((doctor?.consultationFee || 0) * 0.2)}</span>
                        <span className="block">Você recebe 50% do valor total: {formatCurrency((doctor?.consultationFee || 0) * 0.5)}</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="payment-history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Extrato de Pagamentos</CardTitle>
                <CardDescription>
                  Histórico de todos os seus pagamentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPayments ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : payments && payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {format(new Date(payment.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{payment.description}</TableCell>
                          <TableCell>{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={payment.status === "paid" ? "success" : "outline"}>
                              {payment.status === "paid" ? "Pago" : "Pendente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell colSpan={2}>
                          {formatCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0))}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Você ainda não possui pagamentos registrados.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}