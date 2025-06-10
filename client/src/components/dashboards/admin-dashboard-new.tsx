import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getUsersByRole, getAllPartners, getAllClaims, getPendingClaims } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Building2, 
  FileText, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  Eye,
  Edit,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardStats {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: string;
  bgColor: string;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Queries
  const { data: patients = [] } = useQuery({
    queryKey: ["/api/users", "patient"],
    queryFn: () => getUsersByRole("patient"),
  });
  
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: getAllPartners,
  });
  
  const { data: claims = [] } = useQuery({
    queryKey: ["/api/admin/claims"],
    queryFn: getAllClaims,
  });
  
  const { data: pendingClaims = [] } = useQuery({
    queryKey: ["/api/admin/pending-claims"],
    queryFn: getPendingClaims,
  });

  // Calculate stats
  const activePatients = patients.filter((p: any) => p.status === 'active').length;
  const activePartners = partners.filter((p: any) => p.status === 'active').length;
  const approvedClaims = claims.filter((c: any) => c.status === 'approved').length;
  
  const stats: DashboardStats[] = [
    {
      title: "Total de Pacientes",
      value: patients.length,
      icon: Users,
      trend: { value: 12, isPositive: true },
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Parceiros Ativos",
      value: activePartners,
      icon: Building2,
      trend: { value: 8, isPositive: true },
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Sinistros Pendentes",
      value: pendingClaims.length,
      icon: Clock,
      trend: { value: 5, isPositive: false },
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Taxa de Aprovação",
      value: claims.length > 0 ? `${Math.round((approvedClaims / claims.length) * 100)}%` : '0%',
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  const getStatusBadge = (status: string, type: 'claim' | 'partner' | 'user' = 'claim') => {
    const statusConfig = {
      // Claims
      pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      approved: { label: "Aprovado", className: "bg-green-100 text-green-800 border-green-200" },
      rejected: { label: "Rejeitado", className: "bg-red-100 text-red-800 border-red-200" },
      // Partners/Users
      active: { label: "Ativo", className: "bg-green-100 text-green-800 border-green-200" },
      inactive: { label: "Inativo", className: "bg-gray-100 text-gray-800 border-gray-200" },
      suspended: { label: "Suspenso", className: "bg-red-100 text-red-800 border-red-200" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
      { label: status, className: "bg-gray-100 text-gray-800 border-gray-200" };
    
    return (
      <Badge variant="outline" className={`${config.className} font-medium`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Bem-vindo de volta, {user?.fullName || user?.username}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="glass-card hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.trend && (
                      <div className="flex items-center gap-1 text-sm">
                        {stat.trend.isPositive ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        )}
                        <span className={stat.trend.isPositive ? "text-green-600" : "text-red-600"}>
                          {stat.trend.value}%
                        </span>
                        <span className="text-muted-foreground">vs mês anterior</span>
                      </div>
                    )}
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-full`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Claims */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Sinistros Recentes</CardTitle>
            <Link to="/admin/claims">
              <Button variant="ghost" size="sm" className="text-primary">
                Ver todos
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {claims.slice(0, 5).map((claim: any) => (
                  <div key={claim.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">#{claim.id}</p>
                        <span className="text-muted-foreground text-sm">•</span>
                        <p className="text-sm text-muted-foreground">{claim.type}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(claim.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      {getStatusBadge(claim.status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" />
                            Analisar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Partners */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Parceiros Recentes</CardTitle>
            <Link to="/admin/partners">
              <Button variant="ghost" size="sm" className="text-primary">
                Ver todos
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {partners.slice(0, 5).map((partner: any) => (
                  <div key={partner.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm">{partner.businessName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{partner.businessType}</p>
                      <p className="text-xs text-muted-foreground">
                        Desde {format(new Date(partner.createdAt), "MMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      {getStatusBadge(partner.status, 'partner')}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/users">
              <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                <Users className="mr-2 h-4 w-4" />
                Gerenciar Usuários
              </Button>
            </Link>
            <Link to="/admin/partners">
              <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                <Building2 className="mr-2 h-4 w-4" />
                Gerenciar Parceiros
              </Button>
            </Link>
            <Link to="/admin/claims">
              <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                <FileText className="mr-2 h-4 w-4" />
                Analisar Sinistros
              </Button>
            </Link>
            <Link to="/admin/analytics">
              <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                <TrendingUp className="mr-2 h-4 w-4" />
                Ver Relatórios
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;