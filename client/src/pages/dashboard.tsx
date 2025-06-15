import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import PatientDashboard from "@/components/dashboards/patient-dashboard";
import PartnerDashboard from "@/components/dashboards/partner-dashboard";
import AdminDashboard from "@/components/dashboards/admin-dashboard";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserSubscription } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isFirstLogin, setIsFirstLogin] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  
  // Invalidar cache da assinatura quando o componente montar
  useEffect(() => {
    if (user?.role === "patient") {
      console.log("🔄 Dashboard montado - invalidando cache de assinatura");
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
    }
  }, []); // Executar apenas na montagem
  
  // Buscar assinatura atual do usuário para verificar se é primeiro login
  const { data: userSubscription, isLoading: subscriptionLoading, isError, refetch } = useQuery({
    queryKey: ["/api/subscription/current"],
    queryFn: getUserSubscription,
    enabled: !!user?.id && user?.role === "patient",
    staleTime: 0, // Sempre considerar os dados como desatualizados
    gcTime: 0, // Não manter cache (anteriormente cacheTime)
    refetchOnMount: "always", // Sempre buscar dados novos ao montar
    refetchOnWindowFocus: true, // Buscar novos dados quando a janela ganhar foco
  });
  
  // Verificar se é o primeiro login de um paciente e redirecionar para seleção de plano obrigatória
  useEffect(() => {
    // Só processar para pacientes
    if (user?.role !== "patient") {
      setIsFirstLogin(false);
      return;
    }

    // Se está carregando ou teve erro, não fazer nada ainda
    if (subscriptionLoading || isError) {
      return;
    }

    // Se chegou aqui, temos os dados da assinatura
    if (userSubscription !== undefined) {
      console.log("🔍 Dashboard - userSubscription:", userSubscription);
      console.log("🔍 Dashboard - User status:", user.subscriptionStatus);
      console.log("🔍 Dashboard - Verificando no momento:", new Date().toISOString());
      
      // Se o status do usuário é 'active' E tem assinatura válida, não fazer redirecionamento
      if (user.subscriptionStatus === 'active' && userSubscription && userSubscription.status === 'active') {
        console.log("✅ Dashboard - Usuário tem status ativo confirmado, permanecendo no dashboard");
        setIsFirstLogin(false);
        return;
      }
      
      // Se não tem assinatura alguma (novo usuário), redirecionar para first-subscription
      if (!userSubscription || userSubscription === null) {
        console.log("🆕 Dashboard - Novo usuário sem assinatura, redirecionando para first-subscription");
        setLocation('/first-subscription');
        return;
      }
      
      // Se o status é pendente E não veio recentemente da página de ativação
      const planActivated = sessionStorage.getItem('plan-activated') === 'true';
      if (user.subscriptionStatus === 'pending' && !planActivated) {
        console.log('⏳ Dashboard - Status pendente detectado, redirecionando para ativação...');
        setLocation('/plan-activation');
        return;
      }
      
      // Não redirecionar baseado em flag de pagamento - deixar a página de ativação gerenciar isso
      
      // Verificar se tem assinatura e se está ativa
      // userSubscription pode ser null se o usuário não tem assinatura
      const hasActiveSubscription = userSubscription !== null && 
                                   userSubscription.status === "active";
      
      console.log("🔍 Dashboard - Status da assinatura:", userSubscription?.status);
      console.log("🔍 Dashboard - Tem assinatura ativa?", hasActiveSubscription);
      console.log("🔍 Dashboard - Plano:", userSubscription?.plan?.name);
      
      setIsFirstLogin(!hasActiveSubscription);
      
      // Verificar se já processamos este usuário recentemente
      const lastCheck = sessionStorage.getItem('subscription-check-timestamp');
      const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      // Se verificamos há menos de 5 minutos e tinha assinatura ativa, não redirecionar
      if (now - lastCheckTime < fiveMinutes) {
        const lastStatus = sessionStorage.getItem('subscription-check-status');
        if (lastStatus === 'active') {
          console.log("⏱️ Dashboard - Verificação recente encontrada, usuário tem assinatura ativa");
          return;
        }
      }
      
      // Salvar o status atual
      sessionStorage.setItem('subscription-check-timestamp', now.toString());
      sessionStorage.setItem('subscription-check-status', hasActiveSubscription ? 'active' : 'inactive');
      
      // Só redirecionar se realmente não tiver assinatura ativa
      const currentPath = window.location.pathname;
      const comingFromFirstSubscription = sessionStorage.getItem('coming-from-first-subscription') === 'true';
      const planActivatedFlag = sessionStorage.getItem('plan-activated') === 'true';
      
      // Verificar também se o status é explicitamente 'active' ou 'trialing'
      const hasValidSubscription = hasActiveSubscription || 
        (userSubscription && ['active', 'trialing', 'past_due'].includes(userSubscription.status));
      
      if (!hasValidSubscription && 
          currentPath !== '/first-subscription' && 
          !comingFromFirstSubscription &&
          !planActivatedFlag) {
        console.log("🔄 Dashboard - Redirecionando para first-subscription");
        setLocation('/first-subscription');
      } else if (hasValidSubscription) {
        console.log("✅ Dashboard - Usuário tem assinatura válida, permanecendo no dashboard");
        // Limpar flags antigas se existirem
        sessionStorage.removeItem('coming-from-first-subscription');
        // Manter plan-activated por um tempo para evitar loops
        const planActivatedTime = sessionStorage.getItem('plan-activated-time');
        if (planActivatedTime) {
          const activatedAt = parseInt(planActivatedTime);
          const tenMinutes = 10 * 60 * 1000;
          if (Date.now() - activatedAt > tenMinutes) {
            sessionStorage.removeItem('plan-activated');
            sessionStorage.removeItem('plan-activated-time');
          }
        }
      } else if (comingFromFirstSubscription || planActivatedFlag) {
        console.log("⚠️ Dashboard - Usuário vindo de ativação/first-subscription, evitando loop");
        // Não limpar as flags imediatamente para evitar loops
      }
    }
  }, [user, userSubscription, subscriptionLoading, isError, setLocation]);

  // Choose dashboard based on user role
  const renderDashboard = () => {
    if (!user) return null;
    
    // Mostrar carregamento enquanto verifica o status da assinatura para pacientes
    if (user.role === "patient" && (isFirstLogin === null || subscriptionLoading)) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Verificando assinatura...</span>
        </div>
      );
    }

    switch (user.role) {
      case "admin":
        return <AdminDashboard />;
      case "partner":
        return <PartnerDashboard />;
      case "patient":
      default:
        return <PatientDashboard />;
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      {renderDashboard()}
    </DashboardLayout>
  );
};

export default Dashboard;
