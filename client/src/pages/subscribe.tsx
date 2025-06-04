import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState, useMemo } from 'react';
import { apiRequest, useQuery } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Shield, Calendar, Clock, ArrowRight, Star, Users, User } from "lucide-react";
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// O tipo para os planos vindos da API
interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  price: number;
  formattedPrice: string;
  emergencyConsultations: string;
  specialistDiscount: number;
  insuranceCoverage: boolean;
  insuranceCoverageAmount?: number;
  priorityLevel?: number;
  isFamily?: boolean;
  maxDependents?: number;
  features: string[];
  isDefault: boolean;
}

// Ícones para os recursos dos planos
const featureIcons: Record<string, React.ReactNode> = {
  // Consultas de emergência
  'Teleconsultas de emergência ilimitadas': <Clock className="h-5 w-5 text-primary" />,
  '2 teleconsultas de emergência por mês': <Clock className="h-5 w-5 text-primary" />,
  '0 teleconsultas de emergência por mês': <Clock className="h-5 w-5 text-muted-foreground" />,
  
  // Descontos
  '70% de desconto com especialistas': <Badge className="h-5 w-5 text-primary" />,
  '50% de desconto com especialistas': <Badge className="h-5 w-5 text-primary" />,
  '30% de desconto com especialistas': <Badge className="h-5 w-5 text-primary" />,
  'Sem descontos e sem cobertura de seguro': <Badge className="h-5 w-5 text-muted-foreground" />,
  'Acesso completo aos descontos de parceiros': <Badge className="h-5 w-5 text-primary" />,
  
  // Cobertura de seguro
  'Cobertura de seguro: R$ 500/dia de internação': <Shield className="h-5 w-5 text-primary" />,
  'Cobertura de seguro: R$ 300/dia de internação': <Shield className="h-5 w-5 text-primary" />,
  'Sem cobertura de seguro': <Shield className="h-5 w-5 text-muted-foreground" />,
  
  // Prioridade
  'Prioridade máxima de agendamento': <Calendar className="h-5 w-5 text-primary" />,
  'Prioridade de agendamento': <Calendar className="h-5 w-5 text-primary" />,
  
  // Suporte
  'Suporte prioritário 24/7': <Star className="h-5 w-5 text-primary" />,
  'Suporte 24/7': <Star className="h-5 w-5 text-primary" />,
  
  // Acesso
  'Acesso ao marketplace': <ArrowRight className="h-5 w-5 text-primary" />,
  'Pagamento integral pelos serviços': <Badge className="h-5 w-5 text-muted-foreground" />,
  
  // Planos familiares
  'Mesmos benefícios do Básico para cada dependente': <Star className="h-5 w-5 text-primary" />,
  'Mesmos benefícios do Premium para cada dependente': <Star className="h-5 w-5 text-primary" />,
  'Mesmos benefícios do Ultra para cada dependente': <Star className="h-5 w-5 text-primary" />,
  'Até 4 CPFs': <CheckCircle className="h-5 w-5 text-primary" />,
  
  // Outros benefícios
  'Todos os demais benefícios dos planos anteriores': <CheckCircle className="h-5 w-5 text-primary" />,
};

interface SubscribeFormProps {
  clientSecret: string;
  planId: string;
}

const SubscribeForm = ({ clientSecret, planId }: SubscribeFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [, navigate] = useLocation();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/subscription-success",
      },
      redirect: 'if_required',
    });

    if (error) {
      toast({
        title: "Erro na assinatura",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      toast({
        title: "Assinatura ativada",
        description: "Sua assinatura foi ativada com sucesso!",
      });
      navigate("/subscription-success");
    } else {
      toast({
        title: "Processando assinatura",
        description: "Sua assinatura está sendo processada.",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <h3 className="text-base font-medium mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          Escolha como deseja pagar:
        </h3>
        
        <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span className="text-xs text-slate-500">Pagamentos processados com segurança via Stripe</span>
        </div>
        
        <PaymentElement options={{
          paymentMethodOrder: ['card', 'pix', 'boleto'],
          defaultValues: {
            billingDetails: {
              name: '',
              email: '',
              phone: '',
              address: {
                country: 'BR',
              },
            },
          },
          business: {
            name: 'CN Vidas',
          },
          fields: {
            billingDetails: {
              name: 'auto',
              email: 'auto',
              phone: 'auto',
              address: {
                country: 'never',
                postalCode: 'auto',
                line1: 'auto',
                line2: 'auto',
                city: 'auto',
                state: 'auto',
              },
            },
          },
          wallets: {
            googlePay: 'auto',
            applePay: 'auto',
          },
        }} />
      </div>
      
      <div className="pt-4">
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md" 
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando pagamento...</>
          ) : (
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <path d="M17 9h.01"/>
                <path d="M17 13h.01"/>
                <path d="M2 10h20"/>
              </svg>
              Assinar agora
            </div>
          )}
        </Button>
      </div>
    </form>
  );
};

export default function SubscribePage() {
  const [clientSecret, setClientSecret] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showFamilyPlans, setShowFamilyPlans] = useState(false);
  const [selectedBasePlanType, setSelectedBasePlanType] = useState<string | null>(null); // Tipo base do plano selecionado (basic, premium, ultra)
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Buscar os planos disponíveis da API
  const { data: plans, isLoading: isLoadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription/plans"],
  });
  
  // Verificar autenticação e criar assinatura
  useEffect(() => {
    if (!user) {
      toast({
        title: "Acesso não autorizado",
        description: "Faça login para continuar.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    if (selectedPlan) {
      // Create subscription as soon as plan is selected
      apiRequest("POST", "/api/subscription/create", { planId: selectedPlan })
        .then((res) => res.json())
        .then((data) => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          } else {
            // Subscription already exists
            toast({
              title: "Assinatura encontrada",
              description: data.message || "Você já possui uma assinatura ativa.",
            });
            navigate("/subscription");
          }
        })
        .catch(error => {
          toast({
            title: "Erro ao iniciar assinatura",
            description: error.message,
            variant: "destructive",
          });
        });
    }
  }, [user, selectedPlan, navigate, toast]);
  
  // Efeito para atualizar o plano selecionado quando o usuário alterna entre planos individuais e familiares
  useEffect(() => {
    // Se temos um tipo base selecionado e planos disponíveis
    if (selectedBasePlanType && plans && plans.length > 0) {
      // Resetar o plano selecionado para que possamos selecionar o equivalente do outro tipo
      setSelectedPlan(null);
      
      // Encontrar o plano correspondente ao tipo base e ao tipo de plano (individual/familiar)
      const correspondingPlan = plans.find(plan => {
        const isCorrectFamily = showFamilyPlans ? plan.isFamily : !plan.isFamily;
        const planBaseType = plan.name.replace('_family', '');
        return planBaseType === selectedBasePlanType && isCorrectFamily;
      });
      
      // Se encontramos um plano correspondente, selecioná-lo automaticamente
      if (correspondingPlan) {
        setSelectedPlan(correspondingPlan.id.toString());
      }
    }
  }, [showFamilyPlans, selectedBasePlanType, plans]);

  const handleSelectPlan = (planId: string, planType: string) => {
    setSelectedPlan(planId);
    
    // Extrair o tipo base do plano (basic, premium, ultra)
    const basePlanType = planType.replace('_family', '');
    setSelectedBasePlanType(basePlanType);
  };
  
  const getPlanDescription = (plan: SubscriptionPlan) => {
    if (plan.name.includes("ultra")) {
      return "Cobertura premium completa para você" + (plan.isFamily ? " e sua família" : "");
    } else if (plan.name.includes("premium")) {
      return "Cobertura completa com benefícios exclusivos" + (plan.isFamily ? " para toda família" : "");
    } else if (plan.name.includes("basic")) {
      return "Cobertura essencial para você" + (plan.isFamily ? " e sua família" : "");
    } else {
      return "Acesso básico à plataforma CN Vidas";
    }
  };
  
  const getFeatureIcon = (feature: string) => {
    return featureIcons[feature] || <CheckCircle className="h-5 w-5 text-primary" />;
  };
  
  // Função para colorir as badges dos planos
  const getPlanBadgeColor = (planName: string) => {
    if (planName.includes("ultra")) {
      return "bg-gradient-to-r from-indigo-600 to-blue-800 text-white";
    } else if (planName.includes("premium")) {
      return "bg-gradient-to-r from-violet-500 to-purple-600 text-white";
    } else if (planName.includes("basic")) {
      return "bg-gradient-to-r from-blue-500 to-cyan-600 text-white";
    } else {
      return "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800";
    }
  };
  
  // Função para ordenar os planos na interface
  const sortPlans = (plans: SubscriptionPlan[]) => {
    const planOrder = {
      'free': 1,
      'basic': 2,
      'basic_family': 3,
      'premium': 4,
      'premium_family': 5,
      'ultra': 6,
      'ultra_family': 7
    };
    
    return [...plans].sort((a, b) => {
      return (planOrder[a.name as keyof typeof planOrder] || 99) - 
             (planOrder[b.name as keyof typeof planOrder] || 99);
    });
  };
  
  return (
    <div className="container max-w-6xl py-10">
      <h1 className="text-3xl font-bold mb-2 text-center">Escolha seu plano de saúde</h1>
      <p className="text-center text-muted-foreground mb-4">Assine agora e tenha acesso a todos os benefícios CN Vidas</p>
      
      {isLoadingPlans ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Carregando"/>
        </div>
      ) : !selectedPlan ? (
        <>
          <div className="flex items-center justify-center space-x-2 mb-6">
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
          
          <div className="grid md:grid-cols-3 gap-8">
            {plans && sortPlans(plans)
              .filter(plan => showFamilyPlans ? plan.isFamily : !plan.isFamily)
              .map((plan) => {
                const isUltraPlan = plan.name.includes("ultra");
                return (
                  <Card 
                    key={plan.id} 
                    className={`flex flex-col h-full overflow-hidden transform transition-all duration-300 ${
                      isUltraPlan ? "border-indigo-400 shadow-xl hover:shadow-2xl hover:-translate-y-1" : 
                      plan.name.includes("premium") ? "border-purple-300 shadow-lg hover:shadow-xl" : 
                      plan.name.includes("basic") ? "border-blue-300 hover:shadow-lg" : ""
                    }`}
                  >
                    <div className={`py-1 px-4 text-center text-sm font-medium ${getPlanBadgeColor(plan.name)}`}>
                      {isUltraPlan ? "ULTRA PREMIUM" :
                       plan.name.includes("premium") ? "MAIS POPULAR" : 
                       plan.name.includes("basic") ? "RECOMENDADO" : "GRATUITO"}
                    </div>
                    <CardHeader>
                      <CardTitle className={isUltraPlan ? "text-indigo-700" : ""}>
                        {plan.displayName}
                        {isUltraPlan && <span className="ml-2 inline-flex animate-pulse bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">NOVO</span>}
                      </CardTitle>
                      <CardDescription>{getPlanDescription(plan)}</CardDescription>
                    </CardHeader>
                    <CardContent className={`flex-grow ${isUltraPlan ? "bg-gradient-to-b from-white to-indigo-50" : ""}`}>
                      <p className="text-2xl font-bold mb-6">
                        {plan.formattedPrice}
                        <span className="text-sm font-normal text-muted-foreground">/mês</span>
                      </p>
                      {plan.isFamily && (
                        <div className="mb-4 p-2 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
                          <p className="font-medium flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            Plano familiar para até {plan.maxDependents} CPFs
                          </p>
                        </div>
                      )}
                      <ul className="space-y-3">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className={`mt-0.5 ${isUltraPlan ? "text-indigo-600" : ""}`}>
                              {getFeatureIcon(feature)}
                            </span>
                            <span className={isUltraPlan && feature.includes("70%") ? "font-medium text-indigo-800" : ""}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter className={isUltraPlan ? "bg-indigo-50" : ""}>
                      <Button 
                        className={`w-full ${
                          isUltraPlan ? "bg-gradient-to-r from-indigo-600 to-blue-800 hover:from-indigo-700 hover:to-blue-900 shadow-lg hover:shadow-indigo-200" :
                          plan.name.includes("premium") ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700" : 
                          plan.name.includes("basic") ? "bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700" : ""
                        }`}
                        onClick={() => handleSelectPlan(plan.id.toString(), plan.name)}
                      >
                        {plan.price > 0 ? "Assinar agora" : "Selecionar plano gratuito"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
          </div>
        </>
      ) : clientSecret ? (
        <div className="flex flex-col md:flex-row gap-8">
          <div className={`${isMobile ? 'order-2' : 'order-1'} flex-1`}>
            <Card>
              <CardHeader>
                <CardTitle>Assinatura segura</CardTitle>
                <CardDescription>
                  Seus dados de pagamento estão protegidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    locale: 'pt-BR',
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#3367F2',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        borderRadius: '8px'
                      }
                    }
                  }}
                >
                  <SubscribeForm clientSecret={clientSecret} planId={selectedPlan} />
                </Elements>
              </CardContent>
            </Card>
          </div>
          
          <div className={`${isMobile ? 'order-1' : 'order-2'} flex-1`}>
            <Card>
              <CardHeader>
                <CardTitle>Resumo da assinatura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedPlan && plans && (
                    <>
                      <div className="flex justify-between">
                        <span>Plano:</span>
                        <span className="font-medium">
                          {plans.find(p => p.id.toString() === selectedPlan)?.displayName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor mensal:</span>
                        <span className="font-medium">
                          {plans.find(p => p.id.toString() === selectedPlan)?.formattedPrice}
                        </span>
                      </div>
                      
                      {plans.find(p => p.id.toString() === selectedPlan)?.isFamily && (
                        <div className="flex justify-between mt-2">
                          <span>Dependentes:</span>
                          <span className="font-medium">
                            Até {plans.find(p => p.id.toString() === selectedPlan)?.maxDependents} CPFs
                          </span>
                        </div>
                      )}
                      
                      {plans.find(p => p.id.toString() === selectedPlan)?.insuranceCoverage && (
                        <div className="flex justify-between mt-2">
                          <span>Cobertura de seguro:</span>
                          <span className="font-medium">
                            R$ {plans.find(p => p.id.toString() === selectedPlan)?.insuranceCoverageAmount}/dia
                          </span>
                        </div>
                      )}
                      
                      {(plans.find(p => p.id.toString() === selectedPlan)?.specialistDiscount || 0) > 0 && (
                        <div className="flex justify-between mt-2">
                          <span>Desconto com especialistas:</span>
                          <span className="font-medium">
                            {plans.find(p => p.id.toString() === selectedPlan)?.specialistDiscount}%
                          </span>
                        </div>
                      )}
                      
                      <div className="border-t pt-4 mt-4">
                        <h3 className="font-medium mb-2">Inclui:</h3>
                        <ul className="space-y-2">
                          {plans.find(p => p.id.toString() === selectedPlan)?.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="mt-0.5">{getFeatureIcon(feature)}</span>
                              <span className="text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  setSelectedPlan(null);
                  // Mantemos o tipo base selecionado para permitir que o usuário retorne ao mesmo tipo de plano
                }}>
                  Voltar aos planos
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Carregando"/>
        </div>
      )}
    </div>
  );
}