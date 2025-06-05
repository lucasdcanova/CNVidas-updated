import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getUsersByRole, getAllPartners, getAllClaims, getPendingClaims, getAllConsultations } from "@/lib/api";
import { Chart } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusCard from "@/components/shared/status-card";
import DataTable from "@/components/ui/data-table";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Column, Action } from "@/components/ui/data-table";

interface ChartProps {
  type: 'bar' | 'line' | 'pie';
  data: Array<{ name: string; total: number } | { name: string; value: number }>;
  categories: string[];
  colors: string[];
  title: string;
}

interface Patient {
  id: number;
  name: string;
}

interface Claim {
  id: number;
  type: string;
  status: string;
  description: string;
  occurrenceDate: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  amountRequested?: number;
  amountApproved?: number;
  reviewedAt?: string;
  reviewedBy?: number;
  reviewNotes?: string;
  documents?: string[];
}

interface Consultation {
  id: number;
  patientName: string;
  doctorName: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  date: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  doctorId: number;
  type: string;
  notes?: string;
  prescription?: string;
  diagnosis?: string;
}

interface PendingClaim {
  id: number;
  type: string;
  occurrenceDate: string;
  status: string;
  createdAt: string;
}

interface Partner {
  id: number;
  businessName: string;
  businessType: string;
  status: string;
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const { data: patients = [] } = useQuery({
    queryKey: ["/api/users", "patient"],
    queryFn: () => getUsersByRole("patient"),
  });
  
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: getAllPartners,
  });
  
  const { data: claims = [] } = useQuery({
    queryKey: ["/api/claims"],
    queryFn: getAllClaims,
  });
  
  const { data: pendingClaims = [] } = useQuery({
    queryKey: ["/api/claims/pending"],
    queryFn: getPendingClaims,
  });
  
  const { data: consultations = [] } = useQuery({
    queryKey: ["/api/consultations"],
    queryFn: () => getAllConsultations(0),
  });
  
  // KPI data
  const cacValue = "R$ 120,00";
  const ltvValue = "R$ 1.450,00";
  const churnRate = "5.3%";
  const telemedAdoption = "72%";
  const npsScore = "76";
  
  // Chart data for visualizations
  const userGrowthData = [
    { name: 'Jan', total: 120 },
    { name: 'Fev', total: 150 },
    { name: 'Mar', total: 190 },
    { name: 'Abr', total: 220 },
    { name: 'Mai', total: 280 },
    { name: 'Jun', total: 350 },
  ];
  
  const claimsStatusData = [
    { name: 'Aprovados', value: 68 },
    { name: 'Pendentes', value: 22 },
    { name: 'Rejeitados', value: 10 }
  ];
  
  const revenueData = [
    { name: 'Jan', total: 15000 },
    { name: 'Fev', total: 18000 },
    { name: 'Mar', total: 17000 },
    { name: 'Abr', total: 20000 },
    { name: 'Mai', total: 22000 },
    { name: 'Jun', total: 25000 },
  ];
  
  const pendingClaimsColumns: Column<PendingClaim>[] = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
    },
    {
      id: "type",
      header: "Tipo",
      accessorKey: "type",
    },
    {
      id: "occurrenceDate",
      header: "Data da Ocorrência",
      accessorKey: "occurrenceDate",
      cell: (row: PendingClaim) => <span>{format(new Date(row.occurrenceDate), "dd/MM/yyyy", { locale: ptBR })}</span>,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row: PendingClaim) => (
        <span className="px-2 py-1 inline-flex text-xs leading-4 font-medium rounded-full bg-yellow-100 text-yellow-800">
          Em análise
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Data de Envio",
      accessorKey: "createdAt",
      cell: (row: PendingClaim) => <span>{format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>,
    },
  ];
  
  const recentPartnersColumns: Column<Partner>[] = [
    {
      id: "businessName",
      header: "Nome Comercial",
      accessorKey: "businessName",
    },
    {
      id: "businessType",
      header: "Tipo",
      accessorKey: "businessType",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row: Partner) => (
        <span className={`px-2 py-1 inline-flex text-xs leading-4 font-medium rounded-full ${
          row.status === "active" ? "bg-green-100 text-green-800" :
          row.status === "pending" ? "bg-yellow-100 text-yellow-800" :
          "bg-gray-100 text-gray-800"
        }`}>
          {row.status === "active" ? "Ativo" :
           row.status === "pending" ? "Pendente" :
           row.status}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Data de Cadastro",
      accessorKey: "createdAt",
      cell: (row: Partner) => <span>{format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>,
    },
  ];
  
  // Recent consultations columns
  const recentConsultationsColumns: Column<Consultation>[] = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
    },
    {
      id: "patientName",
      header: "Paciente",
      accessorKey: "patientName",
    },
    {
      id: "doctorName",
      header: "Médico",
      accessorKey: "doctorName",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row: Consultation) => {
        let colors;
        let label;
        switch (row.status) {
          case "scheduled":
            colors = "bg-blue-100 text-blue-800";
            label = "Agendada";
            break;
          case "in_progress":
            colors = "bg-yellow-100 text-yellow-800";
            label = "Em andamento";
            break;
          case "completed":
            colors = "bg-green-100 text-green-800";
            label = "Concluída";
            break;
          case "cancelled":
            colors = "bg-red-100 text-red-800";
            label = "Cancelada";
            break;
          default:
            colors = "bg-gray-100 text-gray-800";
            label = row.status;
        }
        return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors}`}>{label}</span>;
      },
    },
    {
      id: "date",
      header: "Data/Hora",
      accessorKey: "date",
      cell: (row: Consultation) => <span>{format(new Date(row.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>,
    },
  ];
  
  // Recent claims columns
  const recentClaimsColumns: Column<Claim>[] = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
    },
    {
      id: "type",
      header: "Tipo",
      accessorKey: "type",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row: Claim) => {
        let colors;
        let label;
        switch (row.status) {
          case "pending":
            colors = "bg-yellow-100 text-yellow-800";
            label = "Em análise";
            break;
          case "approved":
            colors = "bg-green-100 text-green-800";
            label = "Aprovado";
            break;
          case "rejected":
            colors = "bg-red-100 text-red-800";
            label = "Rejeitado";
            break;
          default:
            colors = "bg-gray-100 text-gray-800";
            label = row.status;
        }
        return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors}`}>{label}</span>;
      },
    },
    {
      id: "createdAt",
      header: "Data de Envio",
      accessorKey: "createdAt",
      cell: (row: Claim) => <span>{format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>,
    },
  ];
  
  // Adiciona a lista de consultas recentes
  const recentConsultations = consultations ? consultations.slice(0, 5) : [];
  
  // Adiciona a lista de sinistros recentes
  const recentClaims = claims ? claims.slice(0, 5) : [];
  
  // Função para visualizar detalhes da consulta
  const handleViewConsultation = (row: Consultation) => {
    console.log("Ver detalhes da consulta", row.id);
  };
  
  // Função para visualizar detalhes do sinistro
  const handleViewClaim = (row: Claim) => {
    console.log("Ver detalhes do sinistro", row.id);
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome card */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800">Bem-vindo(a), {user?.fullName}!</h2>
          <p className="mt-2 text-gray-600">Este é o painel administrativo do CN Vidas. Aqui você pode monitorar a plataforma e gerenciar usuários, parceiros e sinistros.</p>
        </div>
      </div>

      {/* Key performance indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatusCard
          icon="attach_money"
          iconBgColor="bg-primary-100"
          iconColor="text-primary-600"
          title="CAC"
          value={cacValue}
        />
        
        <StatusCard
          icon="event_repeat"
          iconBgColor="bg-secondary-100"
          iconColor="text-secondary-600"
          title="LTV"
          value={ltvValue}
        />
        
        <StatusCard
          icon="running_with_errors"
          iconBgColor="bg-red-100"
          iconColor="text-red-600"
          title="Churn Rate"
          value={churnRate}
        />
        
        <StatusCard
          icon="videocam"
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          title="Adesão Telemedicina"
          value={telemedAdoption}
        />
        
        <StatusCard
          icon="emoji_emotions"
          iconBgColor="bg-yellow-100"
          iconColor="text-yellow-600"
          title="NPS"
          value={npsScore}
        />
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatusCard
          icon="people"
          iconBgColor="bg-primary-100"
          iconColor="text-primary-600"
          title="Usuários Cadastrados"
          value={`${patients.length}`}
          linkText="Ver usuários"
          linkUrl="/admin/users"
        />
        
        <StatusCard
          icon="store"
          iconBgColor="bg-secondary-100"
          iconColor="text-secondary-600"
          title="Parceiros Ativos"
          value={`${partners.filter((p: Partner) => p.status === "active").length}`}
          linkText="Ver parceiros"
          linkUrl="/admin/partners"
        />
        
        <StatusCard
          icon="description"
          iconBgColor="bg-yellow-100"
          iconColor="text-yellow-600"
          title="Sinistros Pendentes"
          value={`${pendingClaims.length}`}
          linkText="Ver sinistros"
          linkUrl="/admin/claims"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Crescimento de Usuários</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <Chart 
              type="bar"
              data={userGrowthData}
              categories={['total']}
              colors={['#3B82F6']}
              title="Crescimento de Usuários"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Status dos Sinistros</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <Chart 
              type="pie"
              data={claimsStatusData}
              categories={['value']}
              colors={['#10B981', '#F59E0B', '#EF4444']}
              title="Status dos Sinistros"
            />
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Receita Mensal</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <Chart 
            type="line"
            data={revenueData}
            categories={['total']}
            colors={['#10B981']}
            title="Receita Mensal"
          />
        </CardContent>
      </Card>

      {/* Pending Claims */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Sinistros Pendentes</CardTitle>
          <Link href="/admin/claims">
            <Button variant="outline" size="sm">Ver Todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <DataTable<PendingClaim>
            columns={pendingClaimsColumns}
            data={pendingClaims.slice(0, 5)}
            pageSize={5}
            actions={[
              {
                label: "Analisar",
                onClick: (row: PendingClaim) => console.log("Analisar sinistro", row.id)
              }
            ]}
          />
        </CardContent>
      </Card>

      {/* Recent Partners */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Parceiros Recentes</CardTitle>
          <Link href="/admin/partners">
            <Button variant="outline" size="sm">Ver Todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <DataTable<Partner>
            columns={recentPartnersColumns}
            data={partners.slice(0, 5)}
            pageSize={5}
            actions={[
              {
                label: "Visualizar",
                onClick: (row: Partner) => console.log("Visualizar parceiro", row.id)
              }
            ]}
          />
        </CardContent>
      </Card>

      {/* Recent consultations */}
      <Card>
        <CardHeader>
          <CardTitle>Consultas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<Consultation>
            columns={recentConsultationsColumns}
            data={recentConsultations}
            actions={[
              {
                label: "Ver detalhes",
                onClick: (row) => handleViewConsultation(row),
              },
            ]}
          />
        </CardContent>
      </Card>
      
      {/* Recent claims */}
      <Card>
        <CardHeader>
          <CardTitle>Sinistros Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<Claim>
            columns={recentClaimsColumns}
            data={recentClaims}
            actions={[
              {
                label: "Ver detalhes",
                onClick: (row) => handleViewClaim(row),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
