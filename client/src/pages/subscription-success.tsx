import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { CheckCircle, Calendar, FileText, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SubscriptionSuccessPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Verificar se usuário está voltando de uma seleção de plano no primeiro login
  useEffect(() => {
    const checkFirstSubscription = async () => {
      const wasFirstSubscription = localStorage.getItem('subscription_initiated');
      
      if (wasFirstSubscription === 'true') {
        // Limpar o indicador de primeiro login
        localStorage.removeItem('subscription_initiated');
        
        // Invalidar o cache para que o sistema reconheça a nova assinatura
        await queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
      }
    };
    
    checkFirstSubscription();
  }, [queryClient]);

  return (
    <div className="container max-w-md py-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-primary/10 mb-4">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Assinatura Ativada</CardTitle>
          <CardDescription>
            Bem-vindo à CN Vidas!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os benefícios do seu plano de saúde.
          </p>
          
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Agendamentos</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Documentos</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
              <User className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Perfil</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
              <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 12L11.5 15L15.5 9M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-medium">Telemedic.</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button 
            className="w-full" 
            onClick={() => setLocation("/dashboard")}
          >
            Ir para o Dashboard
          </Button>
          <Button 
            variant="outline"
            className="w-full" 
            onClick={() => setLocation("/profile")}
          >
            Completar Perfil
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}