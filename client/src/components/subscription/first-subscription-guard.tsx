import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getUserSubscription } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import FirstSubscriptionPage from "@/pages/first-subscription";

export default function FirstSubscriptionGuard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [canAccess, setCanAccess] = useState<boolean | null>(null);

  // Buscar assinatura atual do usuário
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/subscription/current"],
    queryFn: getUserSubscription,
    enabled: !!user?.id,
  });

  useEffect(() => {
    // Se ainda está carregando, aguardar
    if (subscriptionLoading) {
      return;
    }

    // Se o usuário não é paciente, redirecionar
    if (user && user.role !== 'patient') {
      setCanAccess(false);
      setLocation('/dashboard');
      return;
    }

    // Se tem assinatura ativa, redirecionar
    if (userSubscription && userSubscription.status === 'active') {
      console.log("🚫 FirstSubscriptionGuard - Bloqueando acesso: usuário já tem plano ativo");
      setCanAccess(false);
      setLocation('/dashboard');
      return;
    }

    // Permitir acesso apenas se não tem assinatura ativa
    setCanAccess(true);
  }, [user, userSubscription, subscriptionLoading, setLocation]);

  // Mostrar loading enquanto verifica
  if (canAccess === null || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Verificando assinatura...</span>
      </div>
    );
  }

  // Se não pode acessar, já foi redirecionado
  if (!canAccess) {
    return null;
  }

  // Se pode acessar, renderizar a página
  return <FirstSubscriptionPage />;
}