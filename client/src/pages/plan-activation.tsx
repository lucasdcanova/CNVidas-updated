import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { CheckCircle, CheckCircle2, Loader2, Sparkles, Heart, Shield, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getUserSubscription } from '@/lib/api';
import { apiRequest } from '@/lib/queryClient';
import cnvidasLogo from '@/assets/cnvidas-logo-transparent.png';

export default function PlanActivation() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activationStatus, setActivationStatus] = useState<'checking' | 'activating' | 'activated'>('checking');
  const [showSuccess, setShowSuccess] = useState(false);

  // Buscar status da assinatura
  const { data: userSubscription, refetch } = useQuery({
    queryKey: ["/api/subscription/current"],
    queryFn: getUserSubscription,
    enabled: !!user?.id,
    refetchInterval: activationStatus === 'activating' ? 2000 : false, // Verificar a cada 2 segundos
  });

  // Verificar pagamento pendente
  useEffect(() => {
    // Se já está ativo, redirecionar direto
    if (user?.subscriptionStatus === 'active') {
      console.log('🔄 Plano já está ativo, redirecionando...');
      window.location.href = '/dashboard';
      return;
    }
    
    if (user?.subscriptionStatus === 'pending' || activationStatus === 'checking') {
      checkPendingPayment();
    }
  }, [user]);

  // Monitorar mudanças no status
  useEffect(() => {
    // Só ativar se estava realmente pendente e agora está ativo
    if (userSubscription?.status === 'active' && activationStatus === 'activating') {
      console.log('✅ Plano ativado com sucesso!');
      handleActivationSuccess();
    }
  }, [userSubscription, activationStatus]);

  const checkPendingPayment = async () => {
    try {
      setActivationStatus('activating');
      const response = await apiRequest('POST', '/api/subscription/check-pending-payment', {});
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'active') {
          // Pagamento confirmado!
          await queryClient.invalidateQueries({ queryKey: ["/api/auth/check"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
          handleActivationSuccess();
        } else {
          // Continuar verificando
          setTimeout(() => refetch(), 2000);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      // Continuar tentando
      setTimeout(() => checkPendingPayment(), 3000);
    }
  };

  const handleActivationSuccess = () => {
    setActivationStatus('activated');
    setShowSuccess(true);
    
    // Marcar que o plano foi ativado para evitar loops
    sessionStorage.setItem('plan-activated', 'true');
    
    // Aguardar mais tempo para ver a animação completa
    setTimeout(() => {
      // Forçar redirecionamento completo para garantir que o dashboard recarregue
      window.location.href = '/dashboard';
    }, 5000); // 5 segundos para apreciar a animação
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
      {/* Elementos de fundo animados */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-10"
            style={{
              width: Math.random() * 300 + 100,
              height: Math.random() * 300 + 100,
            }}
            animate={{
              x: [
                Math.random() * window.innerWidth,
                Math.random() * window.innerWidth,
                Math.random() * window.innerWidth,
              ],
              y: [
                Math.random() * window.innerHeight,
                Math.random() * window.innerHeight,
                Math.random() * window.innerHeight,
              ],
            }}
            transition={{
              duration: Math.random() * 20 + 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Conteúdo principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <Card className="p-8 md:p-12 max-w-md mx-auto backdrop-blur-sm bg-white/95 shadow-2xl">
          <div className="text-center space-y-6">
            {/* Logo animado */}
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex justify-center mb-8"
            >
              <img 
                src={cnvidasLogo} 
                alt="CN Vidas" 
                className="h-24 w-auto"
              />
            </motion.div>

            {/* Status de ativação */}
            {activationStatus !== 'activated' ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                >
                  <Loader2 className="h-16 w-16 text-primary" />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Ativando seu plano
                  </h2>
                  <p className="text-gray-600">
                    Estamos confirmando seu pagamento e preparando tudo para você...
                  </p>
                </div>

                {/* Animação de progresso */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    animate={{
                      width: ["0%", "100%"],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>

                {/* Ícones animados */}
                <div className="flex justify-center gap-6 pt-4">
                  <motion.div
                    animate={{
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: 0,
                    }}
                  >
                    <Heart className="h-8 w-8 text-red-400" />
                  </motion.div>
                  <motion.div
                    animate={{
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: 0.3,
                    }}
                  >
                    <Shield className="h-8 w-8 text-green-400" />
                  </motion.div>
                  <motion.div
                    animate={{
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: 0.6,
                    }}
                  >
                    <Zap className="h-8 w-8 text-yellow-400" />
                  </motion.div>
                </div>
              </>
            ) : (
              <>
                {/* Sucesso */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  className="relative"
                >
                  <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 1 }}
                  >
                    <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-4"
                >
                  <h2 className="text-2xl font-bold text-gray-900">
                    Plano ativado com sucesso!
                  </h2>
                  <p className="text-gray-600">
                    Bem-vindo ao CN Vidas! Você agora tem acesso a todos os benefícios do seu plano.
                  </p>
                  
                  {/* Benefícios ativados */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="pt-4 space-y-2"
                  >
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm">Telemedicina 24/7 ativada</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm">Consultas de emergência disponíveis</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm">Acesso completo liberado</span>
                    </div>
                  </motion.div>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-sm text-gray-500 pt-2"
                  >
                    Redirecionando para o dashboard...
                  </motion.p>
                </motion.div>

                {/* Confetes */}
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={`confetti-${i}`}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B'][i % 5],
                        left: `${Math.random() * 100}%`,
                        top: '-10px',
                      }}
                      animate={{
                        y: window.innerHeight + 20,
                        x: (Math.random() - 0.5) * 200,
                        rotate: Math.random() * 360,
                      }}
                      transition={{
                        duration: Math.random() * 2 + 1,
                        delay: Math.random() * 0.5,
                        ease: "easeIn",
                      }}
                    />
                  ))}
                </div>

                {/* Sparkles */}
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute top-4 right-4"
                >
                  <Sparkles className="h-6 w-6 text-yellow-400" />
                </motion.div>
                <motion.div
                  animate={{
                    rotate: [0, -360],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute bottom-4 left-4"
                >
                  <Sparkles className="h-6 w-6 text-purple-400" />
                </motion.div>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}