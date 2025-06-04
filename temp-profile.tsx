import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import SellerForm from "@/components/forms/seller-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  getUserProfile,
  updateUserProfile,
  getPartnerByUserId,
  getDoctorByUserId,
  updatePartner,
  updateDoctor
} from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, 
  CreditCard, 
  User, 
  Lock, 
  Shield, 
  Upload,
  Building,
  Stethoscope,
  MapPin
} from "lucide-react";
import Breadcrumb from "@/components/ui/breadcrumb";
import { AddressForm, AddressFormValues } from "@/components/forms/address-form";

// Esquema de perfil básico (paciente)
const patientProfileSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  // Campos de endereço detalhados
  address: z.string().optional(),
  zipcode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  birthDate: z.string().optional(),
});

// Esquema de perfil do médico
const doctorProfileSchema = z.object({
  specialization: z.string().min(1, "Especialização é obrigatória"),
  licenseNumber: z.string().min(1, "Número de registro é obrigatório"),
  biography: z.string().optional(),
  education: z.string().optional(),
  experienceYears: z.string().optional(), // Mantemos como string no form, mas convertemos na submissão
  availableForEmergency: z.boolean().optional(),
  consultationFee: z.string().optional(), // Mantemos como string no form, mas convertemos na submissão
  profileImage: z.string().optional(),
});

// Esquema de perfil do parceiro (empresa)
const partnerProfileSchema = z.object({
  businessName: z.string().min(1, "Nome da empresa é obrigatório"),
  businessType: z.string().min(1, "Tipo de negócio é obrigatório"),
  description: z.string().optional(),
  website: z.string().optional(),
  // Campos de endereço detalhados
  address: z.string().optional(), // Mantido para compatibilidade
  zipcode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  cnpj: z.string().min(14, "CNPJ deve ter pelo menos 14 caracteres").optional(),
});

// Password change form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, "A senha atual deve ter pelo menos 6 caracteres"),
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "A confirmação da senha deve ter pelo menos 6 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type PatientProfileFormValues = z.infer<typeof patientProfileSchema>;
type DoctorProfileFormValues = z.infer<typeof doctorProfileSchema>;
type PartnerProfileFormValues = z.infer<typeof partnerProfileSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch user profile data
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/users/profile"],
    queryFn: getUserProfile
  });
  
  // Use useEffect to handle profile data changes
  React.useEffect(() => {
    if (profileData && profileData.profileImage) {
      console.log("Imagem de perfil encontrada no servidor");
      setProfileImage(profileData.profileImage);
    } else if (profileData) {
      console.log("Nenhuma imagem de perfil encontrada no servidor");
    }
  }, [profileData]);
  
  // Fetch partner data if user is a partner
  const { data: partnerData, isLoading: partnerLoading } = useQuery({
    queryKey: ["/api/partners/user", user?.id],
    queryFn: () => getPartnerByUserId(user?.id || 0),
    enabled: !!user?.id && user?.role === "partner",
  });
  
  // Fetch doctor data if user is a doctor
  const { data: doctorData, isLoading: doctorLoading } = useQuery({
    queryKey: ["/api/doctors/user", user?.id],
    queryFn: () => {
      console.log("Buscando perfil do médico para usuário ID:", user?.id);
      return getDoctorByUserId(user?.id || 0);
    },
    enabled: !!user?.id && user?.role === "doctor"
  });
  
  // Patient profile form
  const patientForm = useForm<PatientProfileFormValues>({
    resolver: zodResolver(patientProfileSchema),
    defaultValues: {
      fullName: profileData?.fullName || "",
      username: profileData?.username || "",
      email: profileData?.email || "",
      phone: profileData?.phone || "",
      address: profileData?.address || "",
      birthDate: profileData?.birthDate ? new Date(profileData.birthDate).toISOString().split('T')[0] : "",
    },
  });
  
  // Atualizar o formulário quando os dados do perfil forem carregados ou alterados
  React.useEffect(() => {
    if (profileData) {
      console.log("Atualizando dados do formulário com dados do perfil:", profileData);
      patientForm.reset({
        fullName: profileData.fullName || "",
        username: profileData.username || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
        address: profileData.address || "",
        birthDate: profileData.birthDate ? new Date(profileData.birthDate).toISOString().split('T')[0] : "",
      });
    }
  }, [profileData, patientForm]);
  
  // Doctor profile form
  const doctorForm = useForm<DoctorProfileFormValues>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      specialization: doctorData?.specialization || "",
      licenseNumber: doctorData?.licenseNumber || "",
      biography: doctorData?.biography || "",
      education: doctorData?.education || "",
      experienceYears: doctorData?.experienceYears?.toString() || "",
      availableForEmergency: doctorData?.availableForEmergency || false,
      consultationFee: doctorData?.consultationFee?.toString() || "",
      profileImage: doctorData?.profileImage || "",
    },
  });
  
  // Inicializar a imagem de perfil quando os dados do médico forem carregados
  React.useEffect(() => {
    if (doctorData?.profileImage) {
      setProfileImage(doctorData.profileImage);
    }
  }, [doctorData]);
  
  // Partner profile form
  const partnerForm = useForm<PartnerProfileFormValues>({
    resolver: zodResolver(partnerProfileSchema),
    defaultValues: {
      businessName: partnerData?.businessName || "",
      businessType: partnerData?.businessType || "",
      description: partnerData?.description || "",
      website: partnerData?.website || "",
      address: partnerData?.address || "",
      phone: partnerData?.phone || "",
      cnpj: partnerData?.cnpj || "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // User profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      setIsUpdatingProfile(false);
      setIsEditMode(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar perfil",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar seu perfil.",
        variant: "destructive",
      });
      setIsUpdatingProfile(false);
    },
  });
  
  // Doctor profile update mutation
  const updateDoctorMutation = useMutation({
    mutationFn: (data: any) => {
      console.log(`Enviando atualização para médico ID: ${doctorData?.id}`);
      // Garantir que temos um ID válido antes de enviar
      if (!doctorData?.id) {
        throw new Error("ID do médico não encontrado");
      }
      
      // Adicionar o userId aos dados para ajudar na invalidação do cache
      const dataToSend = {
        ...data,
        userId: user?.id
      };
      
      console.log("Dados a serem enviados:", dataToSend);
      return updateDoctor(doctorData.id, dataToSend);
    },
    onSuccess: (response) => {
      console.log("Perfil médico atualizado com sucesso:", response);
      toast({
        title: "Perfil médico atualizado",
        description: "Suas informações profissionais foram atualizadas com sucesso.",
      });
      setIsUpdatingProfile(false);
      setIsEditMode(false);
      
      // Forçar a atualização de todas as consultas relevantes
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorData?.id] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      }
    },
    onError: (error) => {
      console.error("Erro ao atualizar perfil médico:", error);
      toast({
        title: "Erro ao atualizar perfil médico",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar seu perfil médico.",
        variant: "destructive",
      });
      setIsUpdatingProfile(false);
    },
  });
  
  // Partner profile update mutation
  const updatePartnerMutation = useMutation({
    mutationFn: (data: PartnerProfileFormValues) => {
      console.log(`Enviando atualização para parceiro ID: ${partnerData?.id}`);
      // Garantir que temos um ID válido antes de enviar
      if (!partnerData?.id) {
        throw new Error("ID do parceiro não encontrado");
      }
      return updatePartner(partnerData.id, data);
    },
    onSuccess: (response) => {
      console.log("Perfil de parceiro atualizado com sucesso:", response);
      toast({
        title: "Perfil da empresa atualizado",
        description: "As informações da empresa foram atualizadas com sucesso.",
      });
      setIsUpdatingProfile(false);
      setIsEditMode(false);
      // Forçar a atualização da página para mostrar os dados atualizados
      queryClient.invalidateQueries({ queryKey: ["/api/partners/user", user?.id] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar perfil de parceiro:", error);
      toast({
        title: "Erro ao atualizar perfil da empresa",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar o perfil da empresa.",
        variant: "destructive",
      });
      setIsUpdatingProfile(false);
    },
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso.",
      });
      passwordForm.reset();
      setIsChangingPassword(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao alterar senha",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao alterar sua senha.",
        variant: "destructive",
      });
      setIsChangingPassword(false);
    },
  });

  // Handle patient profile form submission
  const onPatientSubmit = async (data: PatientProfileFormValues) => {
    setIsUpdatingProfile(true);
    
    try {
      // Obter diretamente os valores do formulário
      const addressData = {
        zipcode: data.zipcode || "",
        street: data.street || "",
        number: data.number || "",
        complement: data.complement || "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || ""
      };
      
      // Construir endereço completo para compatibilidade com campo legado
      if (addressData.street && addressData.number) {
        const fullAddress = `${addressData.street}, ${addressData.number}${addressData.complement ? `, ${addressData.complement}` : ""} - ${addressData.neighborhood || ""} - ${addressData.city || ""}/${addressData.state || ""} - CEP: ${addressData.zipcode || ""}`;
        data.address = fullAddress;
      }
      
      // Construir objeto com todos os dados
      const formData = {
        ...data,
      };
      
      // Log detalhado para debug
      console.log("Dados de endereço para salvar:", addressData);
      console.log("Enviando dados completos para atualização:", formData);
      
      // Atualizar o perfil completo primeiro
      await updateProfileMutation.mutateAsync(formData);
      
      // Sempre enviar os dados de endereço para garantir que sejam persistidos corretamente
      // Esta chamada garante que os campos sejam atualizados mesmo se estiverem vazios
      const addressResponse = await fetch('/api/users/address', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressData),
      });
      
      if (!addressResponse.ok) {
        console.warn("Aviso: Endpoint de endereço respondeu com erro, mas o perfil principal foi atualizado.");
      } else {
        console.log("Endereço atualizado com sucesso pelo endpoint específico");
      }
      
      toast({
        title: "Perfil atualizado",
        description: "Seu perfil foi atualizado com sucesso, incluindo os dados de endereço!",
      });
      
      // Forçar a atualização dos dados no cliente
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Recarregar os dados após um pequeno delay para garantir que o banco esteja atualizado
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/users/profile"] });
        queryClient.refetchQueries({ queryKey: ["/api/user"] });
      }, 1000);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro ao atualizar perfil",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar seu perfil.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
      setIsEditMode(false);
    }
  };
  
  // Handle doctor profile form submission
  const onDoctorSubmit = async (data: DoctorProfileFormValues) => {
    setIsUpdatingProfile(true);
    
    try {
      // Converter campos numéricos (Experiência e taxa de consulta)
      const formattedData = {
        ...data,
        experienceYears: data.experienceYears ? parseInt(data.experienceYears, 10) : undefined,
        consultationFee: data.consultationFee ? parseFloat(data.consultationFee) : undefined,
      };
      
      // Se tiver uma nova imagem de perfil selecionada, enviá-la primeiro
      if (selectedFile) {
        const formData = new FormData();
        formData.append('profileImage', selectedFile);
        
        const response = await fetch('/api/doctors/profile-image', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Falha ao enviar imagem de perfil');
        }
        
        const result = await response.json();
        // Atualizar o URL da imagem nos dados do formulário
        formattedData.profileImage = result.imageUrl;
      }
      
      // Enviar os dados formatados para o servidor
      await updateDoctorMutation.mutateAsync(formattedData);
      
      // Limpar o arquivo selecionado após o envio bem-sucedido
      setSelectedFile(null);
    } catch (error) {
      console.error("Erro ao atualizar perfil médico:", error);
      toast({
        title: "Erro ao atualizar perfil médico",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar seu perfil médico.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
      setIsEditMode(false);
    }
  };
  
  // Handle partner profile form submission
  const onPartnerSubmit = async (data: PartnerProfileFormValues) => {
    setIsUpdatingProfile(true);
    
    try {
      // Construir endereço completo para compatibilidade
      if (data.street && data.number) {
        const fullAddress = `${data.street}, ${data.number}${data.complement ? `, ${data.complement}` : ""} - ${data.neighborhood || ""} - ${data.city || ""}/${data.state || ""} - CEP: ${data.zipcode || ""}`;
        data.address = fullAddress;
      }
      
      // Validar CNPJ se preenchido
      if (data.cnpj && data.cnpj.length < 14) {
        toast({
          title: "CNPJ inválido",
          description: "Por favor, digite um CNPJ válido com pelo menos 14 dígitos.",
          variant: "destructive",
        });
        setIsUpdatingProfile(false);
        return;
      }
      
      // Enviar dados para o servidor
      await updatePartnerMutation.mutateAsync(data);
    } catch (error) {
      console.error("Erro ao atualizar perfil de parceiro:", error);
      toast({
        title: "Erro ao atualizar perfil da empresa",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar o perfil da empresa.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
      setIsEditMode(false);
    }
  };
  
  // Handle password form submission
  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsChangingPassword(true);
    
    try {
      await apiRequest('PUT', '/api/users/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso.",
      });
      
      // Resetar o form
      passwordForm.reset();
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      
      let errorMessage = "Ocorreu um erro ao alterar sua senha.";
      
      // Mensagens específicas baseadas no status HTTP
      if (error.response?.status === 401) {
        errorMessage = "Senha atual incorreta. Por favor, verifique e tente novamente.";
      } else if (error.response?.status === 400) {
        errorMessage = "A nova senha deve ser diferente da senha atual.";
      }
      
      toast({
        title: "Erro ao alterar senha",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Criar URL temporária para visualização
      const objectUrl = URL.createObjectURL(file);
      setProfileImage(objectUrl);
      
      // Limpar URL ao desmontar componente
      return () => URL.revokeObjectURL(objectUrl);
    }
  };
  
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Remover a imagem de perfil
  const handleRemoveImage = () => {
    setSelectedFile(null);
    setProfileImage(null);
    
    if (user?.role === "doctor" && doctorData?.id) {
      // Atualizar o perfil do médico sem imagem
      updateDoctorMutation.mutate({
        ...doctorForm.getValues(),
        profileImage: null 
      });
    }
  };
  
  if (profileLoading || (user?.role === "partner" && partnerLoading) || (user?.role === "doctor" && doctorLoading)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Carregando perfil...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Breadcrumb 
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Perfil', href: '/profile', active: true }
          ]} 
        />
        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Pagamento
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <CardTitle>Informações do Perfil</CardTitle>
                    <CardDescription>
                      Atualize seus dados pessoais e informações de contato
                    </CardDescription>
                  </div>
                  
                  {user?.role === "doctor" && (
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <Avatar className="h-24 w-24 border-2 border-border">
                          {profileImage ? (
                            <AvatarImage 
                              src={profileImage} 
                              alt={doctorData?.specialization || "Perfil médico"} 
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="text-xl">
                              {(doctorData?.specialization || "DR").substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute -bottom-2 -right-2 rounded-full bg-background border"
                          onClick={handleFileSelect}
                          disabled={isUpdatingProfile}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {profileImage && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={handleRemoveImage}
                        >
                          Remover foto
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pb-24 md:pb-8"> {/* Adicionando padding maior no mobile para evitar o botão ser cortado */}
                {/* Paciente (padrão) */}
                {(user?.role === "patient" || user?.role === "admin") && (
                  <Form {...patientForm}>
                    <form onSubmit={patientForm.handleSubmit(onPatientSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={patientForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Completo</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Seu nome completo" 
                                  disabled={isUpdatingProfile || !isEditMode}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={patientForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome de Usuário</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="seunome" 
                                  disabled={isUpdatingProfile || !isEditMode}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={patientForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="seu@email.com" 
                                type="email" 
                                disabled={isUpdatingProfile || !isEditMode}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={patientForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="(00) 00000-0000" 
                                disabled={isUpdatingProfile || !isEditMode}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Seção de Endereço Completo */}
                      <div className="mt-6 mb-4">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-medium">Endereço</h3>
                        </div>
                        
                        <AddressForm
                          defaultValues={{
                            zipcode: patientForm.getValues("zipcode") || "",
                            street: patientForm.getValues("street") || "",
                            number: patientForm.getValues("number") || "",
                            complement: patientForm.getValues("complement") || "",
                            neighborhood: patientForm.getValues("neighborhood") || "",
                            city: patientForm.getValues("city") || "",
                            state: patientForm.getValues("state") || "",
                          }}
                          isSubmitting={isUpdatingProfile || !isEditMode}
                          onSubmit={(addressData) => {
                            // Atualizar os valores no formulário principal
                            patientForm.setValue("zipcode", addressData.zipcode);
                            patientForm.setValue("street", addressData.street);
                            patientForm.setValue("number", addressData.number);
                            patientForm.setValue("complement", addressData.complement || "");
                            patientForm.setValue("neighborhood", addressData.neighborhood);
                            patientForm.setValue("city", addressData.city);
                            patientForm.setValue("state", addressData.state);
                            
                            // Construir o endereço completo para o campo legado
                            const fullAddress = `${addressData.street}, ${addressData.number}${addressData.complement ? `, ${addressData.complement}` : ""} - ${addressData.neighborhood} - ${addressData.city}/${addressData.state} - CEP: ${addressData.zipcode}`;
                            patientForm.setValue("address", fullAddress);
                            
                            toast({
                              title: "Endereço atualizado",
                              description: "Endereço atualizado no formulário. Clique em Salvar Alterações para persistir as mudanças.",
                            });
                          }}
                          showSubmitButton={false}
                          standAlone={false} // Modo integrado - não cria um <form> aninhado
                        />
                      </div>
                      
                      <FormField
                        control={patientForm.control}
                        name="birthDate"
                        render={({ field }) => (
                          <FormItem className="max-w-sm">
                            <FormLabel>Data de Nascimento</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                disabled={isUpdatingProfile || !isEditMode}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end gap-3">
                        {!isEditMode ? (
                          <Button 
                            type="button" 
                            onClick={() => setIsEditMode(true)}
                            variant="outline"
                          >
                            Editar informações
                          </Button>
                        ) : (
                          <Button 
                            type="button" 
                            onClick={() => setIsEditMode(false)}
                            variant="outline"
                          >
                            Cancelar edição
                          </Button>
                        )}
                        
                        <Button 
                          type="submit" 
                          disabled={isUpdatingProfile || !isEditMode}
                        >
                          {isUpdatingProfile ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : "Salvar Alterações"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
                
                {/* Médico */}
                {user?.role === "doctor" && doctorData && (
                  <Form {...doctorForm}>
                    <form onSubmit={doctorForm.handleSubmit(onDoctorSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={doctorForm.control}
                          name="specialization"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Especialização</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Cardiologia, Neurologia, etc." 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={doctorForm.control}
                          name="licenseNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número de Registro (CRM)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345-SP" 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={doctorForm.control}
                        name="biography"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Biografia Profissional</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Descreva sua experiência e especialidades..." 
                                disabled={isUpdatingProfile}
                                className="min-h-32"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={doctorForm.control}
                          name="education"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Formação Acadêmica</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Universidade, Curso, Ano" 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={doctorForm.control}
                          name="experienceYears"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Anos de Experiência</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0"
                                  placeholder="10" 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={doctorForm.control}
                        name="consultationFee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor da Consulta (R$)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                step="0.01"
                                placeholder="150.00" 
                                disabled={isUpdatingProfile}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={doctorForm.control}
                        name="availableForEmergency"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isUpdatingProfile}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Disponível para Emergências</FormLabel>
                              <FormDescription>
                                Permitir que pacientes me contatem para consultas de emergência
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={isUpdatingProfile}
                        >
                          {isUpdatingProfile ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : "Salvar Alterações"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
                
                {/* Parceiro (Empresa) */}
                {user?.role === "partner" && partnerData && (
                  <Form {...partnerForm}>
                    <form onSubmit={partnerForm.handleSubmit(onPartnerSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={partnerForm.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome da Empresa</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Sua Empresa Ltda." 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={partnerForm.control}
                          name="businessType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Negócio</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Clínica, Hospital, etc." 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={partnerForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição da Empresa</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Descreva sua empresa e serviços..." 
                                disabled={isUpdatingProfile}
                                className="min-h-32"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={partnerForm.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://www.seusite.com.br" 
                                  type="url"
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={partnerForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefone</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="(00) 0000-0000" 
                                  disabled={isUpdatingProfile}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={partnerForm.control}
                        name="cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNPJ</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="00.000.000/0000-00" 
                                disabled={isUpdatingProfile}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Seção de Endereço Comercial Completo */}
                      <div className="mt-6 mb-4">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-medium">Endereço Comercial</h3>
                        </div>
                        
                        <div className="address-form-container">
                          <AddressForm
                            defaultValues={{
                              zipcode: partnerForm.getValues("zipcode") || "",
                              street: partnerForm.getValues("street") || "",
                              number: partnerForm.getValues("number") || "",
                              complement: partnerForm.getValues("complement") || "",
                              neighborhood: partnerForm.getValues("neighborhood") || "",
                              city: partnerForm.getValues("city") || "",
                              state: partnerForm.getValues("state") || "",
                            }}
                            onSubmit={(addressData) => {
                              // Atualizar os valores no formulário principal
                              Object.entries(addressData).forEach(([key, value]) => {
                                if (key in partnerForm.getValues()) {
                                  partnerForm.setValue(key as any, value);
                                }
                              });
                              
                              // Construir o endereço completo para o campo legado
                              const fullAddress = `${addressData.street}, ${addressData.number}${addressData.complement ? `, ${addressData.complement}` : ""} - ${addressData.neighborhood} - ${addressData.city}/${addressData.state} - CEP: ${addressData.zipcode}`;
                              partnerForm.setValue("address", fullAddress);
                              
                              toast({
                                title: "Endereço atualizado",
                                description: "Endereço atualizado no formulário. Clique em Salvar Alterações para persistir as mudanças.",
                              });
                            }}
                            isSubmitting={isUpdatingProfile}
                            showSubmitButton={false}
                            standAlone={false} // Modo integrado - não cria um <form> aninhado
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={isUpdatingProfile}
                        >
                          {isUpdatingProfile ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : "Salvar Alterações"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>
                  Altere sua senha e configure outras opções de segurança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha Atual</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              disabled={isChangingPassword}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              disabled={isChangingPassword}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              disabled={isChangingPassword}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={isChangingPassword}
                      >
                        {isChangingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Alterando senha...
                          </>
                        ) : "Alterar Senha"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Assinaturas e Pagamentos</CardTitle>
                <CardDescription>
                  Gerencie seus métodos de pagamento e visualize seu histórico de transações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Informações de Assinatura</h3>
                    <p className="text-sm text-muted-foreground">Seu plano atual: <span className="font-medium">{profileData?.subscriptionPlan ? profileData.subscriptionPlan.replace(/_/g, ' ').toUpperCase() : "Não assinante"}</span></p>
                    <p className="text-sm text-muted-foreground">Status: <span className={`font-medium ${profileData?.subscriptionStatus === 'active' ? 'text-green-500' : 'text-red-500'}`}>{profileData?.subscriptionStatus === 'active' ? 'Ativo' : 'Inativo'}</span></p>
                    
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">Para gerenciar sua assinatura ou trocar de plano, visite a página de <a href="/subscription" className="text-primary underline">assinaturas</a>.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Profile;