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

// Dados de exemplo para os gráficos
const userGrowthData = [
  { name: "Jan", total: 120 },
  { name: "Fev", total: 150 },
  { name: "Mar", total: 180 },
  { name: "Abr", total: 210 },
  { name: "Mai", total: 240 },
  { name: "Jun", total: 270 },
];

const revenueData = [
  { name: "Jan", total: 15000 },
  { name: "Fev", total: 18000 },
  { name: "Mar", total: 21000 },
  { name: "Abr", total: 24000 },
  { name: "Mai", total: 27000 },
  { name: "Jun", total: 30000 },
];

const telemedAdoptionData = [
  { name: "Jan", total: 60 },
  { name: "Fev", total: 65 },
  { name: "Mar", total: 70 },
  { name: "Abr", total: 72 },
  { name: "Mai", total: 75 },
  { name: "Jun", total: 78 },
];

const churnRateData = [
  { name: "Jan", total: 5 },
  { name: "Fev", total: 4.5 },
  { name: "Mar", total: 4 },
  { name: "Abr", total: 3.5 },
  { name: "Mai", total: 3 },
  { name: "Jun", total: 2.5 },
];

const npsData = [
  { name: "Jan", total: 70 },
  { name: "Fev", total: 72 },
  { name: "Mar", total: 73 },
  { name: "Abr", total: 74 },
  { name: "Mai", total: 75 },
  { name: "Jun", total: 76 },
];

const cacData = [
  { name: "Jan", total: 150 },
  { name: "Fev", total: 145 },
  { name: "Mar", total: 140 },
  { name: "Abr", total: 135 },
  { name: "Mai", total: 130 },
  { name: "Jun", total: 125 },
];

const ltvData = [
  { name: "Jan", total: 1200 },
  { name: "Fev", total: 1250 },
  { name: "Mar", total: 1300 },
  { name: "Abr", total: 1350 },
  { name: "Mai", total: 1400 },
  { name: "Jun", total: 1450 },
];

const AdminAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState("6months");
  
  // Queries for real data only
  const { data: partnersData = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: getAllPartners,
  });
  
  const { data: claimsData = [] } = useQuery<Claim[]>({
    queryKey: ["/api/claims"],
    queryFn: getAllClaims,
  });
  
  const { data: patientsData = [] } = useQuery({
    queryKey: ["/api/users", "patient"],
    queryFn: () => getUsersByRole("patient"),
  });
  
  const { data: doctorsData = [] } = useQuery({
    queryKey: ["/api/users", "doctor"],
    queryFn: () => getUsersByRole("doctor"),
  });
  
  const { data: allUsersData = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => fetch("/api/users", { credentials: "include" }).then(res => res.json()),
  });
  
  // Garantir que os dados sejam sempre arrays
  const partners = Array.isArray(partnersData) ? partnersData : [];
  const claims = Array.isArray(claimsData) ? claimsData : [];
  const patients = Array.isArray(patientsData) ? patientsData : [];
  const doctors = Array.isArray(doctorsData) ? doctorsData : [];
  const allUsers = Array.isArray(allUsersData) ? allUsersData : [];
  
  // Number of months to show in charts
  const monthsToShow = timeRange === "12months" ? 12 : timeRange === "6months" ? 6 : 3;
  
  // Generate dates for the past n months
  const getLastNMonths = (n: number) => {
    const today = new Date();
    const months = [];
    
    for (let i = n - 1; i >= 0; i--) {
      const date = subMonths(today, i);
      months.push({
        name: format(date, "MMM", { locale: ptBR }),
        date: date,
      });
    }
    
    return months;
  };
  
  const lastMonths = getLastNMonths(monthsToShow);
  
  // Real data calculations
  const approvedClaims = claims.filter((claim: Claim) => claim.status === "approved").length;
  const pendingClaims = claims.filter((claim: Claim) => claim.status === "pending").length;
  const rejectedClaims = claims.filter((claim: Claim) => claim.status === "rejected").length;
  const totalClaims = claims.length;
  
  // Claims by status (real data)
  const claimsStatusData = totalClaims > 0 ? [
    { name: "Aprovados", value: Math.round((approvedClaims / totalClaims) * 100) },
    { name: "Pendentes", value: Math.round((pendingClaims / totalClaims) * 100) },
    { name: "Rejeitados", value: Math.round((rejectedClaims / totalClaims) * 100) }
  ] : [
    { name: "Nenhum dado", value: 100 }
  ];
  
  // Empty data for charts that don't have real data sources yet
  const emptyChartData = lastMonths.map((month) => ({
    name: month.name,
    value: 0,
  }));
  
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
                  <h3 className="text-2xl font-bold">{patients.length}</h3>
                  <p className="text-xs text-green-600">+12% último mês</p>
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
                  <h3 className="text-2xl font-bold">R$ 22.500</h3>
                  <p className="text-xs text-green-600">+8.3% último mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Smartphone className="h-10 w-10 text-secondary-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Adesão Telemedicina</p>
                  <h3 className="text-2xl font-bold">72%</h3>
                  <p className="text-xs text-green-600">+5% último mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Heart className="h-10 w-10 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">NPS</p>
                  <h3 className="text-2xl font-bold">76</h3>
                  <p className="text-xs text-green-600">+3 pontos último mês</p>
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
              <CardTitle>Adesão à Telemedicina</CardTitle>
              <CardDescription>Percentual de usuários ativos</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="Adesão à Telemedicina"
                type="bar"
                data={telemedAdoptionData}
                categories={['total']}
                xAxisKey="name"
                colors={['#3B82F6']}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Taxa de Churn</CardTitle>
              <CardDescription>Percentual de cancelamentos</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="Taxa de Churn"
                type="line"
                data={churnRateData}
                categories={['total']}
                xAxisKey="name"
                colors={['#EF4444']}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Charts Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>NPS (Net Promoter Score)</CardTitle>
              <CardDescription>Evolução da satisfação</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="NPS (Net Promoter Score)"
                type="bar"
                data={npsData}
                categories={['total']}
                xAxisKey="name"
                colors={['#10B981']}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>CAC (Custo de Aquisição)</CardTitle>
              <CardDescription>Custo por novo cliente (R$)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="CAC (Custo de Aquisição)"
                type="line"
                data={cacData}
                categories={['total']}
                xAxisKey="name"
                colors={['#F59E0B']}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>LTV (Valor do Cliente)</CardTitle>
              <CardDescription>Valor médio por cliente (R$)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <Chart 
                title="LTV (Valor do Cliente)"
                type="line"
                data={ltvData}
                categories={['total']}
                xAxisKey="name"
                colors={['#3B82F6']}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
