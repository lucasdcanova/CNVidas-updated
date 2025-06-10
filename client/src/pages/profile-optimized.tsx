import React, { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Control } from "react-hook-form";
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
  getCurrentPartner,
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
import { AddressForm, AddressFormValues } from "@/components/forms/address-form";
import { ImageCropper } from "@/components/shared/ImageCropper";
import PaymentMethods from "@/components/payment/payment-methods";

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
  experienceYears: z.string().optional(),
  availableForEmergency: z.boolean().optional(),
  consultationFee: z.string().optional(),
  profileImage: z.string().optional(),
});

// Esquema de perfil do parceiro (empresa)
const partnerProfileSchema = z.object({
  businessName: z.string().min(1, "Nome da empresa é obrigatório"),
  businessType: z.string().min(1, "Tipo de negócio é obrigatório"),
  description: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
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

const ProfileOptimized: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para controlar se os dados iniciais já foram carregados
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Fetch user profile data
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/users/profile"],
    queryFn: getUserProfile,
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
  });
  
  // Fetch partner data if user is a partner
  const { data: partnerData, isLoading: partnerLoading } = useQuery({
    queryKey: ["/api/partners/me"],
    queryFn: getCurrentPartner,
    enabled: !!user?.id && user?.role === "partner",
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
  
  // Fetch doctor data if user is a doctor
  const { data: doctorData, isLoading: doctorLoading } = useQuery({
    queryKey: ["/api/doctors/user", user?.id],
    queryFn: () => getDoctorByUserId(user?.id || 0),
    enabled: !!user?.id && user?.role === "doctor",
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
  
  // Valores padrão memoizados para evitar re-renders
  const patientDefaultValues = useMemo(() => ({
    fullName: profileData?.fullName || "",
    username: profileData?.username || "",
    email: profileData?.email || "",
    phone: profileData?.phone || "",
    address: profileData?.address || "",
    zipcode: profileData?.zipcode || "",
    street: profileData?.street || "",
    number: profileData?.number || "",
    complement: profileData?.complement || "",
    neighborhood: profileData?.neighborhood || "",
    city: profileData?.city || "",
    state: profileData?.state || "",
    birthDate: profileData?.birthDate ? new Date(profileData.birthDate).toISOString().split('T')[0] : "",
  }), [profileData]);
  
  // Patient profile form
  const patientForm = useForm<PatientProfileFormValues>({
    resolver: zodResolver(patientProfileSchema),
    defaultValues: patientDefaultValues,
  });
  
  // Atualizar formulário do paciente apenas uma vez quando os dados são carregados
  React.useEffect(() => {
    if (profileData && !isInitialized && user?.role === "patient") {
      console.log("Inicializando formulário do paciente com dados:", profileData);
      patientForm.reset(patientDefaultValues);
      setIsInitialized(true);
    }
  }, [profileData, isInitialized, patientDefaultValues, patientForm, user?.role]);
  
  // Doctor profile form
  const doctorForm = useForm<DoctorProfileFormValues>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      specialization: "",
      licenseNumber: "",
      biography: "",
      education: "",
      experienceYears: "",
      availableForEmergency: false,
      consultationFee: "",
      profileImage: "",
    },
  });
  
  // Partner profile form
  const partnerForm = useForm<PartnerProfileFormValues>({
    resolver: zodResolver(partnerProfileSchema),
    defaultValues: {
      businessName: "",
      businessType: "",
      description: "",
      website: "",
      address: "",
      zipcode: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      phone: "",
      cnpj: "",
    },
  });
  
  // Inicializar dados do médico uma única vez
  React.useEffect(() => {
    if (doctorData && !isInitialized && user?.role === "doctor") {
      console.log("Inicializando formulário do médico com dados:", doctorData);
      doctorForm.reset({
        specialization: doctorData.specialization || "",
        licenseNumber: doctorData.licenseNumber || "",
        biography: doctorData.biography || "",
        education: doctorData.education || "",
        experienceYears: doctorData.experienceYears?.toString() || "",
        availableForEmergency: doctorData.availableForEmergency || false,
        consultationFee: doctorData.consultationFee?.toString() || "",
        profileImage: doctorData.profileImage || "",
      });
      
      if (doctorData.profileImage) {
        setProfileImage(doctorData.profileImage);
      }
      setIsInitialized(true);
    }
  }, [doctorData, isInitialized, doctorForm, user?.role]);
  
  // Inicializar dados do parceiro uma única vez
  React.useEffect(() => {
    if (partnerData && !isInitialized && user?.role === "partner") {
      console.log("Inicializando formulário do parceiro com dados:", partnerData);
      partnerForm.reset({
        businessName: partnerData.businessName || "",
        businessType: partnerData.businessType || "",
        description: partnerData.description || "",
        website: partnerData.website || "",
        address: partnerData.address || "",
        zipcode: partnerData.zipcode || "",
        street: partnerData.street || "",
        number: partnerData.number || "",
        complement: partnerData.complement || "",
        neighborhood: partnerData.neighborhood || "",
        city: partnerData.city || "",
        state: partnerData.state || "",
        phone: partnerData.phone || "",
        cnpj: partnerData.cnpj || "",
      });
      setIsInitialized(true);
    }
  }, [partnerData, isInitialized, partnerForm, user?.role]);

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
      // Invalidar apenas a query específica
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
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
  
  // Handle patient profile form submission
  const onPatientSubmit = useCallback(async (data: PatientProfileFormValues) => {
    event?.preventDefault();
    
    setIsUpdatingProfile(true);
    
    try {
      await updateProfileMutation.mutateAsync({
        fullName: data.fullName || "",
        username: data.username || "",
        email: data.email || "",
        phone: data.phone || "",
        birthDate: data.birthDate || "",
        // Garantir que todos os campos de endereço são enviados explicitamente
        zipcode: data.zipcode || "",
        street: data.street || "",
        number: data.number || "",
        complement: data.complement || "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || ""
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [updateProfileMutation]);
  
  // Callback otimizado para atualização de endereço
  const handleAddressUpdate = useCallback((addressData: AddressFormValues) => {
    console.log("Atualizando endereço no formulário:", addressData);
    
    // Atualizar os valores no formulário principal sem causar re-render
    patientForm.setValue("zipcode", addressData.zipcode, { shouldDirty: true });
    patientForm.setValue("street", addressData.street, { shouldDirty: true });
    patientForm.setValue("number", addressData.number, { shouldDirty: true });
    patientForm.setValue("complement", addressData.complement || "", { shouldDirty: true });
    patientForm.setValue("neighborhood", addressData.neighborhood, { shouldDirty: true });
    patientForm.setValue("city", addressData.city, { shouldDirty: true });
    patientForm.setValue("state", addressData.state, { shouldDirty: true });
    
    // Construir o endereço completo para o campo legado
    const fullAddress = `${addressData.street}, ${addressData.number}${addressData.complement ? `, ${addressData.complement}` : ""} - ${addressData.neighborhood} - ${addressData.city}/${addressData.state} - CEP: ${addressData.zipcode}`;
    patientForm.setValue("address", fullAddress, { shouldDirty: true });
  }, [patientForm]);
  
  // Handle doctor profile form submission
  const onDoctorSubmit = useCallback(async (data: DoctorProfileFormValues) => {
    setIsUpdatingProfile(true);
    
    try {
      const formattedData = {
        ...data,
        experienceYears: data.experienceYears ? parseInt(data.experienceYears, 10) : undefined,
        consultationFee: data.consultationFee ? parseFloat(data.consultationFee) : undefined,
      };
      
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
        formattedData.profileImage = result.imageUrl;
      }
      
      await updateDoctor(doctorData?.id || 0, formattedData);
      
      toast({
        title: "Perfil médico atualizado",
        description: "Suas informações profissionais foram atualizadas com sucesso.",
      });
      
      setSelectedFile(null);
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/user", user?.id] });
    } catch (error) {
      console.error("Erro ao atualizar perfil médico:", error);
      toast({
        title: "Erro ao atualizar perfil médico",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar seu perfil médico.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [doctorData?.id, selectedFile, toast, queryClient, user?.id]);
  
  // Handle partner profile form submission
  const onPartnerSubmit = useCallback(async (data: PartnerProfileFormValues) => {
    setIsUpdatingProfile(true);
    
    try {
      if (data.cnpj && data.cnpj.length < 14) {
        toast({
          title: "CNPJ inválido",
          description: "Por favor, digite um CNPJ válido com pelo menos 14 dígitos.",
          variant: "destructive",
        });
        setIsUpdatingProfile(false);
        return;
      }
      
      await updatePartner(partnerData?.id || 0, data);
      
      toast({
        title: "Perfil da empresa atualizado",
        description: "As informações da empresa foram atualizadas com sucesso.",
      });
      
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/partners/me"] });
    } catch (error) {
      console.error("Erro ao atualizar perfil de parceiro:", error);
      toast({
        title: "Erro ao atualizar perfil da empresa",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar o perfil da empresa.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [partnerData?.id, toast, queryClient]);
  
  // Handle password form submission
  const onPasswordSubmit = useCallback(async (data: PasswordFormValues) => {
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
      
      passwordForm.reset();
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      
      let errorMessage = "Ocorreu um erro ao alterar sua senha.";
      
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
  }, [toast, passwordForm]);
  
  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione apenas imagens (JPEG, PNG, etc.)",
          variant: "destructive"
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 5MB",
          variant: "destructive"
        });
        return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      setTempImageUrl(objectUrl);
      setShowCropDialog(true);
    }
  }, [toast]);
  
  const handleFileSelect = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  const handleCropCancel = useCallback(() => {
    setShowCropDialog(false);
    setTempImageUrl(null);
  }, []);
  
  const handleCropComplete = useCallback((croppedImageBlob: Blob) => {
    const file = new File([croppedImageBlob], "profile_cropped.jpg", { type: "image/jpeg" });
    setSelectedFile(file);
    
    const objectUrl = URL.createObjectURL(croppedImageBlob);
    setProfileImage(objectUrl);
    
    setShowCropDialog(false);
    setTempImageUrl(null);
  }, []);
  
  const uploadProfileImage = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Por favor, selecione uma imagem para fazer upload",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUpdatingProfile(true);
      
      const formData = new FormData();
      formData.append('profileImage', selectedFile);
      
      const token = localStorage.getItem('authToken');
      const sessionId = localStorage.getItem('sessionId');
      const headers: Record<string, string> = {};
      
      if (token) headers['Authorization'] = token;
      if (sessionId) headers['X-Session-ID'] = sessionId;
      
      const response = await fetch('/api/doctor-profile-image', {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.imageUrl) {
        setProfileImage(result.imageUrl);
      }
      
      toast({
        title: "Imagem atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso."
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/user", user?.id] });
      
    } catch (error) {
      console.error("Erro ao fazer upload de imagem:", error);
      toast({
        title: "Erro ao atualizar imagem",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao fazer upload da imagem",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [selectedFile, toast, queryClient, user?.id]);
  
  const handleRemoveImage = useCallback(() => {
    setSelectedFile(null);
    setProfileImage(null);
    
    if (user?.role === "doctor" && doctorData?.id) {
      updateDoctor(doctorData.id, {
        ...doctorForm.getValues(),
        profileImage: null 
      });
    }
  }, [user?.role, doctorData?.id, doctorForm]);
  
  // Query para buscar os métodos de pagamento
  const paymentMethodsQuery = useQuery({
    queryKey: ['/api/subscription/payment-methods'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscription/payment-methods');
      if (!response.ok) {
        throw new Error('Falha ao buscar métodos de pagamento');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const paymentMethodsData = paymentMethodsQuery.data;

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
      {/* Componente de recorte de imagem */}
      {showCropDialog && tempImageUrl && (
        <ImageCropper
          imageUrl={tempImageUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          isOpen={showCropDialog}
        />
      )}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className={`grid w-full ${user?.role === "patient" ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
            {user?.role === "patient" && (
              <TabsTrigger value="billing">
                <CreditCard className="h-4 w-4 mr-2" />
                Pagamento
              </TabsTrigger>
            )}
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
                              src={profileImage?.startsWith('/') ? profileImage : `/${profileImage}`} 
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
                      
                      <div className="flex flex-col space-y-2 mt-2">
                        {user?.role === "doctor" && selectedFile && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="text-xs"
                            onClick={uploadProfileImage}
                            disabled={isUpdatingProfile}
                          >
                            {isUpdatingProfile ? "Enviando..." : "Salvar imagem"}
                          </Button>
                        )}
                        
                        {profileImage && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={handleRemoveImage}
                          >
                            Remover foto
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pb-24 md:pb-8">
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
                          key={`address-${profileData?.id}`} // Key para evitar re-renders
                          defaultValues={{
                            zipcode: patientForm.watch("zipcode") || "",
                            street: patientForm.watch("street") || "",
                            number: patientForm.watch("number") || "",
                            complement: patientForm.watch("complement") || "",
                            neighborhood: patientForm.watch("neighborhood") || "",
                            city: patientForm.watch("city") || "",
                            state: patientForm.watch("state") || "",
                          }}
                          isSubmitting={isUpdatingProfile || !isEditMode}
                          onSubmit={handleAddressUpdate}
                          showSubmitButton={false}
                          standAlone={false}
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
                
                {/* ... resto do código para médico e parceiro permanece igual ... */}
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

                  {/* Componente de métodos de pagamento */}
                  <PaymentMethods 
                    paymentMethods={paymentMethodsData?.paymentMethods || []}
                    onUpdate={() => {
                      paymentMethodsQuery.refetch();
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Card de Vendedor/Consultor - apenas para pacientes */}
            {user?.role === "patient" && (
              <SellerForm subscriptionChangedAt={profileData?.updatedAt} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProfileOptimized;