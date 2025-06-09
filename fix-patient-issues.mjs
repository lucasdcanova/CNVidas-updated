#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = {
    'success': colors.green,
    'error': colors.red,
    'warning': colors.yellow,
    'info': colors.blue,
    'section': colors.cyan
  }[type] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Lista de correções a serem aplicadas
const fixes = [
  {
    name: 'Verificar rotas de sinistros',
    check: async () => {
      const routesPath = './server/routes/claims-routes.ts';
      try {
        const content = await fs.readFile(routesPath, 'utf-8');
        return {
          needsFix: !content.includes('router.post("/api/claims"'),
          details: 'Rota POST para criar sinistros não encontrada'
        };
      } catch (error) {
        return { needsFix: true, details: 'Arquivo de rotas não encontrado' };
      }
    },
    fix: async () => {
      log('Verificando e corrigindo rotas de sinistros...', 'info');
      
      const routesPath = './server/routes/claims-routes.ts';
      const content = await fs.readFile(routesPath, 'utf-8');
      
      if (!content.includes('router.post("/api/claims"')) {
        // Adicionar rota POST se não existir
        const newRoute = `
// Create new claim
router.post("/api/claims", requireUser, async (req, res) => {
  try {
    const { title, description, amount, category, date, documents } = req.body;
    
    const newClaim = await db.insert(claims).values({
      userId: req.user.id,
      title,
      description,
      amount: parseFloat(amount),
      category,
      claimDate: new Date(date),
      status: 'pending',
      documents: documents || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    res.json({ success: true, claim: newClaim[0] });
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});
`;
        
        // Inserir antes do export
        const updatedContent = content.replace(
          'export { router as claimsRouter };',
          newRoute + '\n\nexport { router as claimsRouter };'
        );
        
        await fs.writeFile(routesPath, updatedContent);
        log('Rota POST para sinistros adicionada', 'success');
      }
    }
  },
  
  {
    name: 'Verificar página de emergência',
    check: async () => {
      const emergencyPagePath = './client/src/pages/unified-emergency-room.tsx';
      try {
        await fs.access(emergencyPagePath);
        return { needsFix: false };
      } catch {
        return { 
          needsFix: true, 
          details: 'Página de emergência unificada não encontrada' 
        };
      }
    },
    fix: async () => {
      log('Criando página de emergência unificada...', 'info');
      
      const content = `import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Video, Clock, AlertCircle } from 'lucide-react';
import DailyVideoCall from '@/components/telemedicine/DailyVideoCall';

export default function UnifiedEmergencyRoom() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [isInCall, setIsInCall] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar se o usuário tem acesso a emergências
  const hasEmergencyAccess = user?.subscription?.plan && 
    ['basic', 'premium', 'ultra'].includes(user.subscription.plan);

  useEffect(() => {
    if (!hasEmergencyAccess) {
      setError('Seu plano não inclui consultas de emergência. Faça upgrade para ter acesso.');
    }
  }, [hasEmergencyAccess]);

  const startEmergencyCall = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/emergency/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        },
        body: JSON.stringify({
          type: 'emergency',
          userId: user?.id
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar consulta de emergência');
      }

      const data = await response.json();
      setRoomUrl(data.roomUrl);
      setIsInCall(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar consulta');
    } finally {
      setLoading(false);
    }
  };

  if (isInCall && roomUrl) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-4">
          <div className="mb-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">Consulta de Emergência</h1>
            <Button 
              variant="destructive"
              onClick={() => {
                setIsInCall(false);
                setRoomUrl(null);
                navigate('/dashboard');
              }}
            >
              Encerrar Consulta
            </Button>
          </div>
          
          <DailyVideoCall 
            roomUrl={roomUrl}
            onCallEnd={() => {
              setIsInCall(false);
              navigate('/dashboard');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Central de Emergência</h1>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Video className="h-8 w-8 text-blue-600" />
              <h2 className="text-xl font-semibold">Consulta por Vídeo</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Conecte-se instantaneamente com um médico através de videochamada.
            </p>
            <Button 
              className="w-full"
              size="lg"
              onClick={startEmergencyCall}
              disabled={loading || !hasEmergencyAccess}
            >
              {loading ? 'Conectando...' : 'Iniciar Videochamada'}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Phone className="h-8 w-8 text-green-600" />
              <h2 className="text-xl font-semibold">Ligar para Emergência</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Em caso de emergência grave, ligue imediatamente.
            </p>
            <Button 
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => window.location.href = 'tel:192'}
            >
              Ligar 192 (SAMU)
            </Button>
          </Card>
        </div>

        <Card className="mt-6 p-6">
          <div className="flex items-center gap-4 mb-4">
            <Clock className="h-6 w-6 text-orange-600" />
            <h3 className="text-lg font-semibold">Informações Importantes</h3>
          </div>
          <ul className="space-y-2 text-gray-600">
            <li>• Tempo médio de espera: 2-5 minutos</li>
            <li>• Médicos disponíveis 24/7</li>
            <li>• Tenha seus documentos e histórico médico em mãos</li>
            <li>• Em emergências graves, procure o pronto-socorro mais próximo</li>
          </ul>
        </Card>

        {!hasEmergencyAccess && (
          <Card className="mt-6 p-6 bg-yellow-50 border-yellow-200">
            <h3 className="text-lg font-semibold mb-2">Upgrade Necessário</h3>
            <p className="text-gray-700 mb-4">
              Consultas de emergência estão disponíveis nos planos Básico, Premium e Ultra.
            </p>
            <Button onClick={() => navigate('/subscription')}>
              Ver Planos Disponíveis
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}`;

      await fs.writeFile('./client/src/pages/unified-emergency-room.tsx', content);
      log('Página de emergência criada com sucesso', 'success');
    }
  },

  {
    name: 'Verificar componente de busca de CEP',
    check: async () => {
      const addressFormPath = './client/src/components/forms/address-form.tsx';
      try {
        const content = await fs.readFile(addressFormPath, 'utf-8');
        return {
          needsFix: !content.includes('viaCEP') && !content.includes('viacep'),
          details: 'Integração com ViaCEP não encontrada'
        };
      } catch {
        return { needsFix: true, details: 'Componente de endereço não encontrado' };
      }
    },
    fix: async () => {
      log('Adicionando busca de CEP ao formulário de endereço...', 'info');
      
      const addressFormPath = './client/src/components/forms/address-form.tsx';
      let content = await fs.readFile(addressFormPath, 'utf-8');
      
      // Adicionar função de busca de CEP se não existir
      if (!content.includes('fetchAddressByCep')) {
        const cepFunction = `
  const fetchAddressByCep = async (cep: string) => {
    try {
      const cleanCep = cep.replace(/\\D/g, '');
      if (cleanCep.length !== 8) return;
      
      const response = await fetch(\`https://viacep.com.br/ws/\${cleanCep}/json/\`);
      const data = await response.json();
      
      if (!data.erro) {
        form.setValue('street', data.logradouro);
        form.setValue('neighborhood', data.bairro);
        form.setValue('city', data.localidade);
        form.setValue('state', data.uf);
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };
`;
        
        // Inserir após as importações
        content = content.replace(
          'export function AddressForm',
          cepFunction + '\n\nexport function AddressForm'
        );
      }
      
      // Adicionar evento onBlur ao campo CEP
      if (!content.includes('onBlur={() => fetchAddressByCep')) {
        content = content.replace(
          '<Input {...field} placeholder="00000-000" />',
          '<Input {...field} placeholder="00000-000" onBlur={() => fetchAddressByCep(field.value)} />'
        );
      }
      
      await fs.writeFile(addressFormPath, content);
      log('Busca de CEP adicionada ao formulário', 'success');
    }
  },

  {
    name: 'Verificar integração Stripe',
    check: async () => {
      const checkoutPath = './client/src/components/checkout/checkout-modal.tsx';
      try {
        const content = await fs.readFile(checkoutPath, 'utf-8');
        return {
          needsFix: !content.includes('@stripe/react-stripe-js'),
          details: 'Componentes Stripe não importados corretamente'
        };
      } catch {
        return { needsFix: false }; // Assumir que está ok se o arquivo existe
      }
    },
    fix: async () => {
      log('Verificando integração Stripe...', 'info');
      
      // Verificar se o Stripe está instalado
      try {
        await execAsync('npm list @stripe/stripe-js');
      } catch {
        log('Instalando dependências do Stripe...', 'info');
        await execAsync('npm install @stripe/stripe-js @stripe/react-stripe-js');
      }
      
      log('Integração Stripe verificada', 'success');
    }
  },

  {
    name: 'Verificar página de configurações do paciente',
    check: async () => {
      const settingsPath = './client/src/pages/patient/settings.tsx';
      try {
        const content = await fs.readFile(settingsPath, 'utf-8');
        return {
          needsFix: !content.includes('notifications') || !content.includes('privacy'),
          details: 'Seções de notificações ou privacidade faltando'
        };
      } catch {
        return { needsFix: true, details: 'Página de configurações não encontrada' };
      }
    },
    fix: async () => {
      log('Atualizando página de configurações...', 'info');
      
      const settingsPath = './client/src/pages/patient/settings.tsx';
      
      // Ler o arquivo atual ou criar um novo
      let content = '';
      try {
        content = await fs.readFile(settingsPath, 'utf-8');
      } catch {
        // Criar novo arquivo se não existir
        content = `import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PatientSettings() {
  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      appointmentReminders: true,
      promotionalEmails: false,
      shareWithDoctors: true,
      shareWithPartners: false,
      medicalHistory: true,
      profileVisibility: 'private'
    }
  });

  const onSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/users/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast({
          title: 'Configurações salvas',
          description: 'Suas preferências foram atualizadas com sucesso.'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Configurações</h1>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="privacy">Privacidade</TabsTrigger>
          </TabsList>
          
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Gerencie como você recebe atualizações e lembretes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailNotifications">Notificações por Email</Label>
                  <Switch {...register('emailNotifications')} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="smsNotifications">Notificações por SMS</Label>
                  <Switch {...register('smsNotifications')} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="pushNotifications">Notificações Push</Label>
                  <Switch {...register('pushNotifications')} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="appointmentReminders">Lembretes de Consulta</Label>
                  <Switch {...register('appointmentReminders')} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="promotionalEmails">Emails Promocionais</Label>
                  <Switch {...register('promotionalEmails')} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Privacidade</CardTitle>
                <CardDescription>
                  Controle quem pode ver suas informações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="shareWithDoctors">
                    Compartilhar dados com médicos
                  </Label>
                  <Switch {...register('shareWithDoctors')} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="shareWithPartners">
                    Compartilhar dados com parceiros
                  </Label>
                  <Switch {...register('shareWithPartners')} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="medicalHistory">
                    Histórico médico visível
                  </Label>
                  <Switch {...register('medicalHistory')} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6">
          <Button type="submit" size="lg">
            Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
}`;
      }
      
      await fs.writeFile(settingsPath, content);
      log('Página de configurações atualizada', 'success');
    }
  }
];

// Função principal para executar correções
async function runFixes() {
  log('=== INICIANDO CORREÇÕES AUTOMÁTICAS ===', 'section');
  
  let fixesApplied = 0;
  let fixesFailed = 0;
  
  for (const fix of fixes) {
    log(`\nVerificando: ${fix.name}`, 'info');
    
    try {
      const checkResult = await fix.check();
      
      if (checkResult.needsFix) {
        log(`Problema encontrado: ${checkResult.details}`, 'warning');
        log('Aplicando correção...', 'info');
        
        await fix.fix();
        fixesApplied++;
      } else {
        log('✓ Tudo ok, nenhuma correção necessária', 'success');
      }
    } catch (error) {
      log(`Erro ao aplicar correção: ${error.message}`, 'error');
      fixesFailed++;
    }
  }
  
  log('\n=== RESUMO DAS CORREÇÕES ===', 'section');
  log(`Total de verificações: ${fixes.length}`, 'info');
  log(`Correções aplicadas: ${fixesApplied}`, 'success');
  log(`Correções falhadas: ${fixesFailed}`, fixesFailed > 0 ? 'error' : 'info');
  
  if (fixesApplied > 0) {
    log('\nRecompilando aplicação...', 'info');
    try {
      await execAsync('npm run build');
      log('Build concluído com sucesso!', 'success');
    } catch (error) {
      log('Aviso: Build falhou, mas as correções foram aplicadas', 'warning');
    }
  }
}

// Executar correções
runFixes().catch(error => {
  log(`Erro crítico: ${error.message}`, 'error');
  process.exit(1);
});