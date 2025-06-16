import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Info,
  Heart,
  Users,
  DollarSign,
  Shield,
  CheckCircle2,
  TrendingUp,
  Globe,
  Smartphone,
  Clock,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface StepTwoProps {
  formData: any;
  onNext: () => void;
  onBack: () => void;
  user?: any;
}

export default function StepTwo({ formData, onNext, onBack, user }: StepTwoProps) {
  const features = [
    {
      icon: Heart,
      title: 'Sem Comissões Abusivas',
      description: 'A CNVidas cobra apenas 20% do valor da consulta, uma das menores taxas do mercado.'
    },
    {
      icon: Users,
      title: 'Controle Total',
      description: 'Você define seus horários, valores e como deseja atender seus pacientes.'
    },
    {
      icon: DollarSign,
      title: 'Pagamentos Rápidos',
      description: 'Receba seus pagamentos semanalmente via PIX, sem burocracia.'
    },
    {
      icon: Shield,
      title: 'Segurança e Privacidade',
      description: 'Plataforma segura com criptografia de ponta e conformidade com LGPD.'
    },
    {
      icon: TrendingUp,
      title: 'Cresça sua Prática',
      description: 'Alcance novos pacientes e expanda sua prática médica online.'
    },
    {
      icon: Globe,
      title: 'Atenda de Qualquer Lugar',
      description: 'Consultas online de onde você estiver, com flexibilidade total.'
    },
    {
      icon: Smartphone,
      title: 'Plataforma Moderna',
      description: 'Interface intuitiva e fácil de usar, otimizada para todos os dispositivos.'
    },
    {
      icon: Clock,
      title: 'Suporte 24/7',
      description: 'Equipe de suporte sempre disponível para ajudar você e seus pacientes.'
    }
  ];

  const philosophyPoints = [
    {
      title: 'Nossa Missão',
      content: 'Democratizar o acesso à saúde de qualidade, conectando médicos e pacientes de forma simples, segura e acessível.'
    },
    {
      title: 'Nossos Valores',
      content: 'Transparência, ética, inovação e cuidado humano em cada interação.'
    },
    {
      title: 'Nosso Compromisso',
      content: 'Empoderar médicos com tecnologia e autonomia, enquanto garantimos o melhor cuidado aos pacientes.'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto"
    >
      <Card className="shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Info className="h-6 w-6" />
            Bem-vindo à CNVidas
          </CardTitle>
          <CardDescription className="text-indigo-100">
            Conheça nossa plataforma e como podemos ajudar você a crescer
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Welcome Message */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center space-y-4"
          >
            <h2 className="text-3xl font-bold text-gray-800">
              Olá, Dr(a). {formData.fullName || user?.fullName || 'Doutor(a)'}! 👋
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Estamos muito felizes em tê-lo(a) conosco. A CNVidas foi criada para revolucionar 
              a forma como médicos e pacientes se conectam, sempre priorizando a qualidade do 
              atendimento e a autonomia profissional.
            </p>
          </motion.div>

          {/* Philosophy Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold text-gray-800">Nossa Filosofia</h3>
            <div className="grid gap-4">
              {philosophyPoints.map((point, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg"
                >
                  <h4 className="font-semibold text-gray-800 mb-1">{point.title}</h4>
                  <p className="text-gray-600">{point.content}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold text-gray-800">Por que escolher a CNVidas?</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex-shrink-0">
                    <feature.icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{feature.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Important Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="space-y-4"
          >
            <Alert className="border-indigo-200 bg-indigo-50">
              <Info className="h-4 w-4 text-indigo-600" />
              <AlertDescription className="text-indigo-800">
                <strong>Como funciona o sistema de pagamentos:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Pacientes do Plano Individual pagam 100% do valor da consulta</li>
                  <li>Pacientes do Plano Familiar pagam 50% do valor da consulta</li>
                  <li>A CNVidas retém apenas 20% como taxa de serviço</li>
                  <li>Pagamentos processados semanalmente via PIX</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Seus benefícios exclusivos:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Agenda flexível - você define quando atender</li>
                  <li>Atendimentos por vídeo de alta qualidade</li>
                  <li>Prontuário eletrônico integrado</li>
                  <li>Relatórios financeiros detalhados</li>
                  <li>Suporte técnico dedicado</li>
                </ul>
              </AlertDescription>
            </Alert>
          </motion.div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            className="bg-gradient-to-r from-indigo-100 to-purple-100 p-6 rounded-lg text-center"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Pronto para fazer parte dessa revolução na saúde?
            </h3>
            <p className="text-gray-600">
              No próximo passo, vamos configurar suas informações de pagamento para que você 
              possa começar a receber pelas consultas.
            </p>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="flex justify-between pt-6"
          >
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              onClick={onNext}
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 flex items-center gap-2"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}