import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { CheckCircle } from "lucide-react";

export default function PaymentSuccessPage() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-md py-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-primary/10 mb-4">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pagamento Confirmado</CardTitle>
          <CardDescription>
            Seu pagamento foi processado com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">
            Obrigado por escolher a CN Vidas. Você receberá um e-mail com os detalhes da sua compra.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button 
            className="w-full" 
            onClick={() => navigate("/dashboard")}
          >
            Ir para o Dashboard
          </Button>
          <Button 
            variant="outline"
            className="w-full" 
            onClick={() => navigate("/appointments")}
          >
            Visualizar Agendamentos
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}