import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Info,
  Sparkles,
  PartyPopper,
  Rocket
} from 'lucide-react';
// We'll create a simple confetti effect without external library
const triggerConfetti = () => {
  // Simple confetti animation using CSS
  const confettiContainer = document.createElement('div');
  confettiContainer.className = 'confetti-container';
  confettiContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  `;
  
  // Create confetti pieces
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.cssText = `
      position: absolute;
      width: 10px;
      height: 10px;
      background: ${['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'][Math.floor(Math.random() * 5)]};
      left: ${Math.random() * 100}%;
      animation: fall 3s linear;
    `;
    confettiContainer.appendChild(confetti);
  }
  
  document.body.appendChild(confettiContainer);
  
  // Remove after animation
  setTimeout(() => {
    document.body.removeChild(confettiContainer);
  }, 3000);
};

interface StepThreeProps {
  formData: any;
  updateFormData: (data: any) => void;
  onBack: () => void;
}

export default function StepThree({ formData, updateFormData, onBack }: StepThreeProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', '/api/doctors/profile', {
        ...formData,
        onboardingCompleted: true
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao completar cadastro');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Trigger confetti animation
      triggerConfetti();

      toast({
        title: 'Parabéns! 🎉',
        description: 'Seu perfil foi configurado com sucesso. Bem-vindo à CNVidas!',
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao completar cadastro',
        description: error.message,
        variant: 'destructive'
      });
      setIsSubmitting(false);
    }
  });

  const handleComplete = () => {
    // Validate payment information
    if (!formData.pixKeyType || !formData.pixKey || !formData.bankName) {
      toast({
        title: 'Dados bancários obrigatórios',
        description: 'Por favor, preencha todos os dados bancários para receber pagamentos.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    completeOnboardingMutation.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto"
    >
      <Card className="shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Configure seus Dados de Pagamento
          </CardTitle>
          <CardDescription className="text-purple-100">
            Último passo! Configure como deseja receber seus pagamentos
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Welcome Message */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center space-y-4 pb-6 border-b"
          >
            <Sparkles className="h-12 w-12 text-purple-600 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-800">
              Quase lá! Vamos configurar seus pagamentos
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Para garantir que você receba seus honorários de forma rápida e segura, 
              precisamos dos seus dados bancários para pagamento via PIX.
            </p>
          </motion.div>

          {/* Payment Information Alert */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Alert className="border-purple-200 bg-purple-50">
              <Info className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-800">
                <strong>Como funcionam os pagamentos:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Pagamentos processados toda segunda-feira</li>
                  <li>Transferência automática via PIX</li>
                  <li>Relatórios detalhados de cada pagamento</li>
                  <li>Suporte dedicado para questões financeiras</li>
                </ul>
              </AlertDescription>
            </Alert>
          </motion.div>

          {/* Payment Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="pixKeyType">Tipo de Chave PIX *</Label>
                <Select
                  value={formData.pixKeyType}
                  onValueChange={(value) => updateFormData({ pixKeyType: value })}
                >
                  <SelectTrigger id="pixKeyType" className="border-gray-300 focus:border-purple-500">
                    <SelectValue placeholder="Selecione o tipo de chave" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pixKey">Chave PIX *</Label>
                <Input
                  id="pixKey"
                  placeholder={
                    formData.pixKeyType === 'cpf' ? '000.000.000-00' :
                    formData.pixKeyType === 'email' ? 'seu@email.com' :
                    formData.pixKeyType === 'telefone' ? '(11) 99999-9999' :
                    'Chave aleatória'
                  }
                  value={formData.pixKey}
                  onChange={(e) => updateFormData({ pixKey: e.target.value })}
                  className="border-gray-300 focus:border-purple-500"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bankName">Banco *</Label>
                <Input
                  id="bankName"
                  placeholder="Ex: Banco do Brasil, Itaú, Bradesco"
                  value={formData.bankName}
                  onChange={(e) => updateFormData({ bankName: e.target.value })}
                  className="border-gray-300 focus:border-purple-500"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="accountType">Tipo de Conta *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) => updateFormData({ accountType: value })}
                >
                  <SelectTrigger id="accountType" className="border-gray-300 focus:border-purple-500">
                    <SelectValue placeholder="Selecione o tipo de conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {/* Summary Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg"
          >
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-purple-600" />
              Resumo do seu Perfil
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Especialidade:</p>
                <p className="font-medium text-gray-800">{formData.specialization}</p>
              </div>
              <div>
                <p className="text-gray-600">CRM:</p>
                <p className="font-medium text-gray-800">{formData.licenseNumber}</p>
              </div>
              <div>
                <p className="text-gray-600">Valor da Consulta:</p>
                <p className="font-medium text-gray-800">R$ {formData.consultationPrice?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600">Anos de Experiência:</p>
                <p className="font-medium text-gray-800">{formData.experienceYears} anos</p>
              </div>
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg text-center"
          >
            <PartyPopper className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Tudo pronto para começar!
            </h3>
            <p className="text-gray-600">
              Ao clicar em "Concluir", seu perfil estará ativo e você poderá começar 
              a atender pacientes imediatamente.
            </p>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex justify-between pt-6"
          >
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              onClick={handleComplete}
              size="lg"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Concluir Cadastro
                </>
              )}
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}