import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, CreditCard, User, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Breadcrumb from "@/components/ui/breadcrumb";
import { getSubscriptionPlans, getUserSubscription } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import CheckoutModal from "@/components/checkout/checkout-modal";

// Definição do tipo de plano de assinatura
interface SubscriptionPlan {
  id: number;
  name: "free" | "basic" | "premium" | "basic_family" | "premium_family" | "ultra" | "ultra_family";
  displayName: string;
  price: number;
  emergencyConsultations: string;
  specialistDiscount: number;
  insuranceCoverage: boolean;
  features: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserSubscription {
  id: number;
  userId: number;
  planId: number;
  status: string;
  startDate: string;
  endDate: string;
  cancelAtPeriodEnd?: boolean;
  plan?: SubscriptionPlan;
}

const SubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showFamilyPlans, setShowFamilyPlans] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{id: number, name: string, price: string} | null>(null);

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

  const isCurrentPlan = (planType: string) => {
    if (!userSubscription) return planType === 'free';
    return userSubscription.plan?.name === planType;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isLoading = plansLoading || subscriptionLoading;

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan({
      id: plan.id,
      name: plan.displayName,
      price: plan.price > 0 ? `R$ ${(plan.price / 100).toFixed(2)}` : "R$ 0,00"
    });
    setCheckoutOpen(true);
  };
  
  // Função para agrupar e filtrar os planos com base na seleção (individual/familiar)
  const getFilteredAndGroupedPlans = () => {
    if (!plans) return [];
    
    // Filtrar planos com base no toggle familiar/individual
    const filteredPlans = plans.filter((plan: SubscriptionPlan) => {
      if (!plan || !plan.name) return false;
      
      const isFamilyPlan = plan.name.includes('_family');
      
      // Se o toggle está ativo (familiar), mostrar apenas planos familiares
      // Se o toggle está inativo (individual), mostrar apenas planos individuais
      return showFamilyPlans ? isFamilyPlan : !isFamilyPlan;
    });
    
    // Definir a ordem personalizada dos planos: básico, premium, ultra e gratuito por último
    const planOrder = {
      'basic': 1,
      'premium': 2,
      'ultra': 3,
      'free': 4
    };
    
    return filteredPlans.sort((a, b) => {
      if (!a?.name || !b?.name) return 0; // Verificação de segurança
      const baseTypeA = a.name.replace('_family', '');
      const baseTypeB = b.name.replace('_family', '');
      
      return (planOrder[baseTypeA as keyof typeof planOrder] || 99) - 
             (planOrder[baseTypeB as keyof typeof planOrder] || 99);
    });
  };

  const handleCancelSubscription = async () => {
    try {
      // Aqui implementaríamos a chamada para cancelar a assinatura
      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de cancelamento foi registrada. A assinatura permanecerá ativa até o final do período atual.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível processar sua solicitação. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Gerenciar Planos">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Função para fechar o modal de checkout
  const handleCloseCheckout = () => {
    setCheckoutOpen(false);
    setSelectedPlan(null);
  };
  
  return (
    <DashboardLayout title="Gerenciar Planos">
      <div className="max-w-7xl mx-auto">
        {/* Informações da assinatura atual */}
        {userSubscription && userSubscription.status !== "inactive" && (
          <Card className="mb-8 mt-4 overflow-hidden border-2 border-primary shadow-lg">
            <CardHeader className={`
              ${userSubscription.plan?.name === 'premium' || userSubscription.plan?.name === 'premium_family'
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                : userSubscription.plan?.name === 'basic' || userSubscription.plan?.name === 'basic_family'
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' 
                  : userSubscription.plan?.name === 'ultra' || userSubscription.plan?.name === 'ultra_family'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                    : 'bg-gradient-to-r from-gray-100 to-gray-200'
              }`}>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Sua Assinatura Atual
                </CardTitle>
                <Badge variant="outline" className={`${
                  userSubscription.plan?.name === 'premium' || userSubscription.plan?.name === 'premium_family' || 
                  userSubscription.plan?.name === 'basic' || userSubscription.plan?.name === 'basic_family' ||
                  userSubscription.plan?.name === 'ultra' || userSubscription.plan?.name === 'ultra_family'
                    ? 'border-white text-white bg-white/20' 
                    : 'bg-primary/20'
                } px-3 py-1 rounded-full font-medium`}>
                  {userSubscription.plan?.name === 'premium' || userSubscription.plan?.name === 'premium_family'
                    ? 'Premium' 
                    : userSubscription.plan?.name === 'basic' || userSubscription.plan?.name === 'basic_family'
                      ? 'Básico' 
                      : userSubscription.plan?.name === 'ultra' || userSubscription.plan?.name === 'ultra_family'
                        ? 'Ultra'
                        : 'Gratuito'}
                </Badge>
              </div>
              <CardDescription className={
                userSubscription.plan?.name === 'premium' || userSubscription.plan?.name === 'premium_family' || 
                userSubscription.plan?.name === 'basic' || userSubscription.plan?.name === 'basic_family' || 
                userSubscription.plan?.name === 'ultra' || userSubscription.plan?.name === 'ultra_family' 
                ? 'text-white/90' : ''
              }>
                Informações sobre seu plano e status de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center">
                    <span>{userSubscription.plan?.displayName || "Plano Atual"}</span>
                    <Badge variant="success" className="ml-3">
                      {userSubscription.status === "active" ? "Ativo" : userSubscription.status}
                    </Badge>
                  </h3>
                  
                  {userSubscription.plan?.features && (
                    <ul className="space-y-2 mt-4">
                      {userSubscription.plan.features.slice(0, 3).map((feature: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {userSubscription.cancelAtPeriodEnd && (
                    <p className="text-sm text-yellow-600 mt-4 p-2 bg-yellow-50 rounded-md border border-yellow-200">
                      Cancelamento programado. Sua assinatura permanecerá ativa até {formatDate(userSubscription.endDate)}.
                    </p>
                  )}
                </div>
                
                <div className="text-center md:text-right bg-gray-50 p-4 rounded-lg">
                  <p className="text-3xl font-bold">
                    {userSubscription.plan?.price && userSubscription.plan.price > 0 ? `R$ ${(userSubscription.plan.price / 100).toFixed(2)}` : "Gratuito"}
                  </p>
                  {userSubscription.plan?.price && userSubscription.plan.price > 0 ? (
                    <p className="text-sm text-muted-foreground">/mês</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-2">
                    {userSubscription.status === "active" ? (
                      <>
                        <span className="font-medium">Próxima cobrança:</span><br />
                        {formatDate(userSubscription.endDate)}
                      </>
                    ) : (
                      "Sem cobrança automática"
                    )}
                  </p>
                </div>
              </div>
              
              {!userSubscription.cancelAtPeriodEnd && userSubscription.status === "active" && (
                <div className="mt-6 flex justify-end">
                  <Button 
                    variant="outline" 
                    className="text-destructive hover:bg-destructive/10 border-destructive" 
                    onClick={handleCancelSubscription}
                  >
                    Cancelar Assinatura
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Título dos planos disponíveis */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">Escolha seu plano</h2>
          <p className="text-muted-foreground mt-2">
            Selecione o plano que melhor atende às suas necessidades
          </p>
        </div>
        
        {/* Toggle para planos individuais/familiares */}
        <div className="flex items-center justify-center space-x-2 mb-8">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-primary" />
            <Label htmlFor="family-toggle" className={!showFamilyPlans ? "font-semibold" : ""}>Individual</Label>
          </div>
          <Switch 
            id="family-toggle" 
            checked={showFamilyPlans} 
            onCheckedChange={setShowFamilyPlans} 
          />
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-primary" />
            <Label htmlFor="family-toggle" className={showFamilyPlans ? "font-semibold" : ""}>Familiar</Label>
          </div>
        </div>

        {/* Lista de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {getFilteredAndGroupedPlans().length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">
                {showFamilyPlans ? 'Nenhum plano familiar disponível' : 'Nenhum plano individual disponível'}
              </p>
            </div>
          ) : (
            getFilteredAndGroupedPlans().map((plan: SubscriptionPlan) => (
            <Card 
              key={plan.id} 
              className={`overflow-hidden ${isCurrentPlan(plan.name) ? 'border-2 border-primary' : ''} transform transition-all duration-300 ${
                plan.name === 'ultra' || plan.name === 'ultra_family' 
                  ? 'hover:shadow-xl hover:-translate-y-1 border-violet-400 shadow-lg shadow-violet-300 animate-pulse-subtle relative ring-2 ring-violet-400/70 scale-105' : 
                plan.name === 'premium' || plan.name === 'premium_family' 
                  ? 'hover:shadow-lg hover:-translate-y-0.5 border-amber-300' :
                plan.name === 'basic' || plan.name === 'basic_family' 
                  ? 'hover:shadow-md border-emerald-300' : ''
              }`}
            >

              <CardHeader className={`${
                plan.name === 'ultra' || plan.name === 'ultra_family'
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' 
                : plan.name === 'premium' || plan.name === 'premium_family'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' 
                : plan.name === 'basic' || plan.name === 'basic_family'
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' 
                : ''
              }`}>
                <div className="flex justify-between items-center">
                  <CardTitle className={
                    plan.name === 'ultra' || plan.name === 'ultra_family'
                      ? 'text-white flex items-center' 
                      : plan.name === 'premium' || plan.name === 'premium_family' 
                        ? 'text-white flex items-center'
                        : plan.name === 'basic' || plan.name === 'basic_family'
                          ? 'text-white flex items-center'
                          : 'flex items-center'
                  }>
                    {plan.displayName}
                  </CardTitle>
                  {isCurrentPlan(plan.name) && (
                    <Badge variant="outline" className={
                      (plan.name === 'premium' || plan.name === 'premium_family' || plan.name === 'basic' || plan.name === 'basic_family') 
                        ? 'border-white text-white' 
                        : ''
                    }>
                      Plano Atual
                    </Badge>
                  )}
                </div>
                <CardDescription className={
                    (plan.name === 'premium' || plan.name === 'premium_family' || 
                     plan.name === 'basic' || plan.name === 'basic_family' || 
                     plan.name === 'ultra' || plan.name === 'ultra_family') 
                      ? 'text-white/90' 
                      : ''
                  }>
                    {plan.emergencyConsultations === 'unlimited' 
                      ? 'Teleconsultas de emergência ilimitadas' 
                      : plan.emergencyConsultations === '0' 
                        ? 'Sem teleconsultas de emergência incluídas'
                        : `${plan.emergencyConsultations} teleconsultas de emergência por mês`}
                  </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <span className="text-3xl font-bold">
                    {plan.price > 0 ? `R$ ${(plan.price / 100).toFixed(2)}` : "Gratuito"}
                  </span>
                  {plan.price > 0 && <span className="text-muted-foreground">/mês</span>}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={
                    plan.name === 'ultra' || plan.name === 'ultra_family' ? 'default' : 
                    plan.name === 'premium' || plan.name === 'premium_family' ? 'secondary' : 
                    plan.name === 'basic' || plan.name === 'basic_family' ? 'outline' : 
                    'outline'
                  } 
                  className={`w-full ${
                    plan.name === 'ultra' || plan.name === 'ultra_family' 
                      ? 'bg-violet-600 hover:bg-violet-700 text-white' : 
                    plan.name === 'premium' || plan.name === 'premium_family'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                    plan.name === 'basic' || plan.name === 'basic_family'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''
                  }`}
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isCurrentPlan(plan.name)}
                >
                  {isCurrentPlan(plan.name) ? 'Plano Atual' : 'Selecionar Plano'}
                </Button>
              </CardFooter>
            </Card>
            ))
          )}
        </div>

        {/* FAQ */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Perguntas Frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Como funciona a cobrança?</h3>
              <p className="text-muted-foreground">
                As cobranças são realizadas mensalmente no cartão de crédito. Você pode cancelar sua assinatura a qualquer momento.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Posso mudar de plano?</h3>
              <p className="text-muted-foreground">
                Sim, você pode alterar seu plano a qualquer momento. Se você fizer um upgrade, a diferença será cobrada proporcionalmente ao período restante. Se fizer um downgrade, o novo valor será aplicado no próximo ciclo de cobrança.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Como cancelar minha assinatura?</h3>
              <p className="text-muted-foreground">
                Você pode cancelar sua assinatura a qualquer momento através desta página. Após o cancelamento, você continuará tendo acesso aos recursos do plano até o final do período já pago.
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Modal de Checkout do Stripe */}
        {selectedPlan && (
          <CheckoutModal
            isOpen={checkoutOpen}
            onClose={handleCloseCheckout}
            planId={selectedPlan.id}
            planName={selectedPlan.name}
            planPrice={selectedPlan.price}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionPage;