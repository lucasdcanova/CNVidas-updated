import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, CreditCard, User, Users, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getSubscriptionPlans, getUserSubscription } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import CheckoutModal from "@/components/checkout/checkout-modal-fix";

// Definição do tipo de plano de assinatura
interface SubscriptionPlan {
  id: number;
  name: string;
  displayName?: string;
  description: string;
  price: number;
  features: string[];
  planType: "free" | "basic" | "premium" | "basic_family" | "premium_family" | "ultra" | "ultra_family";
  isFamily?: boolean;
  maxDependents?: number;
  insuranceCoverageAmount?: number;
  specialistDiscount?: number;
}

interface UserSubscription {
  id: number;
  userId: number;
  planId: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan?: SubscriptionPlan;
}

const FirstSubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showFamilyPlans, setShowFamilyPlans] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{id: number, name: string, price: string} | null>(null);
  const [hasAttemptedLeave, setHasAttemptedLeave] = useState(false);

  // Verificar se o usuário tem perfil de paciente
  useEffect(() => {
    if (user && user.role !== 'patient') {
      // Se não for paciente, redirecionar para o dashboard
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  // Buscar planos de assinatura disponíveis
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["/api/subscription/plans"],
    queryFn: getSubscriptionPlans,
  });

  // Buscar assinatura atual do usuário
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/subscription/current"],
    queryFn: getUserSubscription,
    enabled: !!user?.id,
  });

  // Se o usuário já tiver uma assinatura ativa, redirecioná-lo para o dashboard
  useEffect(() => {
    if (userSubscription && userSubscription.status === "active") {
      console.log("Usuário já tem assinatura ativa, redirecionando para o dashboard...");
      // Usar redirecionamento direto do navegador para garantir que funcione
      window.location.href = '/dashboard';
    }
  }, [userSubscription]);

  // Remover o impedimento que bloqueia o usuário de sair da página
  // Isso estava causando problemas no redirecionamento para o dashboard
  useEffect(() => {
    console.log("Status da assinatura:", userSubscription?.status);
    // Não adicionar nenhum bloqueio de navegação
  }, [userSubscription]);

  const isLoading = plansLoading || subscriptionLoading;

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    // Se for o plano gratuito, redireciona direto para o dashboard
    if (plan.planType === 'free' || plan.name === 'Gratuito') {
      toast({
        title: "Plano gratuito selecionado",
        description: "Você será redirecionado para o dashboard.",
      });
      setTimeout(() => {
        setLocation('/dashboard');
      }, 1000);
      return;
    }
    
    // Para planos pagos, usamos o modal de checkout com métodos brasileiros
    toast({
      title: "Preparando checkout...",
      description: "O formulário de pagamento será exibido em instantes.",
    });
    
    // Definir o plano selecionado para abrir o modal de checkout
    setSelectedPlan({
      id: plan.id, 
      name: plan.displayName || plan.name,
      price: `R$${plan.price.toFixed(2)}`
    });
    setCheckoutOpen(true);
  };
  
  // Função para agrupar e filtrar os planos com base na seleção (individual/familiar)
  const getFilteredAndGroupedPlans = () => {
    if (!plans) return [];
    
    // Primeiro, vamos agrupar os planos por tipo (básico, premium, ultra)
    const planGroups: Record<string, SubscriptionPlan[]> = {};
    
    plans.forEach((plan: SubscriptionPlan) => {
      // Extrair o tipo base do plano (remover _family se existir)
      const baseType = plan.planType.replace('_family', '');
      if (!planGroups[baseType]) {
        planGroups[baseType] = [];
      }
      planGroups[baseType].push(plan);
    });
    
    // Para cada grupo, selecionar o plano individual ou familiar com base no toggle
    const result: SubscriptionPlan[] = [];
    Object.entries(planGroups).forEach(([type, planGroup]) => {
      if (planGroup.length > 0) {
        const plan = planGroup.find(p => p.isFamily === showFamilyPlans) || planGroup[0];
        result.push(plan);
      }
    });
    
    // Definir a ordem personalizada dos planos: básico, premium, ultra e gratuito por último
    const planOrder = {
      'basic': 1,
      'premium': 2,
      'ultra': 3,
      'free': 4
    };
    
    return result.sort((a, b) => {
      const baseTypeA = a.planType.replace('_family', '');
      const baseTypeB = b.planType.replace('_family', '');
      
      return (planOrder[baseTypeA as keyof typeof planOrder] || 99) - 
             (planOrder[baseTypeB as keyof typeof planOrder] || 99);
    });
  };

  // Função para fechar o modal de checkout
  const handleCloseCheckout = () => {
    setCheckoutOpen(false);
    setSelectedPlan(null);
  };

  const handlePlanSelected = () => {
    // O plano foi selecionado com sucesso, redirecionar para o dashboard
    toast({
      title: "Plano selecionado com sucesso!",
      description: "Você será redirecionado para o dashboard.",
    });
    setTimeout(() => {
      setLocation('/dashboard');
    }, 1500);
  };

  // Função para lidar com tentativa de sair sem selecionar um plano
  const handleTryLeave = () => {
    setHasAttemptedLeave(true);
    toast({
      title: "Atenção",
      description: "Por favor, selecione um plano antes de continuar.",
      variant: "destructive",
    });
    
    setTimeout(() => setHasAttemptedLeave(false), 3000);
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="flex flex-col items-center justify-center flex-1 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-center text-muted-foreground">Carregando planos disponíveis...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-muted">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <h1 className="text-4xl font-bold mr-2">Bem-vindo ao</h1>
              <img 
                src="/assets/cnvidas-logo-transparent.png" 
                alt="CN Vidas" 
                style={{ height: "100px" }} 
                className="w-auto" 
              />
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Para começar a usar nossa plataforma, por favor selecione um dos planos abaixo que melhor atenda às suas necessidades.
            </p>
            
            {hasAttemptedLeave && (
              <div className="mt-6 bg-destructive/10 border border-destructive p-4 rounded-lg mx-auto max-w-md flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-destructive font-medium">É necessário selecionar um plano para continuar.</p>
              </div>
            )}
          </div>
          
          {/* Toggle para planos individuais/familiares */}
          <div className="flex items-center justify-center space-x-2 mb-12 bg-white p-4 rounded-lg shadow-sm mx-auto max-w-md">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-primary" />
              <Label htmlFor="family-toggle" className={!showFamilyPlans ? "font-semibold text-base" : "text-base"}>Individual</Label>
            </div>
            <Switch 
              id="family-toggle" 
              checked={showFamilyPlans} 
              onCheckedChange={setShowFamilyPlans} 
            />
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <Label htmlFor="family-toggle" className={showFamilyPlans ? "font-semibold text-base" : "text-base"}>Familiar</Label>
            </div>
          </div>

          {/* Lista de planos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans && getFilteredAndGroupedPlans()
              .filter(plan => plan.planType !== 'free' && plan.name !== 'Gratuito') // Remover o plano gratuito da listagem
              .map((plan: SubscriptionPlan) => (
              <Card 
                key={plan.id} 
                className={`overflow-hidden transform transition-all duration-300 hover:shadow-xl ${
                  plan.planType === 'ultra' || plan.planType === 'ultra_family' 
                    ? 'hover:-translate-y-2 border-violet-400 shadow-lg shadow-violet-300 relative ring-2 ring-violet-400/70 scale-105' : 
                  plan.planType === 'premium' || plan.planType === 'premium_family' 
                    ? 'hover:-translate-y-1 border-amber-300' :
                  plan.planType === 'basic' || plan.planType === 'basic_family' 
                    ? 'hover:-translate-y-1 border-emerald-300' : ''
                }`}
              >
                <CardHeader className={`${
                  plan.planType === 'ultra' || plan.planType === 'ultra_family'
                    ? 'bg-purple-600 text-white' 
                  : plan.planType === 'premium' || plan.planType === 'premium_family'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                  : plan.planType === 'basic' || plan.planType === 'basic_family'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' 
                  : ''
                }`}>
                  <CardTitle className={
                    plan.planType === 'ultra' || plan.planType === 'premium' || plan.planType === 'basic' ||
                    plan.planType === 'ultra_family' || plan.planType === 'premium_family' || plan.planType === 'basic_family'
                      ? 'text-white flex items-center text-2xl' 
                      : 'flex items-center text-2xl'
                  }>
                    {plan.displayName || plan.name}
                  </CardTitle>
                  <CardDescription className={
                    plan.planType === 'ultra' || plan.planType === 'premium' || plan.planType === 'basic' ||
                    plan.planType === 'ultra_family' || plan.planType === 'premium_family' || plan.planType === 'basic_family'
                      ? 'text-white/90' 
                      : ''
                  }>
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-6">
                    <span className="text-3xl font-bold">
                      {plan.price ? `R$ ${plan.price.toFixed(2)}` : "Gratuito"}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground">/mês</span>}
                  </div>

                  <ul className="space-y-3 my-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full ${
                      plan.planType === 'ultra' || plan.planType === 'ultra_family'
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : ''
                    }`} 
                    onClick={() => handleSelectPlan(plan)}
                  >
                    Escolher Este Plano
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          {/* Link para continuar com plano gratuito */}
          <div className="text-center mt-8">
            <p className="text-gray-800 text-lg">
              Não desejo assinar nenhum plano no momento, <a 
                href="#" 
                className="text-primary font-medium hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  
                  // Mostrar notificação
                  toast({
                    title: "Plano gratuito selecionado",
                    description: "Você será redirecionado para o dashboard.",
                  });
                  
                  // Criar uma requisição ao backend para aplicar o plano gratuito
                  // e então redirecionar o usuário para o dashboard
                  apiRequest("POST", "/api/subscription/select", { planId: 4 })
                    .then(() => {
                      console.log("Plano gratuito selecionado com sucesso, redirecionando...");
                      // Usar window.location normalmente para evitar o erro de segurança
                      window.location.href = "/dashboard";
                    })
                    .catch(error => {
                      console.error("Erro ao selecionar plano gratuito:", error);
                      // Em caso de erro, ainda tentar redirecionar
                      window.location.href = "/dashboard";
                    });
                }}
              >
                continuar
              </a> como plano gratuito.
            </p>
          </div>

          {/* Informação adicional */}
          <div className="mt-12 bg-white p-6 rounded-lg shadow-sm max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Importante</h2>
            <p className="text-muted-foreground mb-4">
              Você deve selecionar um plano para continuar usando a plataforma CN Vidas. Este é um passo obrigatório 
              para novos usuários pacientes.
            </p>
            <p className="text-muted-foreground">
              Se você tiver alguma dúvida sobre os planos disponíveis, entre em contato com nosso suporte através 
              do e-mail <a href="mailto:suporte@cnvidas.com.br" className="text-primary hover:underline">suporte@cnvidas.com.br</a>.
            </p>
          </div>
        </div>
      </main>

      {/* Modal de Checkout */}
      {selectedPlan && (
        <CheckoutModal
          isOpen={checkoutOpen}
          onClose={handleCloseCheckout}
          planId={selectedPlan.id}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
          onSuccess={handlePlanSelected}
        />
      )}
    </div>
  );
};

export default FirstSubscriptionPage;