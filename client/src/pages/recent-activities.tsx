import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRecentActivities } from "@/lib/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Search, 
  Filter, 
  Calendar,
  Clock,
  ChevronRight,
  Activity,
  CheckCircle,
  AlertCircle,
  Info,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import { getPlanName } from "@/components/shared/plan-indicator";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  icon: string;
  status: string;
  link?: string;
}

const RecentActivitiesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [limit, setLimit] = useState(20);

  // Buscar atividades recentes
  const { data: activities = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/notifications/recent-activities", limit],
    queryFn: () => getRecentActivities(limit),
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Filtrar atividades
  const filteredActivities = activities.filter((activity: Activity) => {
    const matchesSearch = activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || activity.type === filterType;
    return matchesSearch && matchesType;
  });

  // Função para obter cor do badge baseado no tipo
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'appointment': return 'bg-green-100 text-green-800 border-green-200';
      case 'claim': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'subscription': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'payment': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'qr_scan': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'checkout': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'dependent': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'profile': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Função para obter nome amigável do tipo
  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case 'appointment': return 'Consulta';
      case 'claim': return 'Sinistro';
      case 'subscription': return 'Assinatura';
      case 'payment': return 'Pagamento';
      case 'qr_scan': return 'QR Code';
      case 'checkout': return 'Compra';
      case 'dependent': return 'Dependente';
      case 'profile': return 'Perfil';
      default: return 'Sistema';
    }
  };

  // Função para obter ícone de status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
      case 'in_analysis':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'verified':
        return 'text-green-600';
      case 'pending':
      case 'in_analysis':
        return 'text-yellow-600';
      case 'cancelled':
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  // Função para processar a descrição e substituir nomes de planos
  const processDescription = (description: string): string => {
    // Lista de planos para substituir
    const planReplacements: Record<string, string> = {
      'ultra_family': 'Ultra Família',
      'premium_family': 'Premium Família',
      'basic_family': 'Básico Família',
      'ultra': 'Ultra',
      'premium': 'Premium',
      'basic': 'Básico',
      'free': 'Gratuito'
    };
    
    // Substituir cada plano na descrição
    let processedDescription = description;
    Object.entries(planReplacements).forEach(([key, value]) => {
      // Usar regex para substituir com word boundaries para evitar substituições parciais
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      processedDescription = processedDescription.replace(regex, value);
    });
    
    return processedDescription;
  };

  // Tipos únicos para o filtro
  const uniqueTypes = [...new Set(activities.map((activity: Activity) => activity.type))];

  return (
    <DashboardLayout>
      <Helmet>
        <title>Atividades Recentes | CN Vidas</title>
        <meta name="description" content="Acompanhe todas as suas atividades recentes na plataforma CN Vidas" />
      </Helmet>
      
      <div className="container px-4 py-6 mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-600" />
              Atividades Recentes
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Acompanhe todas as suas atividades e interações na plataforma
            </p>
          </div>
          
          <Button 
            onClick={() => refetch()} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar atividades..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={limit.toString()} onValueChange={(value) => setLimit(Number(value))}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 itens</SelectItem>
                  <SelectItem value="20">20 itens</SelectItem>
                  <SelectItem value="50">50 itens</SelectItem>
                  <SelectItem value="100">100 itens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Atividades */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner className="h-8 w-8" />
            <span className="ml-2 text-gray-600">Carregando atividades...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar atividades. Tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        ) : filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || filterType !== "all" ? "Nenhuma atividade encontrada" : "Nenhuma atividade ainda"}
              </h3>
              <p className="text-gray-600">
                {searchTerm || filterType !== "all" 
                  ? "Tente ajustar os filtros para ver mais resultados."
                  : "Suas atividades aparecerão aqui conforme você usar a plataforma."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity: Activity) => (
              <Card key={activity.id} className="hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Ícone */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                          <span className="material-icons text-blue-600 text-xl">
                            {activity.icon}
                          </span>
                        </div>
                      </div>
                      
                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {activity.title}
                          </h3>
                          <Badge className={`text-xs ${getTypeBadgeColor(activity.type)}`}>
                            {getTypeDisplayName(activity.type)}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {activity.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {format(new Date(activity.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(new Date(activity.date), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          
                          <div className={`flex items-center gap-1 ${getStatusColor(activity.status)}`}>
                            {getStatusIcon(activity.status)}
                            <span className="capitalize">
                              {activity.status === 'completed' ? 'Concluído' :
                               activity.status === 'pending' ? 'Pendente' :
                               activity.status === 'approved' ? 'Aprovado' :
                               activity.status === 'verified' ? 'Verificado' :
                               activity.status === 'cancelled' ? 'Cancelado' :
                               activity.status === 'rejected' ? 'Rejeitado' :
                               activity.status === 'in_analysis' ? 'Em análise' :
                               'Ativo'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Link para detalhes */}
                    {activity.link && (
                      <div className="flex-shrink-0 ml-4">
                        <Link href={activity.link}>
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estatísticas */}
        {filteredActivities.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredActivities.length}
                  </div>
                  <div className="text-sm text-gray-600">Total de atividades</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredActivities.filter((a: Activity) => 
                      ['completed', 'approved', 'verified'].includes(a.status)
                    ).length}
                  </div>
                  <div className="text-sm text-gray-600">Concluídas</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {filteredActivities.filter((a: Activity) => 
                      ['pending', 'in_analysis'].includes(a.status)
                    ).length}
                  </div>
                  <div className="text-sm text-gray-600">Pendentes</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {uniqueTypes.length}
                  </div>
                  <div className="text-sm text-gray-600">Tipos diferentes</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RecentActivitiesPage; 