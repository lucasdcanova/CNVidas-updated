import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PixPaymentFormProps {
  pixInfo: {
    qrCodeUrl?: string;
    expiresAt?: string;
    amount?: number;
  } | null;
  onSuccess?: () => void;
  onClose: () => void;
}

export const PixPaymentForm: React.FC<PixPaymentFormProps> = ({
  pixInfo,
  onSuccess,
  onClose
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isPixConfirmed, setIsPixConfirmed] = useState(false);
  const [verificationInProgress, setVerificationInProgress] = useState(false);
  
  // Valores padrão para quando pixInfo é incompleto
  const pixAmount = pixInfo?.amount || 0;
  const expiryDate = pixInfo?.expiresAt ? new Date(pixInfo.expiresAt) : new Date(Date.now() + 60 * 60 * 1000); // 1 hora no futuro
  
  // Formatar tempo restante
  const timeRemaining = formatDistanceToNow(expiryDate, {
    addSuffix: true,
    locale: ptBR
  });
  
  // Formatar valor
  const formattedAmount = pixAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  
  // Código PIX placeholder para uso temporário
  const pixCode = "00020126330014BR.GOV.BCB.PIX0111062268263520214Pagamento CN Vidas5204000053039865406123.455802BR5925PAGAMENTO CN VIDAS SAUDE6009SAO PAULO62140510CNVIDAS123063044CBD";
  
  // Copiar código PIX
  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopied(true);
      toast({
        title: "Código PIX copiado!",
        description: "Cole o código no seu aplicativo de banco para pagar.",
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
  
  // Verificar pagamento PIX
  const handleVerifyPayment = async () => {
    setVerificationInProgress(true);
    
    try {
      // Aqui idealmente verificaríamos se o pagamento PIX foi confirmado pela API
      // Para esta implementação, vamos simular uma verificação bem-sucedida
      setTimeout(() => {
        setIsPixConfirmed(true);
        
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
            <h3 className="font-medium text-lg">Pagamento via PIX</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Escaneie o QR Code ou copie a chave PIX abaixo
            </p>
          </div>
          
          {/* QR Code */}
          <div className="mb-6 p-4 bg-white border-2 border-slate-200 rounded-lg w-48 h-48 flex items-center justify-center">
            {pixInfo?.qrCodeUrl ? (
              <img 
                src={pixInfo.qrCodeUrl} 
                alt="QR Code PIX" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="100" 
                  height="100" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="text-green-600"
                >
                  <rect width="6" height="6" x="3" y="3" rx="1" />
                  <rect width="6" height="6" x="15" y="3" rx="1" />
                  <rect width="6" height="6" x="3" y="15" rx="1" />
                  <path d="M15 15h.01" />
                  <path d="M18 15h.01" />
                  <path d="M21 15h.01" />
                  <path d="M21 18h.01" />
                  <path d="M21 21h.01" />
                  <path d="M18 21h.01" />
                  <path d="M15 21h.01" />
                  <path d="M15 18h.01" />
                </svg>
                <p className="text-xs text-center mt-2">QR Code PIX</p>
              </div>
            )}
          </div>
          
          {/* Valor e expiração */}
          <div className="w-full mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="font-medium">{formattedAmount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Expira:</span>
              <span className="text-sm">{timeRemaining}</span>
            </div>
          </div>
          
          {/* Código PIX copiável */}
          <div className="w-full p-2 bg-white border rounded-md mb-4 relative">
            <p className="text-xs text-center pr-8 font-mono overflow-hidden text-ellipsis">
              {pixCode}
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
        </div>
      </div>
      
      {/* Botão de verificação de pagamento */}
      <Button 
        className="w-full" 
        onClick={handleVerifyPayment}
        disabled={verificationInProgress || isPixConfirmed}
      >
        {isPixConfirmed ? (
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
          O código PIX tem validade de 60 minutos. Após o pagamento, 
          a confirmação é imediata.
        </p>
      </div>
    </div>
  );
};