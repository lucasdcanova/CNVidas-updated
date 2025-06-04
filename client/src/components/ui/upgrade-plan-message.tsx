import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Star, Shield, ArrowRight } from "lucide-react";

interface UpgradePlanMessageProps {
  feature: "claims" | "services";
  onClose?: () => void;
}

const featureInfo = {
  claims: {
    title: "Acesso a Sinistros",
    description: "Com planos pagos você pode registrar e acompanhar seus sinistros diretamente pela plataforma.",
    benefits: [
      "Registro simplificado de sinistros",
      "Acompanhamento em tempo real do processo",
      "Documentação digital segura",
      "Suporte prioritário para suas solicitações"
    ]
  },
  services: {
    title: "Acesso a Serviços Parceiros",
    description: "Planos pagos oferecem acesso completo a nossa rede de parceiros com descontos exclusivos.",
    benefits: [
      "Descontos de até 70% em consultas especializadas",
      "Acesso a toda rede de parceiros",
      "Prioridade na marcação de consultas",
      "Teleconsultas de emergência ilimitadas"
    ]
  }
};

export const UpgradePlanMessage: React.FC<UpgradePlanMessageProps> = ({ feature, onClose }) => {
  const [, setLocation] = useLocation();
  const info = featureInfo[feature];

  const handleUpgrade = () => {
    setLocation("/subscription");
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md animate-in fade-in zoom-in duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center">
            <Lock className="h-6 w-6 mr-2" />
            <CardTitle>{info.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-2">
          <p className="mb-4 text-center">{info.description}</p>
          
          <h3 className="font-semibold text-lg mb-2 flex items-center">
            <Star className="h-5 w-5 mr-2 text-amber-500" />
            Benefícios dos planos pagos:
          </h3>
          
          <ul className="space-y-2 my-4">
            {info.benefits.map((benefit, index) => (
              <li key={index} className="flex items-start">
                <Shield className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 my-4">
            <p className="text-sm text-blue-800">
              Assine um plano a partir de <span className="font-bold">R$ 89,90/mês</span> e tenha acesso imediato a todos os recursos da CN Vidas.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 justify-end pb-4">
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            onClick={handleUpgrade}
          >
            Ver Planos <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UpgradePlanMessage;