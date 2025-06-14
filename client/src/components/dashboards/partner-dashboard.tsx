import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getCurrentPartner, getPartnerServicesByPartnerId, getAllConsultations } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import { useAuth } from "@/hooks/use-auth";
import { List, DollarSign, MapPin } from "lucide-react";
import { CardDescription } from "@/components/ui/card";
import { Column, Action } from "@/components/ui/data-table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interface Consultation igual ao admin-dashboard
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

export const PartnerDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const { data: partnerInfo } = useQuery({
    queryKey: ["/api/partners/me"],
    queryFn: getCurrentPartner,
    enabled: !!user?.id,
  });
  
  const { data: services = [] } = useQuery({
    queryKey: ["/api/partners/my-services"],
    queryFn: async () => {
      const res = await fetch("/api/partners/my-services", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch partner services");
      }
      return await res.json();
    },
    enabled: !!user?.id,
  });

  // Busca as consultas do parceiro
  const { data: consultations = [] } = useQuery({
    queryKey: ["/api/consultations/partner", partnerInfo?.id],
    queryFn: () => getAllConsultations(partnerInfo?.id || 0),
    enabled: !!partnerInfo?.id,
  });
  
  // Adiciona a lista de consultas recentes
  const recentConsultations = consultations ? consultations.slice(0, 5) : [];

  // Função para visualizar detalhes da consulta
  const handleViewConsultation = (row: Consultation) => {
    console.log("Ver detalhes da consulta", row.id);
  };
  
  const serviceColumns = [
    {
      id: "name",
      header: "Serviço",
      accessorKey: "name",
    },
    {
      id: "category",
      header: "Categoria",
      accessorKey: "category",
    },
    {
      id: "regularPrice",
      header: "Preço Regular",
      accessorKey: "regularPrice",
      cell: (row: any) => `R$ ${(row.regularPrice / 100).toFixed(2).replace('.', ',')}`,
    },
    {
      id: "discountPrice",
      header: "Preço CN Vidas",
      accessorKey: "discountPrice",
      cell: (row: any) => `R$ ${(row.discountPrice / 100).toFixed(2).replace('.', ',')}`,
    },
    {
      id: "discountPercentage",
      header: "Desconto",
      accessorKey: "discountPercentage",
      cell: (row: any) => `${row.discountPercentage}%`,
    },
    {
      id: "isActive",
      header: "Status",
      accessorKey: "isActive",
      cell: (row: any) => (
        <span className={`px-2 py-1 inline-flex text-xs leading-4 font-medium rounded-full ${
          row.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
        }`}>
          {row.isActive ? "Ativo" : "Inativo"}
        </span>
      ),
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
  
  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="md:flex items-center justify-between">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800">Olá, {user?.fullName}!</h2>
            <p className="mt-2 text-gray-600">Bem-vindo ao seu painel de parceiro CN Vidas. Aqui você pode gerenciar seus serviços oferecidos.</p>
            <div className="mt-4 flex space-x-3">
              <Link href="/partner/services">
                <Button className="inline-flex items-center">
                  <List className="mr-2 h-4 w-4" />
                  Gerenciar Serviços
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Services Summary */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-10 w-10 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Serviços Oferecidos</p>
              <h3 className="text-2xl font-bold">{services.length}</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Meus Serviços</CardTitle>
          <Link href="/partner/services">
            <Button className="inline-flex items-center">
              <List className="mr-2 h-4 w-4" />
              Gerenciar
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {services.length > 0 ? (
            <DataTable 
              columns={serviceColumns} 
              data={services} 
              pageSize={10}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Você ainda não cadastrou nenhum serviço.</p>
              <Link href="/partner/services">
                <Button className="mt-4 inline-flex items-center">
                  <List className="mr-2 h-4 w-4" />
                  Adicionar Serviços
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Endereços</CardTitle>
            <CardDescription>Gerencie seus endereços de atendimento</CardDescription>
          </div>
          <Link href="/partner/addresses">
            <Button className="inline-flex items-center">
              <MapPin className="mr-2 h-4 w-4" />
              Gerenciar Endereços
            </Button>
          </Link>
        </CardHeader>
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
    </div>
  );
};

export default PartnerDashboard;
