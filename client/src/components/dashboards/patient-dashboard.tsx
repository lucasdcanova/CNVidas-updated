import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingAppointments, getServices, getRecentActivities } from "@/lib/api";
import StatusCard from "@/components/shared/status-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowRight, Calendar, Clock, MapPin, Phone, Star, Heart, Activity, Shield, Users, Stethoscope, Building2, CreditCard, FileText, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { getPlanColor, getPlanName } from "@/components/shared/plan-indicator";
import { useToast } from "@/hooks/use-toast";
import { Service, Notification, Partner } from "@/shared/types";
import logoFallback from "@/assets/logo_cn_vidas_white_bg.svg";

interface Activity {
  icon: string;
  title: string;
  description: string;
  date: Date;
}

interface Appointment {
  date: string;
  specialization: string;
  status: string;
  doctorName: string;
  type: string;
}

// Tipo auxiliar para garantir que profileImage existe
export type PartnerWithProfileImage = Partner & { profileImage?: string | null };

// Tipo auxiliar para serviços que podem vir com parceiro embutido
interface ServiceWithPartner extends Service {
  partner?: PartnerWithProfileImage;
}

// Função para obter a imagem do serviço com sistema de fallback
const getServiceImage = (service: ServiceWithPartner) => {
  // Primeiro tenta usar a imagem específica do serviço
  if (service.serviceImage) {
    return service.serviceImage;
  }
  
  // Se não tiver imagem do serviço, tenta usar a imagem do perfil do parceiro
  if (service.partner && service.partner.profileImage) {
    return service.partner.profileImage;
  }
  
  // Caso não tenha nenhuma imagem, retorna o logo do CN Vidas com fundo branco
  return logoFallback;
};

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Debug: Log user data
  React.useEffect(() => {
    console.log("🎯 PatientDashboard - User data:", user);
    console.log("🎯 PatientDashboard - Subscription Plan:", user?.subscriptionPlan);
    console.log("🎯 PatientDashboard - Subscription Status:", user?.subscriptionStatus);
  }, [user]);
  
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["/api/appointments/upcoming"],
    queryFn: getUpcomingAppointments,
  });
  

  
  const { data: featuredServices = [] } = useQuery({
    queryKey: ["/api/services"],
    queryFn: () => getServices(),
  });
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd", { locale: ptBR }).toUpperCase();
  };
  
  const formatMonth = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "MMM", { locale: ptBR }).toUpperCase();
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "HH:mm", { locale: ptBR });
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "ativo":
        return "bg-green-100 text-green-800";
      case "pending":
      case "pendente":
      case "em análise":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
      case "agendado":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
      case "confirmado":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  // Estado para controlar a exibição expandida das atividades
  const [showAllActivities, setShowAllActivities] = React.useState(false);

  // Buscar atividades recentes do usuário
  const { data: recentActivities = [], isLoading: isLoadingActivities, error: activitiesError } = useQuery({
    queryKey: ["/api/notifications/recent-activities"],
    queryFn: () => getRecentActivities(10),
    retry: 1,
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: false,
  });
  
  // Determinar quantas atividades mostrar com base no estado de expansão
  const displayedActivities = showAllActivities ? recentActivities : recentActivities.slice(0, 2);
  
  // Função para redirecionar para o WhatsApp do parceiro
  const handleContactPartner = (service: ServiceWithPartner) => {
    // Verifica se o serviço tem informações do parceiro
    if (service.partner && service.partner.id) {
      // Se existir o telefone do parceiro, abre o WhatsApp
      if (service.partner.phone && service.partner.phone.trim() !== '') {
        // Formatando o número para WhatsApp (removendo caracteres não numéricos)
        const phoneNumber = service.partner.phone.replace(/\D/g, '');
        console.log("Número formatado para WhatsApp:", phoneNumber);
        
        // Mensagem predefinida
        const message = encodeURIComponent(`Olá! Gostaria de obter mais informações sobre o serviço "${service.name}" oferecido pela CN Vidas.`);
        // Abrindo o WhatsApp em uma nova aba
        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
      } else {
        // Como alternativa, usamos o número padrão da CN Vidas
        console.log("Número do parceiro não encontrado, usando número padrão");
        const defaultPhone = "51999862303"; // Número da CN Vidas
        const message = encodeURIComponent(`Olá! Gostaria de obter mais informações sobre o serviço "${service.name}" oferecido pelo parceiro ${service.partner.businessName || 'parceiro'}.`);
        window.open(`https://wa.me/${defaultPhone}?text=${message}`, '_blank');
      }
    } else {
      toast({
        title: "Informações incompletas",
        description: "Não foi possível obter as informações de contato deste parceiro.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome card */}
      <div className="mb-8 relative">
        <div className="bg-gradient-to-r from-white via-blue-50/30 to-primary/5 rounded-2xl border border-primary/10 shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden">
          <div className="relative">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/[0.02] to-primary/[0.05]"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full transform translate-x-32 -translate-y-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-400/5 to-transparent rounded-full transform -translate-x-24 translate-y-24"></div>
            
            <div className="relative z-10 p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left side - Welcome message */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 bg-primary/70 rounded-full"></div>
                      <div className="w-1 h-1 bg-primary/40 rounded-full"></div>
                    </div>
                    <h1 className="text-3xl font-light text-gray-900">
                      Olá, <span className="font-semibold text-primary bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">{user?.fullName}</span>
                    </h1>
                  </div>
                  
                  <div className="ml-8">
                    <p className="text-gray-600 text-lg font-light">
                      Sua plataforma de saúde digital
                    </p>
                  </div>
                  
                  <div className="ml-8 flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span>Sistema online</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons text-sm text-primary">verified</span>
                      <span>Plataforma segura</span>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Quick stats */}
                <div className="flex md:flex-col gap-4 md:gap-3">
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40 shadow-sm hover:shadow-md transition-all duration-300 min-w-[120px]">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {user?.subscriptionPlan?.includes('premium') || user?.subscriptionPlan?.includes('ultra') ? '∞' : 
                         user?.subscriptionPlan?.includes('basic') ? user?.emergencyConsultationsLeft || 0 : '0'}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Consultas disponíveis</div>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40 shadow-sm hover:shadow-md transition-all duration-300 min-w-[120px]">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {user?.subscriptionStatus === 'active' ? '✓' : '○'}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Status da conta</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <StatusCard
          icon="card_membership"
          iconBgColor={user?.subscriptionPlan ? 
            `bg-gradient-to-br ${getPlanColor(user.subscriptionPlan).gradient}` : 
            "bg-gradient-to-br from-blue-400 to-blue-600"}
          iconColor="text-white"
          title="Status da Assinatura"
          value={`Plano ${user?.subscriptionPlan ? getPlanName(user.subscriptionPlan) : 'Gratuito'}`}
          status={{
            label: user?.subscriptionStatus === 'active' ? "Ativo" : "Inativo",
            color: user?.subscriptionStatus === 'active' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }}
          footer={
            user?.subscriptionPlan?.includes('basic') ? 
              `${user?.emergencyConsultationsLeft || 0} consultas de emergência restantes` : 
              user?.subscriptionPlan?.includes('premium') || user?.subscriptionPlan?.includes('ultra') ? 
                "Consultas de emergência ilimitadas" : 
                undefined
          }
          linkText="Ver detalhes"
          linkUrl="/subscription"
          planType={user?.subscriptionPlan || undefined}
        />
        
        <StatusCard
          icon="videocam"
          iconBgColor={user?.subscriptionPlan ? 
            `bg-gradient-to-br ${getPlanColor(user.subscriptionPlan).gradient}` : 
            "bg-gradient-to-br from-blue-400 to-blue-600"}
          iconColor="text-white"
          title="Consultas de Emergência"
          value={user?.subscriptionPlan?.includes('premium') || user?.subscriptionPlan?.includes('ultra') ? 'Ilimitadas' :
                 user?.subscriptionPlan?.includes('basic') ? `${user?.emergencyConsultationsLeft || 0}/2 disponíveis` :
                 'Não disponível'}
          status={user?.subscriptionPlan?.includes('basic') || user?.subscriptionPlan?.includes('premium') || user?.subscriptionPlan?.includes('ultra') ? {
            label: user?.subscriptionPlan?.includes('family') ? "Plano Familiar" : "Plano Individual",
            color: user?.subscriptionPlan?.includes('family') ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
          } : undefined}
          footer={user?.subscriptionPlan?.includes('basic') ? 
            `Seu plano ${getPlanName(user?.subscriptionPlan || '')} inclui 2 consultas de emergência/mês` : 
            user?.subscriptionPlan?.includes('premium') || user?.subscriptionPlan?.includes('ultra') ? 
            `Seu plano ${getPlanName(user?.subscriptionPlan || '')} inclui consultas de emergência ilimitadas` : 
            "Faça upgrade para ter acesso a consultas de emergência"}
          linkText="Agendar agora"
          linkUrl="/telemedicine"
          planType={user?.subscriptionPlan || undefined}
        />
      </div>

      {/* Recent activity and upcoming appointments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Recent Activity */}
        <Card className="overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-gray-100/30 flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-800">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingActivities ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Carregando atividades...</p>
              </div>
            ) : activitiesError ? (
              <div className="p-6 text-center">
                <div className="text-red-500 mb-2">
                  <span className="material-icons text-2xl">error_outline</span>
                </div>
                <p className="text-sm text-gray-500">Erro ao carregar atividades recentes</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-gray-100/50">
                  {displayedActivities.length > 0 ? (
                    displayedActivities.map((activity: any, index: number) => (
                      <li key={activity.id || index} className="p-5 hover:bg-white/30 transition-colors duration-200">
                        <div className="flex">
                          <div className="mr-4 flex-shrink-0">
                            <span className={`inline-flex items-center justify-center h-10 w-10 rounded-xl shadow-sm ring-2 ring-white/30 ${
                              activity.type === 'appointment' ? 'bg-gradient-to-br from-green-400/80 to-green-600/80' :
                              activity.type === 'claim' ? 'bg-gradient-to-br from-orange-400/80 to-orange-600/80' :
                              activity.type === 'subscription' ? 'bg-gradient-to-br from-purple-400/80 to-purple-600/80' :
                              activity.type === 'payment' ? 'bg-gradient-to-br from-red-400/80 to-red-600/80' :
                              'bg-gradient-to-br from-blue-400/80 to-blue-600/80'
                            }`}>
                              <span className="material-icons text-white text-lg">{activity.icon}</span>
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{activity.description}</p>
                              </div>
                              {activity.status && (
                                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                                  activity.status === 'completed' || activity.status === 'aprovado' || activity.status === 'active' ? 
                                    'bg-green-100 text-green-800' :
                                  activity.status === 'scheduled' || activity.status === 'em análise' ? 
                                    'bg-yellow-100 text-yellow-800' :
                                  activity.status === 'cancelled' || activity.status === 'rejeitado' ? 
                                    'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                  {activity.status === 'completed' ? 'Concluído' :
                                   activity.status === 'scheduled' ? 'Agendado' :
                                   activity.status === 'em análise' ? 'Em análise' :
                                   activity.status === 'aprovado' ? 'Aprovado' :
                                   activity.status === 'rejeitado' ? 'Rejeitado' :
                                   activity.status === 'active' ? 'Ativo' :
                                   activity.status}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <p className="text-xs text-gray-400 flex items-center">
                                <span className="material-icons text-gray-400 mr-1 text-xs">schedule</span>
                                {new Date(activity.date).toLocaleDateString('pt-BR', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {activity.link && activity.link !== '/' && (
                                <Link href={activity.link}>
                                  <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 h-6 px-2">
                                    Ver detalhes
                                    <span className="material-icons ml-1 text-xs">arrow_forward</span>
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="py-10 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="rounded-full bg-blue-100/80 p-3 mb-3">
                          <span className="material-icons text-blue-500 text-2xl">timeline</span>
                        </div>
                        <p className="text-base text-gray-600 mb-1">Nenhuma atividade recente.</p>
                        <p className="text-sm text-gray-500">Suas atividades e atualizações aparecerão aqui conforme você usa a plataforma.</p>
                      </div>
                    </li>
                  )}
                </ul>
                {recentActivities.length > 2 && (
                  <div className="p-4 text-center border-t border-gray-100/30">
                    <Button 
                      variant="ghost" 
                      className="text-primary hover:text-primary/80 hover:bg-primary/10"
                      onClick={() => setShowAllActivities(!showAllActivities)}
                    >
                      {showAllActivities ? "Mostrar menos" : "Expandir"}
                      <span className="material-icons ml-1 text-sm">
                        {showAllActivities ? "expand_less" : "expand_more"}
                      </span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-gray-100/30 flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-800">Consultas Agendadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100/50">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.slice(0, 3).map((appointment: Appointment, index: number) => (
                  <li key={index} className="p-5 hover:bg-white/30 transition-colors duration-200">
                    <div className="flex items-start">
                      <div className="mr-4 flex-shrink-0">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-blue-100 border border-blue-200 p-3 w-14 h-14 shadow-sm">
                          <span className="text-sm font-bold text-blue-600">
                            {formatDate(appointment.date)}
                          </span>
                          <span className="text-xs font-medium text-blue-500">
                            {formatMonth(appointment.date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-800">{appointment.specialization}</p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-medium rounded-full backdrop-blur-sm ${
                              appointment.status === "scheduled" ? "bg-gradient-to-r from-blue-500/20 to-blue-700/20 text-blue-700 border border-blue-300/30" : 
                              appointment.status === "confirmed" ? "bg-gradient-to-r from-green-500/20 to-green-700/20 text-green-700 border border-green-300/30" : 
                              getStatusColor(appointment.status)
                            }`}>
                              {appointment.status === "scheduled" ? "Agendada" : 
                               appointment.status === "confirmed" ? "Confirmada" : 
                               appointment.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{appointment.doctorName}</p>
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <span className="material-icons text-gray-500 mr-1 text-sm">schedule</span>
                          {formatTime(appointment.date)}
                          <span className="mx-2">•</span>
                          <span className="material-icons text-gray-500 mr-1 text-sm">
                            {appointment.type === "telemedicine" ? "videocam" : "medical_services"}
                          </span>
                          {appointment.type === "telemedicine" ? "Teleconsulta" : "Presencial"}
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        <button type="button" className="rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-colors duration-200">
                          <span className="material-icons text-gray-500">more_vert</span>
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="py-10 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="rounded-full bg-blue-100/80 p-3 mb-3">
                      <span className="material-icons text-blue-500 text-2xl">calendar_today</span>
                    </div>
                    <p className="text-base text-gray-600 mb-1">Você não tem consultas agendadas.</p>
                    <p className="text-sm text-gray-500 mb-4">Agende sua primeira consulta agora mesmo!</p>
                  </div>
                </li>
              )}
            </ul>
            <div className="p-4 border-t border-gray-100/30 flex justify-center">
              <Link href="/telemedicine">
                <Button className="rounded-full bg-gradient-to-r from-primary to-primary/90 shadow-md hover:shadow-lg transition-all">
                  <span className="material-icons mr-2 text-sm">add</span>
                  Nova Consulta
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Featured Services */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-800">Serviços em Destaque</h2>
          <div 
            className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 cursor-pointer transition-colors"
            onClick={() => window.location.href = "/services"}
          >
            Ver todos
            <span className="material-icons ml-1 text-sm">arrow_forward</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredServices.slice(0, 3).map((service: ServiceWithPartner, index: number) => (
            <Card key={index} className="overflow-hidden hover:shadow-lg hover:translate-y-[-2px] transition-all duration-300 h-full flex flex-col">
              <div className="relative">
                <img 
                  src={getServiceImage(service)}
                  alt={service.name} 
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    // Se falhar ao carregar a imagem, mostre um plano de fundo genérico
                    e.currentTarget.src = logoFallback;
                  }}
                />
                <div className="absolute top-0 right-0 mt-3 mr-3">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100/90 backdrop-blur-sm text-green-800 shadow-sm border border-green-200/50">
                    {service.discountPercentage}% OFF
                  </span>
                </div>
              </div>
              
              <CardContent className="p-5 flex-grow">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-1">{service.name}</h3>
                <p className="text-sm text-gray-600 mb-5 line-clamp-2">{service.description}</p>
                
                <div className="flex items-end justify-between mt-auto">
                  <div>
                    {service.regularPrice ? (
                      <p className="text-xs text-gray-500 line-through">
                        R$ {(service.regularPrice / 100).toFixed(2).replace('.', ',')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">Preço indisponível</p>
                    )}
                    {service.discountPrice ? (
                      <p className="text-lg font-bold text-primary">
                        R$ {(service.discountPrice / 100).toFixed(2).replace('.', ',')}
                      </p>
                    ) : (
                      <p className="text-lg font-bold text-primary">Consulte</p>
                    )}
                  </div>
                  <Button 
                    className="rounded-full px-4 flex items-center"
                    onClick={() => handleContactPartner(service)}
                  >
                    <span className="material-icons mr-1 text-sm">chat</span>
                    Entrar em Contato
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {featuredServices.length === 0 && (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="rounded-full bg-blue-100/80 p-3 mb-4">
                <span className="material-icons text-blue-500 text-2xl">medical_services</span>
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-1">Nenhum serviço disponível</h3>
              <p className="text-gray-500 mb-4">No momento não temos serviços em destaque</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
