import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  name: "free" | "basic" | "premium" | "basic_family" | "premium_family" | "ultra" | "ultra_family";
  displayName?: string;
  description?: string;
  price: number;
  features: string[];
  emergencyConsultations: string;
  specialistDiscount: number;
  insuranceCoverage: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showFamilyPlans, setShowFamilyPlans] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{id: number, name: string, price: string} | null>(null);
  const [hasAttemptedLeave, setHasAttemptedLeave] = useState(false);

  console.log("🔍 FirstSubscriptionPage - Location atual:", location);
  console.log("🔧 TESTE: FirstSubscriptionPage carregada às", new Date().toLocaleTimeString());

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

  // REMOVIDO: Redirecionamento automático que estava causando loop infinito
  // O dashboard é quem deve gerenciar os redirecionamentos de assinatura

  // Remover o impedimento que bloqueia o usuário de sair da página
  // Isso estava causando problemas no redirecionamento para o dashboard
  useEffect(() => {
    console.log("Status da assinatura:", userSubscription?.status);
    // Não adicionar nenhum bloqueio de navegação
  }, [userSubscription]);

  const isLoading = plansLoading || subscriptionLoading;

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    console.log("🔧 Selecionando plano:", plan.name);
    
    // Se for o plano gratuito, ativar o plano e redirecionar
    if (plan.name === 'free') {
      try {
        console.log("🔄 Ativando plano gratuito...");
        
        // Fazer requisição para ativar o plano gratuito
        const response = await apiRequest("POST", "/api/subscription/activate-free", {});
        
        if (response.ok) {
          const data = await response.json();
          console.log("✅ Plano gratuito ativado com sucesso!", data);
          
          // Atualizar a cache da assinatura para evitar redirecionamentos circulares
          if (data.subscription) {
            console.log("🔄 Atualizando cache da assinatura:", data.subscription);
            // Como a função getUserSubscription agora extrai o objeto diretamente,
            // vamos salvar o objeto de assinatura diretamente na cache
            queryClient.setQueryData(["/api/subscription/current"], data.subscription);
          }
          
          toast({
            title: "Plano Gratuito Ativado!",
            description: "Você será redirecionado para o dashboard.",
          });
          
          // Aguardar um momento para mostrar o toast e depois redirecionar
          setTimeout(() => {
            console.log("🔄 Redirecionando para dashboard...");
            window.location.href = "/dashboard";
          }, 1000);
        } else {
          throw new Error("Falha ao ativar plano gratuito");
        }
      } catch (error) {
        console.error("❌ Erro ao ativar plano gratuito:", error);
        toast({
          title: "Erro",
          description: "Não foi possível ativar o plano. Tente novamente.",
          variant: "destructive",
        });
      }
      return;
    }
    
    // Para planos pagos, usar o modal de checkout
    toast({
      title: "Preparando checkout...",
      description: "O formulário de pagamento será exibido em instantes.",
    });
    
    setSelectedPlan({
      id: plan.id, 
      name: plan.displayName || plan.name,
      price: `R$ ${(plan.price / 100).toFixed(2)}`
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
      const baseType = plan.name.replace('_family', '');
      if (!planGroups[baseType]) {
        planGroups[baseType] = [];
      }
      planGroups[baseType].push(plan);
    });
    
    // Para cada grupo, selecionar o plano individual ou familiar com base no toggle
    const result: SubscriptionPlan[] = [];
    Object.entries(planGroups).forEach(([type, planGroup]) => {
      if (planGroup.length > 0) {
        const plan = planGroup.find(p => (p.name.includes('_family')) === showFamilyPlans) || planGroup[0];
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
      const baseTypeA = a.name.replace('_family', '');
      const baseTypeB = b.name.replace('_family', '');
      
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {plans && getFilteredAndGroupedPlans()
              .map((plan: SubscriptionPlan) => (
              <Card 
                key={plan.id} 
                className={`overflow-hidden transform transition-all duration-300 hover:shadow-xl ${
                  plan.name === 'ultra' || plan.name === 'ultra_family' 
                    ? 'hover:-translate-y-2 border-violet-400 shadow-lg shadow-violet-300 relative ring-2 ring-violet-400/70 scale-105' : 
                  plan.name === 'premium' || plan.name === 'premium_family' 
                    ? 'hover:-translate-y-1 border-amber-300' :
                  plan.name === 'basic' || plan.name === 'basic_family' 
                    ? 'hover:-translate-y-1 border-emerald-300' :
                  plan.name === 'free'
                    ? 'hover:-translate-y-1 border-gray-300 bg-gray-50' : ''
                }`}
              >
                <CardHeader className={`${
                  plan.name === 'ultra' || plan.name === 'ultra_family'
                    ? 'bg-purple-600 text-white' 
                  : plan.name === 'premium' || plan.name === 'premium_family'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                  : plan.name === 'basic' || plan.name === 'basic_family'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' 
                  : plan.name === 'free'
                    ? 'bg-gray-100 text-gray-800'
                  : ''
                }`}>
                  <CardTitle className={
                    plan.name === 'ultra' || plan.name === 'premium' || plan.name === 'basic' ||
                    plan.name === 'ultra_family' || plan.name === 'premium_family' || plan.name === 'basic_family'
                      ? 'text-white flex items-center text-2xl' 
                      : 'flex items-center text-2xl'
                  }>
                    {plan.displayName || plan.name}
                  </CardTitle>
                  <CardDescription className={
                    plan.name === 'ultra' || plan.name === 'premium' || plan.name === 'basic' ||
                    plan.name === 'ultra_family' || plan.name === 'premium_family' || plan.name === 'basic_family'
                      ? 'text-white/90' 
                      : ''
                  }>
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-6">
                    <span className="text-3xl font-bold">
                      {plan.price ? `R$ ${(plan.price / 100).toFixed(2)}` : "Gratuito"}
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
                      plan.name === 'ultra' || plan.name === 'ultra_family'
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