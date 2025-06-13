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
  Building2,
  MapPin,
  ShoppingBag,
  Info,
  Phone,
  Mail,
  FileText,
  User,
  Globe,
  Percent,
  Clock,
  Star,
  Plus,
  Trash2,
  CreditCard
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface AddressData {
  name: string;
  cep: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  openingHours?: string;
  isPrimary: boolean;
}

interface ServiceData {
  name: string;
  description: string;
  category: string;
  regularPrice: number;
  discountPrice: number;
  duration: number;
  isFeatured: boolean;
}

export default function PartnerOnboardingPage() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  // Form state
  const [partnerData, setPartnerData] = useState({
    businessName: '',
    tradingName: '',
    businessType: '',
    cnpj: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    nationwideService: false
  });

  const [addressData, setAddressData] = useState<AddressData>({
    name: 'Matriz',
    cep: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    openingHours: '',
    isPrimary: true
  });

  const [serviceData, setServiceData] = useState<ServiceData>({
    name: '',
    description: '',
    category: '',
    regularPrice: 0,
    discountPrice: 0,
    duration: 30,
    isFeatured: false
  });

  // Check if user is a partner
  useEffect(() => {
    if (user && user.role !== 'partner') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Get current partner profile
  const { data: partnerProfile, isLoading } = useQuery({
    queryKey: ['/api/partners/me'],
    queryFn: ({ signal }) => 
      fetch('/api/partners/me', { 
        signal,
        credentials: 'include' 
      })
        .then(res => {
          if (!res.ok) throw new Error('Falha ao buscar perfil');
          return res.json();
        }),
    enabled: !!user && user.role === 'partner'
  });

  // Check existing addresses and services
  const { data: addresses } = useQuery({
    queryKey: ['/api/partners/addresses'],
    queryFn: ({ signal }) => 
      fetch('/api/partners/addresses', { 
        signal,
        credentials: 'include' 
      })
        .then(res => res.json()),
    enabled: !!partnerProfile
  });

  const { data: services } = useQuery({
    queryKey: ['/api/partners/my-services'],
    queryFn: ({ signal }) => 
      fetch('/api/partners/my-services', { 
        signal,
        credentials: 'include' 
      })
        .then(res => res.json()),
    enabled: !!partnerProfile
  });

  // Update form when profile loads
  useEffect(() => {
    if (partnerProfile) {
      setPartnerData({
        businessName: partnerProfile.businessName || '',
        tradingName: partnerProfile.tradingName || '',
        businessType: partnerProfile.businessType || '',
        cnpj: partnerProfile.cnpj || '',
        phone: partnerProfile.phone || '',
        email: partnerProfile.email || user?.email || '',
        website: partnerProfile.website || '',
        description: partnerProfile.description || '',
        nationwideService: partnerProfile.nationwideService || false
      });
      
      // If partner already has addresses and services, redirect
      if (addresses && addresses.length > 0 && services && services.length > 0) {
        navigate('/partner/dashboard');
      }
    }
  }, [partnerProfile, addresses, services, navigate, user]);

  // Update partner profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PUT', '/api/partners/me', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar perfil');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partners/me'] });
    }
  });

  // Create address mutation
  const createAddressMutation = useMutation({
    mutationFn: async (data: AddressData) => {
      const res = await apiRequest('POST', '/api/partners/addresses', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar endereço');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partners/addresses'] });
    }
  });

  // Create service mutation
  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceData) => {
      const res = await apiRequest('POST', '/api/partners/services', {
        ...data,
        discountPercentage: Math.round(((data.regularPrice - data.discountPrice) / data.regularPrice) * 100),
        isActive: true,
        isNational: partnerData.nationwideService
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar serviço');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Cadastro completado!',
        description: 'Bem-vindo ao CNVidas. Você já pode começar a gerenciar seus serviços.',
      });
      navigate('/partner/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar serviço',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleNext = async () => {
    if (step === 1) {
      // Validate business info
      if (!partnerData.businessName || !partnerData.businessType || !partnerData.cnpj || !partnerData.phone) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Por favor, preencha todos os campos obrigatórios.',
          variant: 'destructive'
        });
        return;
      }
      
      // Update partner profile
      try {
        await updateProfileMutation.mutateAsync(partnerData);
        setStep(2);
      } catch (error) {
        // Error is handled by mutation
      }
    } else if (step === 2) {
      // Validate address
      if (!addressData.name || !addressData.cep || !addressData.address || 
          !addressData.number || !addressData.neighborhood || !addressData.city || 
          !addressData.state || !addressData.phone) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Por favor, preencha todos os campos do endereço.',
          variant: 'destructive'
        });
        return;
      }
      
      // Create address
      try {
        await createAddressMutation.mutateAsync(addressData);
        setStep(3);
      } catch (error) {
        // Error is handled by mutation
      }
    } else if (step === 3) {
      // Validate service
      if (!serviceData.name || !serviceData.description || !serviceData.category || 
          !serviceData.regularPrice || !serviceData.discountPrice) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Por favor, preencha todos os campos do serviço.',
          variant: 'destructive'
        });
        return;
      }

      if (serviceData.discountPrice >= serviceData.regularPrice) {
        toast({
          title: 'Preço inválido',
          description: 'O preço com desconto deve ser menor que o preço regular.',
          variant: 'destructive'
        });
        return;
      }
      
      // Create service and complete onboarding
      createServiceMutation.mutate(serviceData);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // CEP lookup function
  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setAddressData({ ...addressData, cep: cleanCep });
    
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setAddressData(prev => ({
            ...prev,
            address: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const calculateDiscount = () => {
    if (serviceData.regularPrice && serviceData.discountPrice) {
      return Math.round(((serviceData.regularPrice - serviceData.discountPrice) / serviceData.regularPrice) * 100);
    }
    return 0;
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
            Bem-vindo ao CNVidas, {user?.name}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Complete seu cadastro para começar a oferecer seus serviços
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <Building2 className="h-5 w-5" />
            </div>
            <div className={`w-20 h-1 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <MapPin className="h-5 w-5" />
            </div>
            <div className={`w-20 h-1 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
        </div>

        <Card>
          {/* Step 1: Business Information */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informações da Empresa
                </CardTitle>
                <CardDescription>
                  Preencha os dados da sua empresa para que os usuários possam conhecê-la
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Como funciona a CNVidas para Parceiros</AlertTitle>
                  <AlertDescription className="space-y-2 mt-2">
                    <p>• Ofereça seus serviços com descontos exclusivos para assinantes</p>
                    <p>• Gerencie múltiplos endereços e filiais</p>
                    <p>• Valide carteirinhas dos usuários via QR Code</p>
                    <p>• Acompanhe estatísticas de uso e faturamento</p>
                    <p>• Sem taxa de adesão ou mensalidade</p>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="businessName">Razão Social *</Label>
                    <Input
                      id="businessName"
                      placeholder="Ex: Empresa de Saúde LTDA"
                      value={partnerData.businessName}
                      onChange={(e) => setPartnerData({ ...partnerData, businessName: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tradingName">Nome Fantasia</Label>
                    <Input
                      id="tradingName"
                      placeholder="Ex: Clínica Saúde & Vida"
                      value={partnerData.tradingName}
                      onChange={(e) => setPartnerData({ ...partnerData, tradingName: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="businessType">Tipo de Negócio *</Label>
                    <Select
                      value={partnerData.businessType}
                      onValueChange={(value) => setPartnerData({ ...partnerData, businessType: value })}
                    >
                      <SelectTrigger id="businessType">
                        <SelectValue placeholder="Selecione o tipo de negócio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinica">Clínica</SelectItem>
                        <SelectItem value="laboratorio">Laboratório</SelectItem>
                        <SelectItem value="farmacia">Farmácia</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                        <SelectItem value="consultorio">Consultório</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={partnerData.cnpj}
                      onChange={(e) => setPartnerData({ ...partnerData, cnpj: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={partnerData.phone}
                      onChange={(e) => setPartnerData({ ...partnerData, phone: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      placeholder="https://www.suaempresa.com.br"
                      value={partnerData.website}
                      onChange={(e) => setPartnerData({ ...partnerData, website: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Descrição da Empresa</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva brevemente sua empresa e os serviços oferecidos..."
                      rows={4}
                      value={partnerData.description}
                      onChange={(e) => setPartnerData({ ...partnerData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nationwide"
                      checked={partnerData.nationwideService}
                      onCheckedChange={(checked) => setPartnerData({ ...partnerData, nationwideService: checked })}
                    />
                    <Label htmlFor="nationwide" className="cursor-pointer">
                      Atendimento em todo o Brasil (serviços online/delivery)
                    </Label>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Address Information */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço Principal
                </CardTitle>
                <CardDescription>
                  Cadastre o endereço principal do seu estabelecimento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="addressName">Nome do Local *</Label>
                    <Input
                      id="addressName"
                      placeholder="Ex: Matriz, Filial Centro"
                      value={addressData.name}
                      onChange={(e) => setAddressData({ ...addressData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input
                      id="cep"
                      placeholder="00000-000"
                      value={addressData.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      maxLength={9}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 grid gap-2">
                      <Label htmlFor="address">Endereço *</Label>
                      <Input
                        id="address"
                        placeholder="Rua, Avenida..."
                        value={addressData.address}
                        onChange={(e) => setAddressData({ ...addressData, address: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="number">Número *</Label>
                      <Input
                        id="number"
                        placeholder="123"
                        value={addressData.number}
                        onChange={(e) => setAddressData({ ...addressData, number: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="complement">Complemento</Label>
                    <Input
                      id="complement"
                      placeholder="Sala, Andar, Bloco..."
                      value={addressData.complement}
                      onChange={(e) => setAddressData({ ...addressData, complement: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input
                        id="neighborhood"
                        placeholder="Bairro"
                        value={addressData.neighborhood}
                        onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade *</Label>
                      <Input
                        id="city"
                        placeholder="Cidade"
                        value={addressData.city}
                        onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="state">Estado *</Label>
                    <Input
                      id="state"
                      placeholder="SP"
                      maxLength={2}
                      value={addressData.state}
                      onChange={(e) => setAddressData({ ...addressData, state: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="addressPhone">Telefone do Local *</Label>
                    <Input
                      id="addressPhone"
                      placeholder="(11) 99999-9999"
                      value={addressData.phone}
                      onChange={(e) => setAddressData({ ...addressData, phone: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="addressEmail">E-mail do Local</Label>
                    <Input
                      id="addressEmail"
                      type="email"
                      placeholder="contato@local.com.br"
                      value={addressData.email}
                      onChange={(e) => setAddressData({ ...addressData, email: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="openingHours">Horário de Funcionamento</Label>
                    <Textarea
                      id="openingHours"
                      placeholder="Ex: Segunda a Sexta: 8h às 18h&#10;Sábado: 8h às 12h"
                      rows={3}
                      value={addressData.openingHours}
                      onChange={(e) => setAddressData({ ...addressData, openingHours: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Service Information */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Primeiro Serviço
                </CardTitle>
                <CardDescription>
                  Cadastre seu primeiro serviço com desconto para assinantes CNVidas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Política de Descontos</AlertTitle>
                  <AlertDescription className="space-y-2 mt-2">
                    <p>• Ofereça descontos exclusivos para assinantes CNVidas</p>
                    <p>• Desconto mínimo recomendado: 10%</p>
                    <p>• Você recebe o valor integral do serviço com desconto</p>
                    <p>• Assinantes apresentam carteirinha digital para validação</p>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="serviceName">Nome do Serviço *</Label>
                    <Input
                      id="serviceName"
                      placeholder="Ex: Consulta Médica, Exame de Sangue"
                      value={serviceData.name}
                      onChange={(e) => setServiceData({ ...serviceData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="serviceDescription">Descrição do Serviço *</Label>
                    <Textarea
                      id="serviceDescription"
                      placeholder="Descreva o serviço, o que está incluído, benefícios..."
                      rows={4}
                      value={serviceData.description}
                      onChange={(e) => setServiceData({ ...serviceData, description: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select
                      value={serviceData.category}
                      onValueChange={(value) => setServiceData({ ...serviceData, category: value })}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultas">Consultas</SelectItem>
                        <SelectItem value="exames">Exames</SelectItem>
                        <SelectItem value="procedimentos">Procedimentos</SelectItem>
                        <SelectItem value="terapias">Terapias</SelectItem>
                        <SelectItem value="odontologia">Odontologia</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="regularPrice">Preço Regular (R$) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          R$
                        </span>
                        <Input
                          id="regularPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          className="pl-10"
                          value={serviceData.regularPrice}
                          onChange={(e) => setServiceData({ ...serviceData, regularPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="discountPrice">Preço com Desconto (R$) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          R$
                        </span>
                        <Input
                          id="discountPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          className="pl-10"
                          value={serviceData.discountPrice}
                          onChange={(e) => setServiceData({ ...serviceData, discountPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {serviceData.regularPrice > 0 && serviceData.discountPrice > 0 && (
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Desconto oferecido:</span>
                        <Badge variant="secondary" className="text-lg">
                          <Percent className="h-4 w-4 mr-1" />
                          {calculateDiscount()}% OFF
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Economia de R$ {(serviceData.regularPrice - serviceData.discountPrice).toFixed(2)} para o assinante
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duração do Serviço (minutos)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="15"
                      step="15"
                      placeholder="30"
                      value={serviceData.duration}
                      onChange={(e) => setServiceData({ ...serviceData, duration: parseInt(e.target.value) || 30 })}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={serviceData.isFeatured}
                      onCheckedChange={(checked) => setServiceData({ ...serviceData, isFeatured: checked })}
                    />
                    <Label htmlFor="featured" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        Destacar este serviço
                      </div>
                    </Label>
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
                disabled={updateProfileMutation.isPending || createAddressMutation.isPending || createServiceMutation.isPending}
              >
                Voltar
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              disabled={updateProfileMutation.isPending || createAddressMutation.isPending || createServiceMutation.isPending}
              className={step === 1 ? 'ml-auto' : ''}
            >
              {(updateProfileMutation.isPending || createAddressMutation.isPending || createServiceMutation.isPending) ? (
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
        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Vantagens de ser Parceiro CNVidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Sem taxas ou mensalidades</p>
                  <p className="text-sm text-muted-foreground">Não cobramos nenhuma taxa para você ser parceiro</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Aumente sua visibilidade</p>
                  <p className="text-sm text-muted-foreground">Apareça para milhares de assinantes CNVidas</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Validação simplificada</p>
                  <p className="text-sm text-muted-foreground">Use QR Code para validar carteirinhas instantaneamente</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Gestão completa</p>
                  <p className="text-sm text-muted-foreground">Gerencie serviços, endereços e acompanhe estatísticas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
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
    </div>
  );
}