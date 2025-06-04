import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { RouteComponentProps } from "wouter";

type ProtectedRouteProps = {
  path: string;
  component: React.ComponentType<RouteComponentProps>;
  allowedRoles?: string[];
};

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [needsSubscription, setNeedsSubscription] = useState<boolean | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  
  // Verificar se o caminho atual já é first-subscription para evitar loop
  const isFirstSubscriptionPath = path === "/first-subscription";
  const isSubscriptionSuccess = path === "/subscription-success";
  
  // Verificar status da assinatura do usuário se for um paciente
  useEffect(() => {
    const checkSubscription = async () => {
      if (user?.role === "patient" && !isFirstSubscriptionPath && !isSubscriptionSuccess) {
        setCheckingSubscription(true);
        
        try {
          const response = await apiRequest("GET", "/api/subscription/current");
          const data = await response.json();
          
          // Verificar se o usuário tem um plano ativo
          const hasActivePlan = data && data.status === "active";
          setNeedsSubscription(!hasActivePlan);
        } catch (error) {
          // Em caso de erro, considerar que precisa de assinatura
          setNeedsSubscription(true);
        } finally {
          setCheckingSubscription(false);
        }
      } else {
        setNeedsSubscription(false);
      }
    };
    
    if (user) {
      checkSubscription();
    }
  }, [user, isFirstSubscriptionPath, isSubscriptionSuccess]);

  if (isLoading || checkingSubscription) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Route path={path}>
        <Redirect to="/dashboard" />
      </Route>
    );
  }
  
  // Verificar se é um paciente novo que precisa escolher um plano
  if (user.role === "patient" && needsSubscription && !isFirstSubscriptionPath && !isSubscriptionSuccess) {
    return (
      <Route path={path}>
        <Redirect to="/first-subscription" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
