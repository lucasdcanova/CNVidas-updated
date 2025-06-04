import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowUpRight, CreditCard, Lock } from "lucide-react";

interface PlanUpgradeBannerProps {
  title?: string;
  description?: string;
  requiredPlan?: "basic" | "premium";
  currentPlan?: string;
  className?: string;
}

const PlanUpgradeBanner: React.FC<PlanUpgradeBannerProps> = ({
  title = "Recurso não disponível no seu plano atual",
  description = "Faça upgrade do seu plano para acessar esta funcionalidade.",
  requiredPlan = "basic",
  currentPlan = "free",
  className = "",
}) => {
  const [_, setLocation] = useLocation();

  const handleUpgrade = () => {
    setLocation("/subscription");
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case "basic":
        return "Plano Básico";
      case "premium":
        return "Plano Premium";
      default:
        return "Plano Gratuito";
    }
  };

  return (
    <Card className={`border-yellow-300 bg-yellow-50 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-yellow-800">{title}</CardTitle>
        </div>
        <CardDescription className="text-yellow-700">{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-yellow-700">
        <p>
          Este recurso está disponível no <strong>{getPlanName(requiredPlan)}</strong> ou superior.
          {currentPlan && currentPlan !== "free" && (
            <span> Você está atualmente no <strong>{getPlanName(currentPlan)}</strong>.</span>
          )}
        </p>
      </CardContent>
      <CardFooter>
        <Button 
          variant="default" 
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
          onClick={handleUpgrade}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Ver planos disponíveis
          <ArrowUpRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PlanUpgradeBanner;