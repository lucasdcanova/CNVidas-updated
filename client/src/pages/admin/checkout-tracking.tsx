import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  RefreshCw,
  Filter,
  CreditCard,
  AlertTriangle,
  Phone,
  Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CheckoutTracking {
  id: number;
  user_id: number;
  status: string;
  checkout_type: string;
  amount: number;
  payment_method?: string;
  payment_status?: string;
  payment_error?: string;
  stripe_payment_intent_id?: string;
  stripe_error_code?: string;
  metadata: any;
  initiated_at: string;
  completed_at?: string;
  abandoned_at?: string;
  last_activity_at: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  subscription_plan?: string;
  subscription_status?: string;
}

interface Metrics {
  initiated_count: number;
  completed_count: number;
  abandoned_count: number;
  failed_count: number;
  expired_count: number;
  total_revenue: number;
  avg_transaction_value: number;
  unique_users: number;
}

interface ConversionRate {
  checkout_type: string;
  total: number;
  completed: number;
  conversion_rate: number;
}

interface ProblemPayments {
  payment_failed_count: number;
  payment_expired_count: number;
  abandoned_24h_count: number;
}

interface ProblemUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  subscription_plan?: string;
  subscription_status?: string;
  problem_checkouts_count: number;
  last_checkout_attempt: string;
  total_amount_pending: number;
  checkout_statuses: string[];
  payment_statuses: string[];
}

const CheckoutTrackingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedUser, setSelectedUser] = useState<ProblemUser | null>(null);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const { toast } = useToast();

  // Buscar checkouts
  const { data: checkoutsData, isLoading: loadingCheckouts, refetch: refetchCheckouts } = useQuery({
    queryKey: ['/api/admin/checkout-tracking', statusFilter, paymentStatusFilter, typeFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentStatusFilter !== 'all') params.append('paymentStatus', paymentStatusFilter);
      if (typeFilter !== 'all') params.append('checkoutType', typeFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const response = await apiRequest('GET', `/api/admin/checkout-tracking?${params}`);
      return await response.json();
    }
  });

  // Buscar métricas
  const { data: metricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['/api/admin/checkout-tracking/metrics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const response = await apiRequest('GET', `/api/admin/checkout-tracking/metrics?${params}`);
      return await response.json();
    }
  });

  // Buscar usuários com problemas
  const { data: problemUsersData, isLoading: loadingProblemUsers } = useQuery({
    queryKey: ['/api/admin/checkout-tracking/problem-users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/checkout-tracking/problem-users');
      return await response.json();
    }
  });

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'initiated':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'abandoned':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'payment_failed':
        return 'bg-red-100 text-red-800';
      case 'payment_expired':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para formatar moeda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount / 100);
  };

  // Função para enviar lembrete
  const sendReminder = async (userId: number, reminderType: string) => {
    try {
      await apiRequest('POST', '/api/admin/payment-reminders', {
        userId,
        reminderType,
        scheduledFor: new Date().toISOString()
      });
      
      toast({
        title: "Lembrete enviado",
        description: "O lembrete de pagamento foi agendado com sucesso.",
      });
      
      setShowReminderDialog(false);
    } catch (error) {
      toast({
        title: "Erro ao enviar lembrete",
        description: "Não foi possível agendar o lembrete.",
        variant: "destructive"
      });
    }
  };

  // Filtrar checkouts pela busca
  const filteredCheckouts = checkoutsData?.checkouts?.filter((checkout: CheckoutTracking) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      checkout.user_name?.toLowerCase().includes(search) ||
      checkout.user_email?.toLowerCase().includes(search) ||
      checkout.user_phone?.includes(search)
    );
  }) || [];

  return (
    <AdminLayout title="Monitoramento de Checkouts">
      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.metrics && (
                ((metricsData.metrics.completed_count / metricsData.metrics.initiated_count) * 100).toFixed(1)
              )}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.metrics?.completed_count || 0} de {metricsData?.metrics?.initiated_count || 0} checkouts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metricsData?.metrics?.total_revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ticket médio: {formatCurrency(metricsData?.metrics?.avg_transaction_value || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checkouts Abandonados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {metricsData?.metrics?.abandoned_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.problemPayments?.abandoned_24h_count || 0} há mais de 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Falhados</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(metricsData?.metrics?.failed_count || 0) + (metricsData?.metrics?.expired_count || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.problemPayments?.payment_failed_count || 0} falhas, {metricsData?.problemPayments?.payment_expired_count || 0} expirados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="checkouts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checkouts">Todos os Checkouts</TabsTrigger>
          <TabsTrigger value="problems">Pagamentos com Problemas</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
        </TabsList>

        {/* Tab de Checkouts */}
        <TabsContent value="checkouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Checkouts</CardTitle>
              <CardDescription>
                Acompanhe todos os checkouts iniciados na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="space-y-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        placeholder="Buscar por nome, email ou telefone..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="initiated">Iniciado</SelectItem>
                        <SelectItem value="processing">Processando</SelectItem>
                        <SelectItem value="completed">Completo</SelectItem>
                        <SelectItem value="abandoned">Abandonado</SelectItem>
                        <SelectItem value="failed">Falhou</SelectItem>
                        <SelectItem value="payment_failed">Pagamento Falhou</SelectItem>
                        <SelectItem value="payment_expired">Expirado</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Tipos</SelectItem>
                        <SelectItem value="subscription">Assinatura</SelectItem>
                        <SelectItem value="consultation">Consulta</SelectItem>
                        <SelectItem value="service">Serviço</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => refetchCheckouts()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="start-date">De:</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="end-date">Até:</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-auto"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setDateRange({ start: '', end: '' })}
                  >
                    Limpar Datas
                  </Button>
                </div>
              </div>

              {/* Tabela de Checkouts */}
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCheckouts ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex justify-center">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCheckouts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum checkout encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCheckouts.map((checkout: CheckoutTracking) => (
                        <TableRow key={checkout.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{checkout.user_name}</div>
                              <div className="text-sm text-muted-foreground">{checkout.user_email}</div>
                              {checkout.user_phone && (
                                <div className="text-sm text-muted-foreground">{checkout.user_phone}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {checkout.checkout_type === 'subscription' && 'Assinatura'}
                              {checkout.checkout_type === 'consultation' && 'Consulta'}
                              {checkout.checkout_type === 'service' && 'Serviço'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(checkout.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(checkout.status)}>
                              {checkout.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {checkout.payment_method && (
                              <div>
                                <Badge variant="secondary" className="mb-1">
                                  {checkout.payment_method}
                                </Badge>
                                {checkout.payment_status && (
                                  <div className="text-sm text-muted-foreground">
                                    {checkout.payment_status}
                                  </div>
                                )}
                                {checkout.payment_error && (
                                  <div className="text-xs text-red-600">
                                    {checkout.payment_error}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(checkout.initiated_at), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(checkout.initiated_at), "HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Implementar visualização detalhada
                              }}
                            >
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Problemas */}
        <TabsContent value="problems" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuários com Pagamentos Pendentes</CardTitle>
              <CardDescription>
                Lista de usuários com checkouts abandonados ou pagamentos falhados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Problemas</TableHead>
                      <TableHead>Valor Pendente</TableHead>
                      <TableHead>Último Tentativa</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProblemUsers ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex justify-center">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : problemUsersData?.problemUsers?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário com problemas de pagamento
                        </TableCell>
                      </TableRow>
                    ) : (
                      problemUsersData?.problemUsers?.map((user: ProblemUser) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                              {user.phone && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {user.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.subscription_plan ? (
                              <Badge variant="outline">
                                {user.subscription_plan}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Sem plano</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500" />
                              <span className="text-sm font-medium">{user.problem_checkouts_count}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {user.checkout_statuses.join(', ')}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-red-600">
                            {formatCurrency(user.total_amount_pending)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(user.last_checkout_attempt), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(user.last_checkout_attempt), "HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowReminderDialog(true);
                                }}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Lembrete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Implementar contato via WhatsApp
                                  if (user.phone) {
                                    window.open(`https://wa.me/55${user.phone.replace(/\D/g, '')}`, '_blank');
                                  }
                                }}
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Análises */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Taxa de Conversão por Tipo */}
            {metricsData?.conversionRates?.map((rate: ConversionRate) => (
              <Card key={rate.checkout_type}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {rate.checkout_type === 'subscription' && 'Assinaturas'}
                    {rate.checkout_type === 'consultation' && 'Consultas'}
                    {rate.checkout_type === 'service' && 'Serviços'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{rate.conversion_rate}%</div>
                  <div className="text-sm text-muted-foreground">
                    {rate.completed} de {rate.total} completados
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${rate.conversion_rate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Insights e Recomendações */}
          <Card>
            <CardHeader>
              <CardTitle>Insights e Recomendações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metricsData?.metrics?.abandoned_count > 10 && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Alta taxa de abandono</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {metricsData.metrics.abandoned_count} checkouts foram abandonados. 
                      Considere implementar emails de recuperação de carrinho ou simplificar o processo de checkout.
                    </p>
                  </div>
                </div>
              )}

              {metricsData?.problemPayments?.payment_failed_count > 5 && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Muitas falhas de pagamento</h4>
                    <p className="text-sm text-red-700 mt-1">
                      {metricsData.problemPayments.payment_failed_count} pagamentos falharam. 
                      Verifique as configurações do gateway de pagamento e considere oferecer métodos alternativos.
                    </p>
                  </div>
                </div>
              )}

              {((metricsData?.metrics?.completed_count || 0) / (metricsData?.metrics?.initiated_count || 1) * 100) > 70 && (
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Excelente taxa de conversão!</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Sua taxa de conversão está acima de 70%. Continue monitorando para manter esse desempenho.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Lembrete */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Lembrete de Pagamento</DialogTitle>
            <DialogDescription>
              Escolha o tipo de lembrete para enviar ao usuário {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => sendReminder(selectedUser!.id, 'payment_failed')}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Lembrete de Pagamento Falhado
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => sendReminder(selectedUser!.id, 'payment_due')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Lembrete de Pagamento Pendente
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => sendReminder(selectedUser!.id, 'subscription_expiring')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Lembrete de Renovação de Assinatura
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminderDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default CheckoutTrackingPage;