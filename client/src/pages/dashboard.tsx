import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import PatientDashboard from "@/components/dashboards/patient-dashboard";
import PartnerDashboard from "@/components/dashboards/partner-dashboard";
import AdminDashboard from "@/components/dashboards/admin-dashboard";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserSubscription } from "@/lib/api";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isFirstLogin, setIsFirstLogin] = useState<boolean | null>(null);
  
  // Buscar assinatura atual do usuário para verificar se é primeiro login
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/subscription/current"],
    queryFn: getUserSubscription,
    enabled: !!user?.id && user?.role === "patient",
  });
  
  // Verificar se é o primeiro login de um paciente e redirecionar para seleção de plano obrigatória
  useEffect(() => {
    if (user?.role === "patient" && !subscriptionLoading) {
      // Se não tiver assinatura ou se a assinatura estiver inativa, considerar primeiro login
      const needsSubscription = !userSubscription || userSubscription.status !== "active";
      setIsFirstLogin(needsSubscription);
      
      if (needsSubscription) {
        // Redirecionar para a página de seleção obrigatória de plano
        setLocation('/first-subscription');
      }
    } else {
      setIsFirstLogin(false);
    }
  }, [user, userSubscription, subscriptionLoading, setLocation]);

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
