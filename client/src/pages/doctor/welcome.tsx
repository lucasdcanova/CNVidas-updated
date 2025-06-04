import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AirVent, AlertCircle, ArrowRight, Calendar, CheckCircle, CircleDollarSign, Clipboard, Clock, FileEdit, Stethoscope, ThumbsUp, User, UserCog } from 'lucide-react';
import logoPath from '@assets/Logotipo_cnvidas_comprido_transparent_advanced_fuzz3.png';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

// Função para determinar se o nome é masculino ou feminino
function determinaGenero(fullName?: string): string {
  if (!fullName) return "Doutor";
  
  // Obtém o primeiro nome
  const primeiroNome = fullName.split(' ')[0].toLowerCase();
  
  // Lista de nomes femininos comuns no Brasil
  const nomesFemininos = [
    'ana', 'maria', 'julia', 'fernanda', 'camila', 'gabriela', 'carolina', 'beatriz', 
    'leticia', 'amanda', 'larissa', 'mariana', 'juliana', 'aline', 'bruna', 'patricia', 
    'tatiana', 'natalia', 'claudia', 'lucia', 'helena', 'monica', 'renata', 'denise',
    'lívia', 'alessandra', 'isabela', 'marcela', 'rafaela', 'joana', 'adriana', 'priscila',
    'carla', 'cristina', 'eduarda', 'giovanna', 'jessica', 'kelly', 'luana', 'paloma',
    'sabrina', 'viviane', 'roberta', 'raquel', 'elisa', 'silvia', 'bárbara', 'vanessa'
  ];
  
  // Verifica se o primeiro nome está na lista de nomes femininos
  if (nomesFemininos.includes(primeiroNome)) {
    return "Doutora";
  }
  
  // Por padrão, retorna o tratamento masculino se não identificar como feminino
  return "Doutor";
}

// Animação para fade-in dos elementos
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

// Animação para os cards com delay por etapa
const staggered = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export const DoctorWelcome: React.FC = () => {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState('overview');
  const [isFirstLogin, setIsFirstLogin] = useState(true);
  
  // Verifica se é o primeiro login do médico
  useEffect(() => {
    const checkFirstLogin = async () => {
      try {
        const response = await apiRequest('GET', '/api/doctors/welcome-status');
        if (response.ok) {
          const data = await response.json();
          setIsFirstLogin(data.isFirstLogin);
          if (!data.isFirstLogin) {
            // Se não for o primeiro login, redireciona para o dashboard
            navigate('/doctor-telemedicine');
          }
        }
      } catch (error) {
        console.error("Erro ao verificar status de boas-vindas:", error);
      }
    };
    
    checkFirstLogin();
  }, [navigate]);
  
  // Função para marcar o tutorial como concluído
  const completeWelcome = async () => {
    try {
      await apiRequest('POST', '/api/doctors/complete-welcome');
      navigate('/doctor-telemedicine');
    } catch (error) {
      console.error("Erro ao marcar boas-vindas como concluído:", error);
      // Mesmo com erro, navega para o dashboard
      navigate('/doctor-telemedicine');
    }
  };
  
  // Se não for o primeiro login, não renderiza a página
  if (!isFirstLogin) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <motion.div 
        className="container max-w-5xl mx-auto py-12 px-4 sm:px-6"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <div className="text-center mb-12">

          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-col items-center justify-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              Bem-vindo ao
              <img 
                src={logoPath} 
                alt="CN Vidas Logo" 
                className="h-20 inline-block"
              />
              , {determinaGenero(user?.fullName)}{user?.fullName ? ` ${user.fullName.split(' ')[0]}` : ''}!
            </h1>
          </motion.div>
          
          <motion.p 
            className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Estamos muito felizes em tê-lo conosco. Vamos conhecer um pouco mais sobre a plataforma?
          </motion.p>
        </div>
        
        <Tabs defaultValue="overview" value={currentStep} onValueChange={setCurrentStep} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="features">Recursos</TabsTrigger>
            <TabsTrigger value="getstarted">Começar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <motion.div 
              className="space-y-6"
              variants={staggered}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeIn}>
                <Card className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/10 pb-3">
                    <CardTitle className="flex items-center">
                      <ThumbsUp className="h-5 w-5 mr-2 text-primary" />
                      Somos médicos ajudando médicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Na CN Vidas, nossa missão é conectar profissionais de saúde com pacientes, facilitando o acesso à medicina de qualidade. 
                      Nossa plataforma foi criada por médicos para médicos, entendendo as reais necessidades da prática clínica moderna.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div variants={fadeIn}>
                <Card className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/10 pb-3">
                    <CardTitle className="flex items-center">
                      <CircleDollarSign className="h-5 w-5 mr-2 text-primary" />
                      Controle total sobre seus rendimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Você tem controle total de quanto irá cobrar por consulta agendada. A CN Vidas <strong>NÃO</strong> retém 
                      nenhuma porcentagem do seu trabalho - seu rendimento é 100% seu.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div variants={fadeIn}>
                <Card className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/10 pb-3">
                    <CardTitle className="flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2 text-primary" />
                      Atendimentos de emergência
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Você pode escolher se deseja atender consultas de emergência. Basta ativar o toggle 
                      de disponibilidade no seu painel. A CN Vidas repassa R$ 50,00 por consulta de emergência realizada.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <div className="flex justify-end mt-8">
                <Button onClick={() => setCurrentStep('features')} className="flex items-center">
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </TabsContent>
          
          <TabsContent value="features">
            <motion.div 
              className="space-y-6"
              variants={staggered}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeIn}>
                <Card className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/10 pb-3">
                    <CardTitle className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-primary" />
                      Gerencie sua disponibilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Você tem controle completo sobre quando os pacientes podem marcar consultas. 
                      Configure seus horários disponíveis, duração das consultas e períodos de bloqueio 
                      na página de gerenciamento de disponibilidade.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div variants={fadeIn}>
                <Card className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/10 pb-3">
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-primary" />
                      Complete seu perfil profissional
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Lembre-se de preencher seu perfil completo e adicionar uma foto profissional. 
                      Pacientes têm mais confiança em agendar com médicos que têm perfis completos e 
                      profissionais. Sua apresentação faz toda a diferença!
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div variants={fadeIn}>
                <Card className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/10 pb-3">
                    <CardTitle className="flex items-center">
                      <Clipboard className="h-5 w-5 mr-2 text-primary" />
                      Autonomia profissional completa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Você tem controle e autonomia totais sobre suas condutas médicas. 
                      A CN Vidas nunca irá questioná-lo sobre suas condutas na plataforma, 
                      mas lembre-se que você é responsável por elas, como em qualquer atendimento médico.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={() => setCurrentStep('overview')} className="flex items-center">
                  Anterior
                </Button>
                <Button onClick={() => setCurrentStep('getstarted')} className="flex items-center">
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </TabsContent>
          
          <TabsContent value="getstarted">
            <motion.div 
              className="space-y-6"
              variants={staggered}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeIn} className="text-center mb-8">
                <CheckCircle className="h-16 w-16 mx-auto text-primary mb-4" />
                <h2 className="text-2xl font-bold">Tudo pronto para começar!</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                  Agora que você conhece os principais aspectos da CN Vidas, 
                  recomendamos seguir estes primeiros passos:
                </p>
              </motion.div>
              
              <motion.div variants={fadeIn} className="grid gap-4 md:grid-cols-2">
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <UserCog className="h-4 w-4 mr-2 text-primary" />
                      1. Complete seu perfil
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Adicione sua especialidade, experiência, foto e outras informações relevantes.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-primary" />
                      2. Configure disponibilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Defina seus horários de atendimento para consultas agendadas.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <FileEdit className="h-4 w-4 mr-2 text-primary" />
                      3. Defina seus preços
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Estabeleça seus valores para consultas normais e especializadas.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <AirVent className="h-4 w-4 mr-2 text-primary" />
                      4. Ative emergências (opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Se deseja atender emergências, ative essa opção no seu painel.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div 
                variants={fadeIn}
                className="mt-12 text-center"
              >
                <p className="text-muted-foreground mb-6">
                  Seja bem-vindo à CN Vidas.<br />
                  <span className="text-primary font-semibold">Somos médicos ajudando médicos.</span>
                </p>
                
                <Button 
                  size="lg" 
                  onClick={completeWelcome} 
                  className="px-8"
                >
                  Acessar meu Dashboard
                </Button>
              </motion.div>
              
              <div className="flex justify-start mt-8">
                <Button variant="outline" onClick={() => setCurrentStep('features')} className="flex items-center">
                  Anterior
                </Button>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default DoctorWelcome;