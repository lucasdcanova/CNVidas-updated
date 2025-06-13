import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Loader2 } from "lucide-react";
import PartnerDashboard from "@/components/dashboards/partner-dashboard";
import { PartnerOnboardingGuard } from "@/components/partner/partner-onboarding-guard";

export default function PartnerDashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== "partner") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <h1 className="text-2xl font-bold">Acesso Não Autorizado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <PartnerOnboardingGuard>
      <DashboardLayout>
        <PartnerDashboard />
      </DashboardLayout>
    </PartnerOnboardingGuard>
  );
}