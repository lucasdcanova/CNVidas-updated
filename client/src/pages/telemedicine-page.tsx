import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AppointmentScheduler } from '@/components/appointments/appointment-scheduler';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Loader2, Clock, Calendar as CalendarIcon, Search, Filter, 
  Heart, User, Star, ArrowRight, Clock3, CheckCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/layouts/dashboard-layout';
import useSubscriptionError from '@/hooks/use-subscription-error';

// Tipos
type Doctor = {
  id: number;
  userId: number;
  specialization: string;
  licenseNumber: string;
  biography?: string;
  education?: string;
  experienceYears?: number;
  availableForEmergency: boolean;
  consultationFee?: number;
  profileImage?: string;
  avatarUrl?: string;  // Mantido para compatibilidade com código existente
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  // Campos que podem ser necessários se implementarmos o join com usuários
  name?: string;
  username?: string;
  email?: string;
};

type Appointment = {
  id: number;
  userId: number;
  doctorId: number;
  doctorName: string;
  specialization: string;
  date: string;
  duration: number;
  status: string;
  notes?: string;
};


export default function TelemedicinePage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleApiError } = useSubscriptionError();
  
  // Estados
  const [activeTab, setActiveTab] = useState<string>('emergencies');
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState<boolean>(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isStartingEmergency, setIsStartingEmergency] = useState<boolean>(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  
  // Consultas usando React Query
  const { data: allDoctors = [], isLoading: isLoadingDoctors } = useQuery<Doctor[]>({
    queryKey: ['/api/doctors'],
    queryFn: async (): Promise<Doctor[]> => {
      try {
        const response = await apiRequest('GET', '/api/doctors');
        return await response.json();
      } catch (error) {
        handleApiError(error);
        return [];
      }
    },
  });
  
  const { data: emergencyDoctors = [] } = useQuery<Doctor[]>({
    queryKey: ['/api/doctors/available'],
    queryFn: async (): Promise<Doctor[]> => {
      try {
        const response = await apiRequest('GET', '/api/doctors/available');
        return await response.json();
      } catch (error) {
        handleApiError(error);
        return [];
      }
    },
  });
  
  const { data: upcomingAppointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments/upcoming'],
    queryFn: async (): Promise<Appointment[]> => {
      try {
        const response = await apiRequest('GET', '/api/appointments/upcoming');
        return await response.json();
      } catch (error) {
        handleApiError(error);
        return [];
      }
    },
  });
  
  // Mutation para criar nova consulta
  const createAppointmentMutation = useMutation<unknown, Error, AppointmentFormValues>({
    mutationFn: async (data: AppointmentFormValues): Promise<unknown> => {
      const { doctorId, date, time, notes } = data;
      
      // Combinar data e hora em um único formato ISO
      const [hours, minutes] = time.split(':');
      const appointmentDate = new Date(date);
      appointmentDate.setHours(parseInt(hours), parseInt(minutes));
      
      const appointmentData = {
        doctorId,
        date: appointmentDate.toISOString(),
        duration: 30, // Duração padrão: 30 minutos
        notes: notes || '',
        type: 'telemedicine',
      };
      
      const response = await apiRequest('POST', '/api/appointments', appointmentData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
      setIsBookingDialogOpen(false);
      toast({
        title: 'Consulta agendada com sucesso',
        description: 'Você receberá uma notificação quando for confirmada pelo médico.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao agendar consulta',
        description: error.message || 'Ocorreu um erro ao agendar sua consulta. Tente novamente.',
        variant: 'destructive',
      });
    },
  });
  
  // Mutation para iniciar consulta de emergência
  const startEmergencyConsultationMutation = useMutation<unknown, Error, number>({
    mutationFn: async (doctorId: number): Promise<unknown> => {
      const response = await apiRequest('POST', '/api/emergency/v2/start', { doctorId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setIsStartingEmergency(false);
      // Redirecionar para a sala de emergência do paciente
      navigate(`/emergency-room`);
    },
    onError: (error: Error) => {
      setIsStartingEmergency(false);
      toast({
        title: 'Erro ao iniciar consulta de emergência',
        description: error.message || 'Não foi possível iniciar a consulta. Tente novamente.',
        variant: 'destructive',
      });
    },
  });
  
  
  
  // Handler para iniciar consulta de emergência
  const handleStartEmergencyConsultation = (doctor: Doctor): void => {
    if (isStartingEmergency) return;
    setIsStartingEmergency(true);
    startEmergencyConsultationMutation.mutate(doctor.id);
  };
  
  // Handler para abrir diálogo de agendamento
  const handleOpenBookingDialog = (doctor: Doctor): void => {
    setSelectedDoctor(doctor);
    setIsBookingDialogOpen(true);
  };
  
  
  // Helper para determinar o status visual de uma consulta
  const getAppointmentStatusClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  // Renderizar status da consulta
  const renderAppointmentStatus = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Agendada';
      case 'confirmed':
        return 'Confirmada';
      case 'cancelled':
        return 'Cancelada';
      case 'completed':
        return 'Concluída';
      default:
        return status;
    }
  };
  
  // Verificar se o usuário pode iniciar consulta de emergência
  const canUseEmergencyConsultation = () => {
    if (user?.subscriptionPlan?.includes('ultra') || user?.subscriptionPlan?.includes('premium')) return true;
    if (user?.subscriptionPlan?.includes('basic') && user?.emergencyConsultationsLeft && user.emergencyConsultationsLeft > 0) return true;
    return false;
  };
  
  // Função para obter texto do plano e preço da consulta para emergências
  const getEmergencyConsultationPriceInfo = (doctor: Doctor) => {
    // Planos Ultra e Premium têm consultas de emergência inclusas
    if (user?.subscriptionPlan?.includes('ultra') || user?.subscriptionPlan?.includes('premium')) {
      const planName = user.subscriptionPlan.includes('ultra') 
        ? (user.subscriptionPlan.includes('family') ? 'Ultra Família' : 'Ultra')
        : (user.subscriptionPlan.includes('family') ? 'Premium Família' : 'Premium');
      
      return {
        text: `Incluso no plano ${planName}`,
        color: user.subscriptionPlan.includes('ultra') ? "text-purple-600" : "text-blue-600",
        badge: <Badge variant="outline" className={
          user.subscriptionPlan.includes('ultra')
            ? "bg-purple-50 text-purple-700 border-purple-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }>Gratuito</Badge>
      };
    } 
    // Planos Basic têm número limitado de consultas
    else if (user?.subscriptionPlan?.includes('basic') && user?.emergencyConsultationsLeft && user.emergencyConsultationsLeft > 0) {
      return {
        text: `${user.emergencyConsultationsLeft} consultas disponíveis`,
        color: "text-green-600",
        badge: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Gratuito</Badge>
      };
    } 
    // Usuários sem plano ou que esgotaram consultas gratuitas pagam valor integral
    else {
      if (!doctor.consultationFee) {
        return {
          text: "O médico ainda não definiu o preço da consulta",
          color: "text-amber-600",
          badge: <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Preço não definido</Badge>
        };
      }
      const price = doctor.consultationFee;
      return {
        text: `Valor: R$ ${price.toFixed(2)}`,
        color: "text-gray-700",
        badge: <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">R$ {price.toFixed(2)}</Badge>
      };
    }
  };
  
  // Função para obter texto do plano e preço para consultas agendadas
  const getScheduledConsultationPriceInfo = (doctor: Doctor) => {
    // Se o médico não definiu o preço da consulta
    if (!doctor.consultationFee) {
      return {
        basePrice: null,
        finalPrice: null,
        discountText: "",
        discountAmount: 0,
        message: "O médico ainda não definiu o preço da consulta"
      };
    }
    
    const basePrice = doctor.consultationFee;
    let finalPrice = basePrice;
    let discountText = "";
    let discountAmount = 0;
    let planName = "";
    
    // Verificar planos Ultra (70% de desconto)
    if (user?.subscriptionPlan?.includes('ultra')) {
      finalPrice = basePrice * 0.3; // 70% de desconto
      discountText = "70% de desconto";
      discountAmount = basePrice - finalPrice;
      planName = user.subscriptionPlan.includes('family') ? 'Ultra Família' : 'Ultra';
    } 
    // Verificar planos Premium (50% de desconto)
    else if (user?.subscriptionPlan?.includes('premium')) {
      finalPrice = basePrice * 0.5; // 50% de desconto
      discountText = "50% de desconto";
      discountAmount = basePrice - finalPrice;
      planName = user.subscriptionPlan.includes('family') ? 'Premium Família' : 'Premium';
    } 
    // Verificar planos Basic (30% de desconto)
    else if (user?.subscriptionPlan?.includes('basic')) {
      finalPrice = basePrice * 0.7; // 30% de desconto
      discountText = "30% de desconto";
      discountAmount = basePrice - finalPrice;
      planName = user.subscriptionPlan.includes('family') ? 'Basic Família' : 'Basic';
    }
    
    return {
      text: user?.subscriptionPlan !== 'free' && user?.subscriptionPlan
        ? `${discountText} (Plano ${planName})`
        : "Valor integral",
      color: user?.subscriptionPlan?.includes('ultra')
        ? "text-purple-600"
        : user?.subscriptionPlan?.includes('premium')
          ? "text-blue-600" 
          : user?.subscriptionPlan?.includes('basic')
            ? "text-green-600" 
            : "text-gray-700",
      badge: <Badge variant="outline" className={
        user?.subscriptionPlan?.includes('ultra')
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : user?.subscriptionPlan?.includes('premium')
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : user?.subscriptionPlan?.includes('basic')
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
      }>
        {user?.subscriptionPlan !== 'free' && user?.subscriptionPlan ? (
          <>
            <span className="line-through text-gray-500 mr-1.5">R$ {basePrice.toFixed(2)}</span>
            <span>R$ {finalPrice.toFixed(2)}</span>
            <span className="ml-1.5 text-xs font-medium">(-{discountAmount.toFixed(2)})</span>
          </>
        ) : (
          <span>R$ {finalPrice.toFixed(2)}</span>
        )}
      </Badge>
    };
  };
  
  // Função para obter todas as especialidades únicas dos médicos
  const getUniqueSpecialties = () => {
    const specialtiesArray = allDoctors.map((doctor: Doctor) => doctor.specialization || '');
    // Filtra especialidades vazias e ordena alfabeticamente
    const uniqueSpecialties = Array.from(new Set(specialtiesArray))
      .filter((spec: string) => spec !== '')
      .sort((a: string, b: string) => a.localeCompare(b));
    return ['all', ...uniqueSpecialties];
  };

  // Função para formatar o nome do médico
  const formatDoctorName = (name?: string): string => {
    if (!name) return 'Médico';
    
    // Dividir o nome completo em palavras, filtrar partes vazias
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    
    // Lista de nomes tipicamente femininos em português (em minúsculo para comparação)
    const femaleNames = [
      'ana', 'maria', 'sandra', 'carla', 'fernanda', 'beatriz', 'julia', 'joana', 
      'camila', 'mariana', 'patricia', 'luciana', 'bruna', 'renata', 'cintia', 
      'silvia', 'larissa', 'adriana', 'vanessa', 'leticia', 'debora', 'cristina',
      'carolina', 'rafaela', 'gabriela', 'amanda', 'priscila', 'teresa', 'helena'
    ];
    
    // Verificar se o primeiro nome é feminino
    const firstName = nameParts[0]?.toLowerCase() || '';
    const isFemale = femaleNames.includes(firstName) || firstName.endsWith('a');
    
    // Formatar nome: primeira letra maiúscula em cada palavra
    const formattedName = nameParts.map(part => {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
    
    // Adicionar o prefixo Dr./Dra.
    const prefix = isFemale ? "Dra. " : "Dr. ";
    return prefix + formattedName;
  };
  
  // Função para filtrar médicos por especialidade e termo de busca
  const filterDoctors = (doctors: Doctor[]) => {
    return doctors.filter((doctor: Doctor) => {
      const matchesSpecialty = selectedSpecialty === 'all' || doctor.specialization === selectedSpecialty;
      const matchesSearch = searchTerm === '' || 
        (doctor.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (doctor.specialization?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      return matchesSpecialty && matchesSearch;
    });
  };

  const filteredAllDoctors = filterDoctors(allDoctors);
  const filteredEmergencyDoctors = filterDoctors(emergencyDoctors);
  const specialties = getUniqueSpecialties();

  return (
    <DashboardLayout title="Telemedicina">
      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6 space-y-4 sm:space-y-0">
            <TabsList className="bg-muted/30 rounded-full">
              <TabsTrigger value="emergencies" className="text-sm rounded-full">Atendimento de Emergência</TabsTrigger>
              <TabsTrigger value="doctors" className="text-sm rounded-full">Agendar Consulta</TabsTrigger>
            </TabsList>
            
            <div className="flex w-full sm:w-auto gap-2">
              <div className="relative w-full sm:w-auto">
                <i className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground">
                  <Search size={16} />
                </i>
                <input
                  type="text"
                  placeholder="Buscar médicos..."
                  className="h-9 w-full sm:w-[200px] rounded-full bg-background pl-8 pr-4 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger className="h-9 w-full sm:w-[150px] rounded-full bg-background text-sm">
                  <i className="mr-2">
                    <Filter size={14} />
                  </i>
                  <SelectValue placeholder="Especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((specialty: string) => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty === 'all' ? 'Todas especialidades' : specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <TabsContent value="doctors" className="space-y-6">
            {isLoadingDoctors ? (
              <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAllDoctors.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAllDoctors?.map((doctor: Doctor) => {
                    const priceInfo = getScheduledConsultationPriceInfo(doctor);
                    return (
                      <Card key={doctor.id} className="doctor-card overflow-hidden shadow-doctor-card hover:shadow-doctor-card-hover group border border-border/60 rounded-xl hover:border-primary/20 fade-in">
                        <CardContent className="p-0">
                          <div className="relative pb-3">
                            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 h-28 w-full relative overflow-hidden">
                              <div className="absolute inset-0 bg-pattern opacity-10"></div>
                            </div>
                            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                              <div className="relative">
                                <Avatar className="doctor-avatar h-24 w-24 border-4 border-white shadow-lg ring-2 ring-primary/10 group-hover:ring-primary/20">
                                  <AvatarImage 
                                    src={doctor.profileImage || doctor.avatarUrl} 
                                    alt={doctor.name}
                                    className="object-cover"
                                  />
                                  <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white text-xl font-semibold">
                                    {doctor.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'MD'}
                                  </AvatarFallback>
                                </Avatar>
                                {doctor.availableForEmergency && (
                                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-center text-center px-4 pt-14 pb-6">
                            <h3 className="font-semibold text-lg text-gray-900 mb-1 leading-tight">
                              {formatDoctorName(doctor.name)}
                            </h3>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 rounded-full mb-2 border-blue-200">
                              {doctor.specialization}
                            </Badge>
                            

                            
                            <div className="w-full mb-4 min-h-[48px] flex flex-col items-center justify-center">
                              {priceInfo.badge}
                              <div className="mt-1">
                                <span className={`text-xs ${priceInfo.color} font-medium`}>{priceInfo.text}</span>
                              </div>
                            </div>
                            
                            <div className="w-full space-y-2">
                                                              <Button 
                                  onClick={() => handleOpenBookingDialog(doctor)}
                                  className="w-full rounded-full btn-hover-effect group-hover:bg-primary/90 hover:shadow-md"
                                >
                                  Agendar Consulta
                                </Button>
                              
                              {doctor.availableForEmergency && (
                                                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    className="w-full rounded-full text-xs border-green-200 text-green-700 hover:bg-green-50 btn-hover-effect"
                                    onClick={() => handleStartEmergencyConsultation(doctor)}
                                    disabled={isStartingEmergency}
                                  >
                                  {isStartingEmergency ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Heart className="h-3 w-3 mr-1" />
                                  )}
                                  Emergência
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                  );
                })}
              </div>
              
              {filteredAllDoctors.length === 0 && searchTerm !== '' && (
                <div className="text-center py-10">
                  <h3 className="text-lg font-medium text-gray-700">Nenhum médico encontrado</h3>
                  <p className="text-gray-500 mt-2">Tente ajustar os filtros de busca ou especialidade</p>
                </div>
              )}
            </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-10 text-center">
                  <p className="text-gray-500 mb-2">Nenhum médico disponível no momento.</p>
                  <p className="text-xs text-gray-400">Tente novamente mais tarde ou ajuste os critérios de busca.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="emergencies" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Médicos de emergência - coluna principal */}
              <div className="lg:col-span-2 space-y-4">
                {emergencyDoctors.length > 0 ? (
                  emergencyDoctors?.map((doctor: Doctor) => {
                    const priceInfo = getEmergencyConsultationPriceInfo(doctor);
                    return (
                      <Card key={doctor.id} className="doctor-card overflow-hidden shadow-doctor-card hover:shadow-doctor-card-hover border-l-4 border-l-green-500 hover:border-l-green-600 bg-gradient-to-r from-green-50/30 to-white slide-up">
                        <CardContent className="p-0">
                          <div className="flex items-start p-6">
                            <div className="mr-5 relative">
                              <Avatar className="doctor-avatar h-18 w-18 border-3 border-white shadow-lg ring-2 ring-green-100">
                                <AvatarImage 
                                  src={doctor.profileImage || doctor.avatarUrl} 
                                  alt={doctor.name}
                                  className="object-cover"
                                />
                                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white text-lg font-semibold">
                                  {doctor.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'MD'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                                    {formatDoctorName(doctor.name)}
                                  </h3>
                                  <p className="text-sm text-primary font-medium mt-0.5">{doctor.specialization}</p>
                                </div>
                                <div className="ml-3 flex-shrink-0">
                                  {priceInfo.badge}
                                </div>
                              </div>
                              

                              
                              <div className="flex items-center mb-4">
                                <Badge className="mr-3 bg-green-100 text-green-800 border-green-200 px-3 py-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                  Online Agora
                                </Badge>
                                <span className={`text-xs ${priceInfo.color} font-medium`}>{priceInfo.text}</span>
                              </div>
                              
                              <div className="w-full">
                                <Button 
                                  onClick={() => handleStartEmergencyConsultation(doctor)}
                                  disabled={isStartingEmergency}
                                  className="w-full justify-center bg-green-600 hover:bg-green-700 text-white btn-hover-effect"
                                >
                                  {isStartingEmergency ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Heart className="h-4 w-4 mr-1" />
                                  )}
                                  Iniciar Consulta de Emergência
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-500">Nenhum médico disponível para emergências no momento.</p>
                      <p className="text-gray-400 text-sm mt-1">Tente novamente mais tarde ou agende uma consulta regular.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Coluna lateral */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Consultas Agendadas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingAppointments ? (
                      <div className="flex justify-center items-center min-h-[100px]">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : upcomingAppointments.length > 0 ? (
                      <ul className="divide-y divide-gray-100">
                        {upcomingAppointments.map((appointment: Appointment) => (
                          <li key={appointment.id} className="p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900">{formatDoctorName(appointment.doctorName)}</p>
                                <div className="mt-1 flex items-center text-xs text-gray-500">
                                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                                  <p>
                                    {format(new Date(appointment.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="default"
                                className="text-xs"
                                onClick={() => navigate(`/telemedicine/${appointment.id}`)}
                              >
                                Entrar
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-gray-500 text-sm">Nenhuma consulta agendada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Diálogo de Agendamento */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar Consulta</DialogTitle>
            <DialogDescription>
              Escolha o melhor dia e horário para sua consulta
            </DialogDescription>
          </DialogHeader>
          
          {selectedDoctor && (
            <AppointmentScheduler
              doctorId={selectedDoctor.id}
              doctorName={formatDoctorName(selectedDoctor.name || 'Médico')}
              onSelectDateTime={async (date, time) => {
                // Combinar data e hora
                const [hours, minutes] = time.split(':');
                const appointmentDate = new Date(date);
                appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                // Criar agendamento
                try {
                  await createAppointmentMutation.mutateAsync({
                    doctorId: selectedDoctor.id,
                    date: appointmentDate.toISOString(),
                    duration: 30,
                    notes: '',
                    type: 'telemedicine'
                  });
                  
                  setIsBookingDialogOpen(false);
                  toast({
                    title: "Consulta agendada com sucesso!",
                    description: `Sua consulta foi marcada para ${format(appointmentDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}`,
                  });
                } catch (error) {
                  console.error('Erro ao agendar consulta:', error);
                }
              }}
              onCancel={() => setIsBookingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}