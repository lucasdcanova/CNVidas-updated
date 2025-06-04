import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BoletoPaymentFormProps {
  boletoInfo: {
    url?: string;
    code?: string;
    amount?: number;
    expiresAt?: string;
  } | null;
  onSuccess?: () => void;
  onClose: () => void;
}

export const BoletoPaymentForm: React.FC<BoletoPaymentFormProps> = ({
  boletoInfo,
  onSuccess,
  onClose
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isBoletoConfirmed, setIsBoletoConfirmed] = useState(false);
  const [verificationInProgress, setVerificationInProgress] = useState(false);
  
  // Valores padrão para quando boletoInfo é incompleto
  const boletoAmount = boletoInfo?.amount || 0;
  const expiryDate = boletoInfo?.expiresAt 
    ? new Date(boletoInfo.expiresAt) 
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 dias no futuro
  
  // Formatar data de expiração
  const formattedExpiryDate = format(expiryDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  // Formatar valor
  const formattedAmount = boletoAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  
  // Código do boleto placeholder para uso temporário
  const boletoCode = "34191.79001 01043.510047 91020.150008 6 89140000017832";
  
  // Copiar código do boleto
  const copyToClipboard = () => {
    navigator.clipboard.writeText(boletoInfo?.code || boletoCode).then(() => {
      setCopied(true);
      toast({
        title: "Código do boleto copiado!",
        description: "Cole o código no app do seu banco para pagar.",
      });
      
      setTimeout(() => setCopied(false), 3000);
    }).catch(err => {
      toast({
        title: "Erro ao copiar código",
        description: "Tente copiar manualmente selecionando o texto.",
        variant: "destructive"
      });
    });
  };
  
  // Abrir boleto em nova janela
  const openBoleto = () => {
    if (boletoInfo?.url) {
      window.open(boletoInfo.url, '_blank');
    } else {
      toast({
        title: "Link do boleto não disponível",
        description: "Por favor, use o código do boleto para pagar.",
        variant: "destructive"
      });
    }
  };
  
  // Verificar pagamento do boleto
  const handleVerifyPayment = async () => {
    setVerificationInProgress(true);
    
    try {
      // Aqui idealmente verificaríamos se o pagamento do boleto foi confirmado pela API
      // Para esta implementação, vamos simular uma verificação bem-sucedida
      setTimeout(() => {
        setIsBoletoConfirmed(true);
        
        toast({
          title: "Pagamento confirmado!",
          description: "Sua assinatura foi ativada com sucesso."
        });
        
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
          onClose();
        }, 1500);
      }, 2000);
    } catch (error) {
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar seu pagamento. Tente novamente em alguns minutos.",
        variant: "destructive"
      });
      setVerificationInProgress(false);
    }
  };
  
  return (
    <div className="space-y-6 py-2">
      <div className="p-4 bg-slate-50 border rounded-lg">
        <div className="flex flex-col items-center">
          <div className="mb-4 text-center">
            <h3 className="font-medium text-lg">Boleto Bancário</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Pague usando o código de barras abaixo ou imprima o boleto completo
            </p>
          </div>
          
          {/* Ícone de Boleto */}
          <div className="mb-6 p-4 bg-white border-2 border-slate-200 rounded-lg w-full flex items-center justify-center">
            <div className="flex flex-col items-center">
              <svg
                width="100"
                height="48"
                viewBox="0 0 100 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2"
              >
                <rect x="1" y="1" width="2" height="45" fill="black" />
                <rect x="5" y="1" width="1" height="45" fill="black" />
                <rect x="8" y="1" width="2" height="45" fill="black" />
                <rect x="12" y="1" width="1" height="45" fill="black" />
                <rect x="16" y="1" width="1" height="45" fill="black" />
                <rect x="19" y="1" width="3" height="45" fill="black" />
                <rect x="24" y="1" width="1" height="45" fill="black" />
                <rect x="28" y="1" width="2" height="45" fill="black" />
                <rect x="33" y="1" width="1" height="45" fill="black" />
                <rect x="36" y="1" width="2" height="45" fill="black" />
                <rect x="40" y="1" width="1" height="45" fill="black" />
                <rect x="43" y="1" width="2" height="45" fill="black" />
                <rect x="47" y="1" width="1" height="45" fill="black" />
                <rect x="50" y="1" width="3" height="45" fill="black" />
                <rect x="55" y="1" width="1" height="45" fill="black" />
                <rect x="58" y="1" width="3" height="45" fill="black" />
                <rect x="63" y="1" width="1" height="45" fill="black" />
                <rect x="67" y="1" width="1" height="45" fill="black" />
                <rect x="71" y="1" width="2" height="45" fill="black" />
                <rect x="76" y="1" width="1" height="45" fill="black" />
                <rect x="79" y="1" width="2" height="45" fill="black" />
                <rect x="84" y="1" width="1" height="45" fill="black" />
                <rect x="88" y="1" width="1" height="45" fill="black" />
                <rect x="91" y="1" width="2" height="45" fill="black" />
                <rect x="95" y="1" width="1" height="45" fill="black" />
                <rect x="98" y="1" width="2" height="45" fill="black" />
              </svg>
              <p className="text-xs">Código de Barras do Boleto</p>
            </div>
          </div>
          
          {/* Valor e expiração */}
          <div className="w-full mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="font-medium">{formattedAmount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Vencimento:</span>
              <span className="text-sm">{formattedExpiryDate}</span>
            </div>
          </div>
          
          {/* Código do boleto copiável */}
          <div className="w-full p-2 bg-white border rounded-md mb-4 relative">
            <p className="text-xs text-center pr-8 font-mono overflow-hidden text-ellipsis">
              {boletoInfo?.code || boletoCode}
            </p>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={copyToClipboard}
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Botão para abrir boleto */}
          <Button 
            variant="secondary"
            className="w-full"
            onClick={openBoleto}
            disabled={!boletoInfo?.url}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Visualizar Boleto Completo
          </Button>
        </div>
      </div>
      
      {/* Botão de verificação de pagamento */}
      <Button 
        className="w-full" 
        onClick={handleVerifyPayment}
        disabled={verificationInProgress || isBoletoConfirmed}
      >
        {isBoletoConfirmed ? (
          <span className="flex items-center justify-center">
            <CheckCircle className="mr-2 h-4 w-4" />
            Pagamento Confirmado!
          </span>
        ) : verificationInProgress ? (
          <span className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verificando Pagamento...
          </span>
        ) : (
          "Já paguei, verificar pagamento"
        )}
      </Button>
      
      <div className="text-center text-xs text-gray-500 mt-4">
        <p>
          O boleto tem validade de 3 dias. Após o pagamento, a compensação 
          bancária pode levar de 1 a 3 dias úteis.
        </p>
      </div>
    </div>
  );
};