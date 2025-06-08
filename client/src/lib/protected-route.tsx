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
  
  // DESABILITADO: Verificação de assinatura movida para o dashboard para evitar conflitos
  useEffect(() => {
    // Sempre permitir acesso - o dashboard gerenciará os redirecionamentos de assinatura
    setNeedsSubscription(false);
  }, [user]);

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
  
  // DESABILITADO: Redirecionamento movido para o dashboard para evitar loops
  // if (user.role === "patient" && needsSubscription && !isFirstSubscriptionPath && !isSubscriptionSuccess) {
  //   return (
  //     <Route path={path}>
  //       <Redirect to="/first-subscription" />
  //     </Route>
  //   );
  // }

  return <Route path={path} component={Component} />;
}
