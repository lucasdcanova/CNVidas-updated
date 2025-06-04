import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/layouts/dashboard-layout';
import AdminLayout from '@/components/layouts/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UserCheck, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlanStat {
  plan: string;
  count: number;
}

interface SellerStat {
  sellerName: string;
  totalPlans: number;
  plansByType: PlanStat[];
}

const planLabels: Record<string, string> = {
  'free': 'Gratuito',
  'basic': 'Básico',
  'premium': 'Premium',
  'ultra': 'Ultra',
  'basic_family': 'Básico Família',
  'premium_family': 'Premium Família',
  'ultra_family': 'Ultra Família',
};

const planColors: Record<string, string> = {
  'free': 'bg-gray-100 text-gray-800 border-gray-300',
  'basic': 'bg-blue-100 text-blue-800 border-blue-300',
  'premium': 'bg-purple-100 text-purple-800 border-purple-300',
  'ultra': 'bg-teal-100 text-teal-800 border-teal-300',
  'basic_family': 'bg-blue-100 text-blue-800 border-blue-300',
  'premium_family': 'bg-purple-100 text-purple-800 border-purple-300',
  'ultra_family': 'bg-teal-100 text-teal-800 border-teal-300',
};

const SellerStats: React.FC = () => {
  const { data: sellers, isLoading } = useQuery<SellerStat[]>({
    queryKey: ['/api/admin/sellers'],
    queryFn: () => apiRequest('GET', '/api/admin/sellers').then(res => res.json()),
  });

  if (isLoading) {
    return (
      <AdminLayout title="Estatísticas de Vendedores">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Calcular total de vendas
  const totalSales = sellers?.reduce((total, seller) => total + seller.totalPlans, 0) || 0;

  // Calcular total por plano
  const planTotals: Record<string, number> = {};
  sellers?.forEach(seller => {
    seller.plansByType.forEach(plan => {
      planTotals[plan.plan] = (planTotals[plan.plan] || 0) + plan.count;
    });
  });

  return (
    <AdminLayout title="Estatísticas de Vendedores">
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendedores</CardTitle>
            <CardDescription>Vendedores ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <UserCheck className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-2xl font-bold">{sellers?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <CardDescription>Assinaturas vendidas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-2xl font-bold">{totalSales}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Plano Mais Vendido</CardTitle>
            <CardDescription>Plano com mais assinaturas</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(planTotals).length > 0 && (
              <div className="flex items-center">
                <Badge 
                  className={planColors[Object.entries(planTotals).sort((a, b) => b[1] - a[1])[0][0]]}
                >
                  {planLabels[Object.entries(planTotals).sort((a, b) => b[1] - a[1])[0][0]]}
                </Badge>
                <span className="ml-2 text-xl font-bold">
                  {Object.entries(planTotals).sort((a, b) => b[1] - a[1])[0][1]}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho dos Vendedores</CardTitle>
          <CardDescription>
            Lista de vendedores e suas vendas por tipo de plano
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="grid w-full md:w-[400px] grid-cols-2 mb-6">
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="table">
              <Table>
                <TableCaption>Lista de vendedores e número de planos vendidos</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Total de Planos</TableHead>
                    <TableHead>Básico</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Ultra</TableHead>
                    <TableHead>Básico Família</TableHead>
                    <TableHead>Premium Família</TableHead>
                    <TableHead>Ultra Família</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers?.map((seller) => {
                    // Criar um objeto com as contagens para cada plano
                    const planCounts: Record<string, number> = {};
                    seller.plansByType.forEach(plan => {
                      planCounts[plan.plan] = plan.count;
                    });
                    
                    return (
                      <TableRow key={seller.sellerName}>
                        <TableCell className="font-medium">{seller.sellerName}</TableCell>
                        <TableCell className="font-bold">{seller.totalPlans}</TableCell>
                        <TableCell>{planCounts['basic'] || 0}</TableCell>
                        <TableCell>{planCounts['premium'] || 0}</TableCell>
                        <TableCell>{planCounts['ultra'] || 0}</TableCell>
                        <TableCell>{planCounts['basic_family'] || 0}</TableCell>
                        <TableCell>{planCounts['premium_family'] || 0}</TableCell>
                        <TableCell>{planCounts['ultra_family'] || 0}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="details">
              <div className="space-y-6">
                {sellers?.map((seller) => (
                  <Card key={seller.sellerName} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                      <CardTitle>{seller.sellerName}</CardTitle>
                      <CardDescription>
                        Total de planos vendidos: {seller.totalPlans}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {seller.plansByType.map((plan) => (
                          <Badge 
                            key={plan.plan} 
                            className={planColors[plan.plan]}
                          >
                            {planLabels[plan.plan]}: {plan.count}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {sellers?.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    Nenhum vendedor registrado ainda.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default SellerStats;