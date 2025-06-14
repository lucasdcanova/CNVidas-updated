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
  Heart, User, Star, ArrowRight, Clock3, CheckCircle, AlertCircle, X, Timer
} from 'lucide-react';
import { format, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/layouts/dashboard-layout';
import useSubscriptionError from '@/hooks/use-subscription-error';
import PreAuthPaymentDialog from '@/components/checkout/pre-auth-payment-dialog';

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
  doctorEmail?: string;
  doctorProfileImage?: string;
  specialization: string;
  consultationFee?: number;
  availableForEmergency?: boolean;
  date: string;
  duration: number;
  status: string;
  notes?: string;
  type?: string;
  isEmergency?: boolean;
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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState<boolean>(false);
  const [pendingAppointment, setPendingAppointment] = useState<{
    doctorId: number;
    doctorName: string;
    date: string;
    duration: number;
    notes: string;
    type: string;
  } | null>(null);
  
  
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
  
  const { data: upcomingAppointments = [], isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery<Appointment[]>({
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
    staleTime: 0, // Dados sempre considerados obsoletos
    cacheTime: 0, // Sem cache
    refetchOnMount: true, // Sempre buscar ao montar
    refetchOnWindowFocus: true, // Buscar ao focar na janela
  });
  
  // Mutation para criar nova consulta
  const createAppointmentMutation = useMutation<unknown, Error, any>({
    mutationFn: async (data: any): Promise<unknown> => {
      console.log('Dados recebidos na mutationFn:', data);
      
      // Verificar se é o formato antigo (AppointmentFormValues) ou novo formato
      let appointmentDate: Date;
      
      if (data.appointmentDate && data.appointmentTime) {
        // Formato do formulário (AppointmentFormValues)
        const { doctorId, appointmentDate: dateStr, appointmentTime: timeStr, notes } = data;
        
        if (!timeStr) {
          throw new Error('Horário não foi selecionado corretamente');
        }
        
        // Combinar data e hora em um único formato ISO
        const [hours, minutes] = timeStr.split(':');
        appointmentDate = new Date(dateStr);
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
      } else {
        // Formato direto (usado pelo AppointmentScheduler)
        const { doctorId, date, duration, notes, type, paymentIntentId, paymentAmount } = data;
        
        const appointmentData = {
          doctorId,
          date,
          duration: duration || 30,
          notes: notes || '',
          type: type || 'telemedicine',
          paymentIntentId,
          paymentAmount
        };
        
        const response = await apiRequest('POST', '/api/appointments', appointmentData);
        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
      setIsBookingDialogOpen(false);
      setIsPaymentDialogOpen(false);
      toast({
        title: 'Consulta agendada com sucesso',
        description: 'Você receberá uma notificação quando for confirmada pelo médico.',
      });
    },
    onError: (error: Error) => {
      console.error('Erro na mutationFn:', error);
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
      // Redirecionar para a sala de emergência com o ID da consulta criada
      if (data.appointmentId) {
        navigate(`/unified-emergency-room?id=${data.appointmentId}`);
      } else {
        // Fallback para a página antiga se não houver appointmentId
        navigate(`/emergency-room`);
      }
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
  
  // Handler para sucesso do pagamento
  const handlePaymentSuccess = (paymentIntentId: string): void => {
    if (!pendingAppointment || !selectedDoctor) return;
    
    // Calcular o valor da consulta com base no plano do usuário
    const priceInfo = getScheduledConsultationPriceInfo(selectedDoctor);
    
    if (!priceInfo.finalPrice) {
      toast({
        title: 'Erro ao processar pagamento',
        description: 'Não foi possível calcular o valor da consulta.',
        variant: 'destructive',
      });
      return;
    }
    
    // Criar a consulta com o paymentIntentId
    createAppointmentMutation.mutate({
      ...pendingAppointment,
      paymentIntentId,
      paymentAmount: Math.round(priceInfo.finalPrice * 100) // Converter para centavos
    });
    
    // Limpar estados
    setPendingAppointment(null);
    setIsPaymentDialogOpen(false);
  };
  
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
        message: "O médico ainda não definiu o preço da consulta",
        text: "O médico ainda não definiu o preço da consulta",
        color: "text-amber-600",
        badge: <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Preço não definido</Badge>
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
      basePrice,
      finalPrice,
      discountText,
      discountAmount,
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

  // Função para calcular tempo restante até a consulta
  const getTimeUntilAppointment = (appointmentDate: string) => {
    const now = new Date();
    const appointment = new Date(appointmentDate);
    
    const totalMinutes = differenceInMinutes(appointment, now);
    
    if (totalMinutes <= 0) {
      return { canCancel: false, timeLeft: 'Consulta iniciada', isExpired: true, hoursToCancel: 0 };
    }
    
    const canCancel = totalMinutes > 720; // 12 horas = 720 minutos
    const hoursToCancel = Math.max(0, Math.floor((totalMinutes - 720) / 60)); // Horas restantes para cancelar
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    let timeLeft = '';
    if (hours > 0) {
      timeLeft = `${hours}h ${minutes}min`;
    } else {
      timeLeft = `${minutes}min`;
    }
    
    return { canCancel, timeLeft, isExpired: false, totalMinutes, hoursToCancel };
  };

  // Hook para atualizar contador em tempo real
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Atualiza a cada minuto
    
    return () => clearInterval(timer);
  }, []);

  // Mutation para cancelar consulta
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao cancelar consulta');
      }
      
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Consulta cancelada",
        description: "Sua consulta foi cancelada com sucesso.",
      });
      // Invalidar e refetch imediato
      await queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming'] });
      await queryClient.refetchQueries({ queryKey: ['/api/appointments/upcoming'] });
      await refetchAppointments();
    },
    onError: (error) => {
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a consulta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleCancelAppointment = (appointmentId: number) => {
    if (window.confirm('Tem certeza que deseja cancelar esta consulta?')) {
      cancelAppointmentMutation.mutate(appointmentId);
    }
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
        {/* Card de Consultas Agendadas - Topo da Página */}
        {upcomingAppointments.filter(apt => apt.status !== 'cancelled').length > 0 && (
          <Card className="mb-8 mt-4 overflow-hidden border-2 border-blue-500 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center text-xl text-white">
                  <CalendarIcon className="mr-3 h-6 w-6" />
                  Suas Próximas Consultas
                </CardTitle>
                <Badge variant="outline" className="border-white text-white bg-white/20 px-3 py-1 rounded-full font-medium">
                  {upcomingAppointments.length} {upcomingAppointments.length === 1 ? 'Consulta' : 'Consultas'}
                </Badge>
              </div>
              <CardDescription className="text-blue-100 mt-2">
                Suas consultas agendadas estão prontas para começar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingAppointments ? (
                <div className="flex justify-center items-center min-h-[120px]">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.filter(apt => apt.status !== 'cancelled').map((appointment: Appointment) => {
                    const priceInfo = getScheduledConsultationPriceInfo({
                      consultationFee: appointment.consultationFee,
                      availableForEmergency: appointment.availableForEmergency
                    } as Doctor);
                    
                    const timeInfo = getTimeUntilAppointment(appointment.date);
                    
                    return (
                      <div key={appointment.id} className="bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-100 hover:border-blue-300">
                        {/* Header Principal */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <Avatar className="h-14 w-14 border-2 border-blue-200 shadow-md ring-2 ring-blue-100">
                              <AvatarImage 
                                src={appointment.doctorProfileImage} 
                                alt={appointment.doctorName}
                                className="object-cover w-full h-full"
                              />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-base font-bold">
                                {appointment.doctorName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'MD'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">
                                {formatDoctorName(appointment.doctorName)}
                              </h3>
                              <p className="text-blue-600 font-semibold text-sm">
                                {appointment.specialization}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-green-600 font-medium">Disponível</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {priceInfo.badge}
                            <p className={`text-xs ${priceInfo.color} font-medium mt-1`}>
                              {priceInfo.text}
                            </p>
                          </div>
                        </div>

                        {/* Contador de Tempo e Status de Cancelamento */}
                        <div className={`rounded-lg p-3 mb-4 border ${timeInfo.canCancel ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Timer className={`h-4 w-4 ${timeInfo.canCancel ? 'text-green-600' : 'text-orange-600'}`} />
                              <span className={`text-sm font-medium ${timeInfo.canCancel ? 'text-green-800' : 'text-orange-800'}`}>
                                {timeInfo.isExpired ? 'Consulta iniciada' : `Faltam ${timeInfo.timeLeft}`}
                              </span>
                            </div>
                            {timeInfo.canCancel ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                onClick={() => handleCancelAppointment(appointment.id)}
                                disabled={cancelAppointmentMutation.isPending}
                              >
                                {cancelAppointmentMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <X className="h-3 w-3 mr-1" />
                                )}
                                Cancelar
                              </Button>
                            ) : (
                              <div className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                {timeInfo.isExpired ? 'Em andamento' : 'Não pode ser cancelada - será cobrada'}
                              </div>
                            )}
                          </div>
                          
                          {/* Aviso sobre prazo de cancelamento */}
                          {!timeInfo.isExpired && (
                            <div className={`text-xs ${timeInfo.canCancel ? 'text-green-700' : 'text-orange-700'} bg-white/50 px-2 py-1 rounded border-l-2 ${timeInfo.canCancel ? 'border-green-400' : 'border-orange-400'}`}>
                              {timeInfo.canCancel ? (
                                <span>
                                  ⚠️ Você tem <strong>{timeInfo.hoursToCancel}h</strong> para cancelar antes de ser cobrado o valor integral
                                </span>
                              ) : (
                                <span>
                                  ⚠️ Prazo de cancelamento expirado - consulta será cobrada integralmente
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Seção Data e Hora */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 mb-4 border border-blue-200">
                          <h4 className="font-bold text-gray-800 mb-2 text-center text-sm">Data e Horário da Consulta</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                              <CalendarIcon className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                              <p className="text-xs text-gray-600 font-medium">Data</p>
                              <p className="text-sm font-bold text-gray-800">
                                {format(new Date(appointment.date), "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(appointment.date), "EEEE", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                              <Clock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                              <p className="text-xs text-gray-600 font-medium">Horário</p>
                              <p className="text-sm font-bold text-gray-800">
                                {format(new Date(appointment.date), "HH:mm", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-gray-500">30 minutos</p>
                            </div>
                          </div>
                        </div>

                        {/* Seção de Ação */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span className="text-xs text-gray-600">Consulta Confirmada</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">ID: #{appointment.id}</span>
                            </div>
                          </div>
                          
                          <Button 
                            size="default" 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-sm"
                            onClick={() => navigate(`/telemedicine/${appointment.id}`)}
                          >
                            <div className="flex items-center space-x-2">
                              <span>Entrar na Consulta</span>
                              <ArrowRight className="h-3 w-3" />
                            </div>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            {emergencyDoctors.length > 0 ? (
              <div className="space-y-4">
                {emergencyDoctors?.map((doctor: Doctor) => {
                  const priceInfo = getEmergencyConsultationPriceInfo(doctor);
                  return (
                    <Card key={doctor.id} className="doctor-card overflow-hidden shadow-doctor-card hover:shadow-doctor-card-hover border-l-4 border-l-green-500 hover:border-l-green-600 bg-gradient-to-r from-green-50/30 to-white slide-up">
                      <CardContent className="p-0">
                        <div className="flex items-start p-6">
                          <div className="mr-5 relative flex-shrink-0">
                            <Avatar className="doctor-avatar h-16 w-16 border-2 border-white shadow-lg ring-2 ring-green-100">
                              <AvatarImage 
                                src={doctor.profileImage || doctor.avatarUrl} 
                                alt={doctor.name}
                                className="object-cover w-full h-full"
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
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">Nenhum médico disponível para emergências no momento.</p>
                  <p className="text-gray-400 text-sm mt-1">Tente novamente mais tarde ou agende uma consulta regular.</p>
                </CardContent>
              </Card>
            )}
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
                // Verificar se time está definido e é uma string válida
                if (!time || typeof time !== 'string' || !time.includes(':')) {
                  console.error('Horário inválido:', { date, time, type: typeof time });
                  toast({
                    title: "Erro ao agendar consulta",
                    description: "Horário não foi selecionado corretamente. Tente novamente.",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Combinar data e hora
                try {
                  const [hours, minutes] = time.split(':');
                  
                  // Validar se hours e minutes são números válidos
                  const hoursNum = parseInt(hours);
                  const minutesNum = parseInt(minutes);
                  
                  if (isNaN(hoursNum) || isNaN(minutesNum) || hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
                    throw new Error('Horário inválido');
                  }
                  
                  const appointmentDate = new Date(date);
                  appointmentDate.setHours(hoursNum, minutesNum, 0, 0);
                  
                  // Calcular o valor da consulta
                  const priceInfo = getScheduledConsultationPriceInfo(selectedDoctor);
                  
                  if (!priceInfo.basePrice) {
                    toast({
                      title: "Erro ao agendar consulta",
                      description: "O médico ainda não definiu o preço da consulta.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Salvar dados do agendamento pendente
                  setPendingAppointment({
                    doctorId: selectedDoctor.id,
                    doctorName: selectedDoctor.name || 'Médico',
                    date: appointmentDate.toISOString(),
                    duration: 30,
                    notes: '',
                    type: 'telemedicine'
                  });
                  
                  // Fechar modal de agendamento e abrir modal de pagamento
                  setIsBookingDialogOpen(false);
                  setIsPaymentDialogOpen(true);
                } catch (error) {
                  console.error('Erro ao agendar consulta:', error);
                  toast({
                    title: "Erro ao agendar consulta",
                    description: error instanceof Error ? error.message : "Ocorreu um erro ao agendar sua consulta. Tente novamente.",
                    variant: "destructive",
                  });
                }
              }}
              onCancel={() => setIsBookingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal de Pagamento */}
      {isPaymentDialogOpen && pendingAppointment && selectedDoctor && (
        <PreAuthPaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false);
            setPendingAppointment(null);
          }}
          onSuccess={handlePaymentSuccess}
          appointmentData={{
            doctorId: selectedDoctor.id,
            doctorName: formatDoctorName(selectedDoctor.name || 'Médico'),
            date: pendingAppointment.date,
            amount: Math.round(getScheduledConsultationPriceInfo(selectedDoctor).finalPrice! * 100), // Converter para centavos
            isEmergency: false
          }}
        />
      )}
    </DashboardLayout>
  );
}