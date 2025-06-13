import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Stethoscope,
  CreditCard,
  DollarSign,
  Info,
  Building,
  Key,
  Phone,
  Mail,
  FileText,
  User
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface DoctorProfileData {
  specialization: string;
  licenseNumber: string;
  biography: string;
  education: string;
  experienceYears: number;
  consultationFee: number;
  pixKeyType: string;
  pixKey: string;
  bankName: string;
  accountType: string;
}

export default function DoctorOnboardingPage() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState<DoctorProfileData>({
    specialization: '',
    licenseNumber: '',
    biography: '',
    education: '',
    experienceYears: 0,
    consultationFee: 0,
    pixKeyType: '',
    pixKey: '',
    bankName: '',
    accountType: 'corrente'
  });

  // Check if user is a doctor
  useEffect(() => {
    if (user && user.role !== 'doctor') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Get current doctor profile
  const { data: doctorProfile, isLoading } = useQuery({
    queryKey: ['/api/doctors/profile'],
    queryFn: ({ signal }) => 
      fetch('/api/doctors/profile', { 
        signal,
        credentials: 'include' 
      })
        .then(res => {
          if (!res.ok) throw new Error('Falha ao buscar perfil');
          return res.json();
        }),
    enabled: !!user && user.role === 'doctor'
  });

  // Update form when profile loads
  useEffect(() => {
    if (doctorProfile) {
      setFormData({
        specialization: doctorProfile.specialization || '',
        licenseNumber: doctorProfile.licenseNumber || '',
        biography: doctorProfile.biography || '',
        education: doctorProfile.education || '',
        experienceYears: doctorProfile.experienceYears || 0,
        consultationFee: doctorProfile.consultationFee || 0,
        pixKeyType: doctorProfile.pixKeyType || '',
        pixKey: doctorProfile.pixKey || '',
        bankName: doctorProfile.bankName || '',
        accountType: doctorProfile.accountType || 'corrente'
      });
      
      // If profile is already complete, redirect to dashboard
      if (doctorProfile.welcomeCompleted) {
        navigate('/doctor-telemedicine');
      }
    }
  }, [doctorProfile, navigate]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<DoctorProfileData>) => {
      const res = await apiRequest('PUT', '/api/doctors/profile', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar perfil');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
    }
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PUT', '/api/doctors/profile', { 
        ...formData,
        welcomeCompleted: true 
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao completar cadastro');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Cadastro completado!',
        description: 'Bem-vindo ao CNVidas. Você já pode começar a atender pacientes.',
      });
      navigate('/doctor-telemedicine');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao completar cadastro',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleNext = async () => {
    if (step === 1) {
      // Validate professional info
      if (!formData.specialization || !formData.licenseNumber || !formData.education) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Por favor, preencha todos os campos profissionais.',
          variant: 'destructive'
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate consultation fee
      if (!formData.consultationFee || formData.consultationFee < 50) {
        toast({
          title: 'Valor inválido',
          description: 'O valor mínimo da consulta é R$ 50,00.',
          variant: 'destructive'
        });
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Validate payment info
      if (!formData.pixKeyType || !formData.pixKey || !formData.bankName) {
        toast({
          title: 'Dados bancários obrigatórios',
          description: 'Por favor, preencha todos os dados bancários para receber pagamentos.',
          variant: 'destructive'
        });
        return;
      }
      // Complete onboarding
      completeOnboardingMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Bem-vindo ao CNVidas, Dr(a). {user?.name}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Complete seu cadastro para começar a atender pacientes
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className={`w-20 h-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div className={`w-20 h-1 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
        </div>

        <Card>
          {/* Step 1: Professional Information */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Informações Profissionais
                </CardTitle>
                <CardDescription>
                  Preencha seus dados profissionais para que os pacientes possam conhecê-lo melhor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="specialization">Especialidade *</Label>
                    <Input
                      id="specialization"
                      placeholder="Ex: Cardiologia, Clínica Geral, Pediatria"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="licenseNumber">Número do CRM *</Label>
                    <Input
                      id="licenseNumber"
                      placeholder="Ex: 123456/SP"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="education">Formação Acadêmica *</Label>
                    <Input
                      id="education"
                      placeholder="Ex: Medicina - USP (2015)"
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="experienceYears">Anos de Experiência</Label>
                    <Input
                      id="experienceYears"
                      type="number"
                      min="0"
                      placeholder="Ex: 10"
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="biography">Biografia (opcional)</Label>
                    <Textarea
                      id="biography"
                      placeholder="Conte um pouco sobre sua experiência e abordagem médica..."
                      rows={4}
                      value={formData.biography}
                      onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Consultation Fee */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Valor da Consulta
                </CardTitle>
                <CardDescription>
                  Defina o valor da sua consulta online
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Como funciona o pagamento</AlertTitle>
                  <AlertDescription className="space-y-2 mt-2">
                    <p>• Pacientes do <strong>Plano Individual</strong>: Pagam 100% do valor da consulta</p>
                    <p>• Pacientes do <strong>Plano Familiar</strong>: Pagam 50% do valor da consulta</p>
                    <p>• A CNVidas retém uma taxa de 20% sobre o valor recebido</p>
                    <p>• Pagamentos são processados semanalmente via PIX</p>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="consultationFee">Valor da Consulta (R$) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        R$
                      </span>
                      <Input
                        id="consultationFee"
                        type="number"
                        min="50"
                        step="10"
                        placeholder="0,00"
                        className="pl-10"
                        value={formData.consultationFee}
                        onChange={(e) => setFormData({ ...formData, consultationFee: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Valor mínimo: R$ 50,00
                    </p>
                  </div>

                  {formData.consultationFee > 0 && (
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <h4 className="font-medium">Simulação de recebimento:</h4>
                      <div className="space-y-1 text-sm">
                        <p>• Plano Individual: Paciente paga R$ {formData.consultationFee.toFixed(2)}</p>
                        <p>• Plano Familiar: Paciente paga R$ {(formData.consultationFee * 0.5).toFixed(2)}</p>
                        <Separator className="my-2" />
                        <p className="font-medium">Você recebe (após taxa de 20%):</p>
                        <p>• Consulta Individual: R$ {(formData.consultationFee * 0.8).toFixed(2)}</p>
                        <p>• Consulta Familiar: R$ {(formData.consultationFee * 0.5 * 0.8).toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Payment Information */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Dados Bancários
                </CardTitle>
                <CardDescription>
                  Informe seus dados para receber os pagamentos das consultas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Pagamentos via PIX</AlertTitle>
                  <AlertDescription>
                    Todos os pagamentos são realizados exclusivamente via PIX, garantindo rapidez e segurança nas transações.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pixKeyType">Tipo de Chave PIX *</Label>
                    <Select
                      value={formData.pixKeyType}
                      onValueChange={(value) => setFormData({ ...formData, pixKeyType: value })}
                    >
                      <SelectTrigger id="pixKeyType">
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
                      onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bankName">Banco *</Label>
                    <Input
                      id="bankName"
                      placeholder="Ex: Banco do Brasil, Itaú, Bradesco"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="accountType">Tipo de Conta *</Label>
                    <Select
                      value={formData.accountType}
                      onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                    >
                      <SelectTrigger id="accountType">
                        <SelectValue placeholder="Selecione o tipo de conta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Conta Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-between">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={completeOnboardingMutation.isPending}
              >
                Voltar
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              disabled={completeOnboardingMutation.isPending}
              className={step === 1 ? 'ml-auto' : ''}
            >
              {completeOnboardingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : step === 3 ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completar Cadastro
                </>
              ) : (
                'Próximo'
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Additional Information */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Ao completar seu cadastro, você concorda com nossos{' '}
            <a href="/termos" className="underline hover:text-primary">
              Termos de Uso
            </a>{' '}
            e{' '}
            <a href="/privacidade" className="underline hover:text-primary">
              Política de Privacidade
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}