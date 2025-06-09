import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { getAllPartners, getAllClaims, getUsersByRole } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Chart } from "@/components/ui/chart";
import Breadcrumb from "@/components/ui/breadcrumb";
import { 
  TrendingUp, 
  Users, 
  FileText, 
  Percent, 
  DollarSign, 
  Heart, 
  Calendar,
  Smartphone
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Claim } from "@/shared/types";

// Interfaces para os dados de analytics
interface AnalyticsOverview {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalPartners: number;
  activeUsers: number;
  totalClaims: number;
  pendingClaims: number;
  monthlyRevenue: string;
  monthlyGrowth: string;
  subscriptionBreakdown: {
    free: number;
    basic: number;
    premium: number;
  };
}

interface GrowthData {
  name: string;
  newUsers: number;
  totalUsers: number;
}

interface RevenueData {
  name: string;
  total: number;
  basic: number;
  premium: number;
}

const AdminAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState("6months");
  
  // Queries for real data
  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/admin/analytics/overview"],
    queryFn: () => fetch("/api/admin/analytics/overview", { credentials: "include" }).then(res => res.json()),
  });
  
  const monthsCount = timeRange === "12months" ? 12 : timeRange === "6months" ? 6 : 3;
  
  const { data: growthData = [] } = useQuery<GrowthData[]>({
    queryKey: ["/api/admin/analytics/growth", monthsCount],
    queryFn: () => fetch(`/api/admin/analytics/growth?months=${monthsCount}`, { credentials: "include" }).then(res => res.json()),
  });
  
  const { data: revenueData = [] } = useQuery<RevenueData[]>({
    queryKey: ["/api/admin/analytics/revenue", monthsCount],
    queryFn: () => fetch(`/api/admin/analytics/revenue?months=${monthsCount}`, { credentials: "include" }).then(res => res.json()),
  });
  
  const { data: claimsData = [] } = useQuery<Claim[]>({
    queryKey: ["/api/claims"],
    queryFn: getAllClaims,
  });
  
  // Garantir que os dados sejam sempre arrays
  const claims = Array.isArray(claimsData) ? claimsData : [];
  
  // Real data calculations
  const approvedClaims = claims.filter((claim: Claim) => claim.status === "approved").length;
  const pendingClaims = claims.filter((claim: Claim) => claim.status === "pending").length;
  const rejectedClaims = claims.filter((claim: Claim) => claim.status === "rejected").length;
  const totalClaims = claims.length;
  
  // Claims by status (real data)
  const claimsStatusData = totalClaims > 0 ? [
    { name: "Aprovados", value: approvedClaims },
    { name: "Pendentes", value: pendingClaims },
    { name: "Rejeitados", value: rejectedClaims }
  ] : [
    { name: "Sem sinistros", value: 1 }
  ];
  
  // Format growth data for chart
  const userGrowthData = growthData.map(item => ({
    name: item.name,
    total: item.totalUsers
  }));
  
  // Calculate monthly growth percentage
  const monthlyGrowthPercentage = overview?.monthlyGrowth ? parseFloat(overview.monthlyGrowth) : 0;
  const growthClass = monthlyGrowthPercentage > 0 ? "text-green-600" : monthlyGrowthPercentage < 0 ? "text-red-600" : "text-gray-600";
  const growthSign = monthlyGrowthPercentage > 0 ? "+" : "";
  
  return (
    <AdminLayout title="Analytics">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div></div>
          
          <div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Últimos 3 meses</SelectItem>
                <SelectItem value="6months">Últimos 6 meses</SelectItem>
                <SelectItem value="12months">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Users className="h-10 w-10 text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Usuários Ativos</p>
                  <h3 className="text-2xl font-bold">{overview?.activeUsers || 0}</h3>
                  <p className={`text-xs ${growthClass}`}>{growthSign}{monthlyGrowthPercentage}% último mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <DollarSign className="h-10 w-10 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Receita Mensal</p>
                  <h3 className="text-2xl font-bold">R$ {overview?.monthlyRevenue || "0.00"}</h3>
                  <p className="text-xs text-gray-500">Recorrente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Smartphone className="h-10 w-10 text-secondary-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Total de Médicos</p>
                  <h3 className="text-2xl font-bold">{overview?.totalDoctors || 0}</h3>
                  <p className="text-xs text-gray-500">Cadastrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <FileText className="h-10 w-10 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Sinistros Pendentes</p>
                  <h3 className="text-2xl font-bold">{overview?.pendingClaims || 0}</h3>
                  <p className="text-xs text-gray-500">Aguardando análise</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Crescimento de Usuários</CardTitle>
              <CardDescription>Total de usuários ativos por mês</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="Crescimento de Usuários"
                type="bar"
                data={userGrowthData}
                categories={['total']}
                xAxisKey="name"
                colors={['#3B82F6']}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Receita Mensal</CardTitle>
              <CardDescription>Receita total por mês (R$)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="Receita Mensal"
                type="line"
                data={revenueData}
                categories={['total']}
                xAxisKey="name"
                colors={['#10B981']}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Status dos Sinistros</CardTitle>
              <CardDescription>Distribuição por status</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="Status dos Sinistros"
                type="pie"
                data={claimsStatusData}
                categories={['value']}
                xAxisKey="name"
                colors={['#10B981', '#F59E0B', '#EF4444']}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Planos</CardTitle>
              <CardDescription>Assinaturas ativas por tipo</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="Distribuição de Planos"
                type="pie"
                data={[
                  { name: "Free", value: overview?.subscriptionBreakdown?.free || 0 },
                  { name: "Basic", value: overview?.subscriptionBreakdown?.basic || 0 },
                  { name: "Premium", value: overview?.subscriptionBreakdown?.premium || 0 }
                ]}
                categories={['value']}
                xAxisKey="name"
                colors={['#6B7280', '#3B82F6', '#10B981']}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas Gerais</CardTitle>
              <CardDescription>Resumo da plataforma</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total de Usuários</span>
                  <span className="text-sm font-medium">{overview?.totalUsers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pacientes</span>
                  <span className="text-sm font-medium">{overview?.totalPatients || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médicos</span>
                  <span className="text-sm font-medium">{overview?.totalDoctors || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Parceiros</span>
                  <span className="text-sm font-medium">{overview?.totalPartners || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total de Sinistros</span>
                  <span className="text-sm font-medium">{overview?.totalClaims || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
