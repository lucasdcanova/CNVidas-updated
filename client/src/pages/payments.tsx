import React from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getUserProfile } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import PaymentMethods from "@/components/payment/payment-methods";
import TransactionHistory from "@/components/payment/transaction-history";
import { CreditCard, DollarSign, Receipt } from "lucide-react";

const PaymentsPage: React.FC = () => {
  const { user } = useAuth();

  // Buscar dados do perfil
  const { data: profileData } = useQuery({
    queryKey: ['/api/users/profile'],
    queryFn: getUserProfile,
    enabled: !!user
  });

  // Buscar métodos de pagamento
  const paymentMethodsQuery = useQuery({
    queryKey: ['/api/subscription/payment-methods'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscription/payment-methods');
      if (!response.ok) {
        throw new Error('Falha ao buscar métodos de pagamento');
      }
      return response.json();
    },
    enabled: !!user
  });

  const paymentMethodsData = paymentMethodsQuery.data;

  // Buscar histórico de transações
  const transactionHistoryQuery = useQuery({
    queryKey: ['/api/payment-history'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payment-history');
      if (!response.ok) {
        throw new Error('Falha ao buscar histórico de pagamentos');
      }
      return response.json();
    },
    enabled: !!user
  });

  const transactionData = transactionHistoryQuery.data;
  
  // Debug: Log transaction data
  React.useEffect(() => {
    if (transactionData) {
      console.log('💰 Transaction History Data:', transactionData);
    }
  }, [transactionData]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            Pagamentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas assinaturas, métodos de pagamento e histórico de transações
          </p>
        </div>

        {/* Card de Informações de Assinatura */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle>Informações de Assinatura</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Plano Atual</p>
                <p className="text-2xl font-bold">
                  {profileData?.subscriptionPlan 
                    ? profileData.subscriptionPlan.replace(/_/g, ' ').toUpperCase() 
                    : "Sem Plano"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${
                    profileData?.subscriptionStatus === 'active' 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                  }`} />
                  <p className={`text-lg font-semibold ${
                    profileData?.subscriptionStatus === 'active' 
                      ? 'text-green-600' 
                      : 'text-gray-600'
                  }`}>
                    {profileData?.subscriptionStatus === 'active' ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Para gerenciar sua assinatura ou trocar de plano, visite a página de{' '}
                <a href="/subscription" className="text-primary underline font-medium hover:text-primary/80">
                  assinaturas
                </a>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Métodos de Pagamento */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Métodos de Pagamento</h2>
            </div>
          </div>
          <p className="text-muted-foreground mb-6">
            Gerencie seus métodos de pagamento para assinaturas e consultas
          </p>
          
          <PaymentMethods 
            paymentMethods={paymentMethodsData?.paymentMethods || []}
            onUpdate={() => {
              paymentMethodsQuery.refetch();
            }}
          />
        </div>

        {/* Histórico de Transações */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>
              Visualize todas as suas transações de assinaturas e consultas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionHistory 
              transactions={transactionData?.transactions || []}
              summary={transactionData?.summary}
              loading={transactionHistoryQuery.isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PaymentsPage;