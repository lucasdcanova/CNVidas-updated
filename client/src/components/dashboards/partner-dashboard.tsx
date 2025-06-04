import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPartnerByUserId, getPartnerServicesByPartnerId } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import { useAuth } from "@/hooks/use-auth";
import { List, DollarSign } from "lucide-react";

export const PartnerDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const { data: partnerInfo } = useQuery({
    queryKey: ["/api/partners/user"],
    queryFn: () => getPartnerByUserId(user?.id || 0),
    enabled: !!user?.id,
  });
  
  const { data: services = [] } = useQuery({
    queryKey: ["/api/services", partnerInfo?.id],
    queryFn: () => getPartnerServicesByPartnerId(partnerInfo?.id || 0),
    enabled: !!partnerInfo?.id,
  });
  
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
  
  return (
    <div className="max-w-7xl mx-auto">
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
    </div>
  );
};

export default PartnerDashboard;
