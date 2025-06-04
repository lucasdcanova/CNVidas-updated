import React, { useState, useRef } from "react";
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
import { ImageCropper } from "@/components/shared/ImageCropper";
import PaymentMethods from "@/components/payment/payment-methods";
import { useStripeSetup } from '@/hooks/use-stripe-setup';

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
  const [isEditMode, setIsEditMode] = useState(true);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
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
        zipcode: profileData.zipcode || "",
        street: profileData.street || "",
        number: profileData.number || "",
        complement: profileData.complement || "",
        neighborhood: profileData.neighborhood || "",
        city: profileData.city || "",
        state: profileData.state || "",
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
  
  // Inicializar a imagem de perfil e atualizar o formulário quando os dados do médico forem carregados
  React.useEffect(() => {
    if (doctorData) {
      console.log("Atualizando formulário do médico com dados:", doctorData);
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
    }
  }, [doctorData, doctorForm]);
  
  // Partner profile form
  const partnerForm = useForm<PartnerProfileFormValues>({
    resolver: zodResolver(partnerProfileSchema),
    defaultValues: {
      businessName: partnerData?.businessName || "",
      businessType: partnerData?.businessType || "",
      description: partnerData?.description || "",
      website: partnerData?.website || "",
      address: partnerData?.address || "",
      zipcode: partnerData?.zipcode || "",
      street: partnerData?.street || "",
      number: partnerData?.number || "",
      complement: partnerData?.complement || "",
      neighborhood: partnerData?.neighborhood || "",
      city: partnerData?.city || "",
      state: partnerData?.state || "",
      phone: partnerData?.phone || "",
      cnpj: partnerData?.cnpj || "",
    },
  });
  
  // Atualizar o formulário do parceiro quando os dados forem carregados ou alterados
  React.useEffect(() => {
    if (partnerData) {
      console.log("Atualizando formulário do parceiro com dados:", partnerData);
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
    }
  }, [partnerData, partnerForm]);

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
    event?.preventDefault(); // Evitar qualquer comportamento padrão de formulário
    
    setIsUpdatingProfile(true);
    
    try {
      // Voltar ao uso do hook de mutação original, que já tem a autenticação configurada corretamente
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
      
      // Exibir mensagem de sucesso
      toast({
        title: "Perfil atualizado",
        description: "Seu perfil foi atualizado com sucesso!",
      });
      
      // Recarregar os dados do perfil para mostrar os dados atualizados
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      
      // Sair do modo edição automaticamente
      setIsEditMode(false);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro ao atualizar perfil",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar seu perfil.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
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
      const doctorDataToSend = {
        specialization: formattedData.specialization,
        licenseNumber: formattedData.licenseNumber,
        biography: formattedData.biography,
        education: formattedData.education,
        experienceYears: formattedData.experienceYears,
        availableForEmergency: formattedData.availableForEmergency,
        consultationFee: formattedData.consultationFee,
        profileImage: formattedData.profileImage
      };
      await updateDoctorMutation.mutateAsync(doctorDataToSend);
      
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
      // Debug - mostrar os valores do formulário antes de qualquer processamento
      console.log("Valores originais do formulário:", {
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipcode: data.zipcode
      });
      
      // Verificar valores atuais diretamente do DOM para depuração
      console.log("Valores atuais dos campos do formulário:", {
        street: (document.getElementById('street') as HTMLInputElement | null)?.value,
        number: (document.getElementById('number') as HTMLInputElement | null)?.value,
        neighborhood: (document.getElementById('neighborhood') as HTMLInputElement | null)?.value,
      });
      
      // Capturar valores diretamente dos campos do formulário de endereço
      // já que pode haver uma desconexão entre os formulários
      const streetValue = (document.getElementById('street') as HTMLInputElement | null)?.value || data.street || "";
      const numberValue = (document.getElementById('number') as HTMLInputElement | null)?.value || data.number || "";
      const complementValue = (document.getElementById('complement') as HTMLInputElement | null)?.value || data.complement || "";
      const neighborhoodValue = (document.getElementById('neighborhood') as HTMLInputElement | null)?.value || data.neighborhood || "";
      
      // Construir endereço completo para compatibilidade
      if (streetValue && numberValue) {
        const fullAddress = `${streetValue}, ${numberValue}${complementValue ? `, ${complementValue}` : ""} - ${neighborhoodValue || ""} - ${data.city || ""}/${data.state || ""} - CEP: ${data.zipcode || ""}`;
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
      
      // Garantir que todos os campos de endereço são enviados explicitamente
      // usando os valores capturados diretamente dos campos
      const dataWithAllFields = {
        ...data,
        businessName: data.businessName || "",
        businessType: data.businessType || "",
        description: data.description || "",
        website: data.website || "",
        phone: data.phone || "",
        cnpj: data.cnpj || "",
        // Campos de endereço explícitos - usar valores capturados
        zipcode: data.zipcode || "",
        street: streetValue,
        number: numberValue,
        complement: complementValue,
        neighborhood: neighborhoodValue,
        city: data.city || "",
        state: data.state || "",
        address: data.address || ""
      };
      
      console.log("Enviando dados completos do parceiro:", dataWithAllFields);
      
      // Enviar dados para o servidor
      await updatePartnerMutation.mutateAsync(dataWithAllFields);
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
      
      // Verificar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione apenas imagens (JPEG, PNG, etc.)",
          variant: "destructive"
        });
        return;
      }
      
      // Verificar tamanho do arquivo (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 5MB",
          variant: "destructive"
        });
        return;
      }
      
      // Criar URL temporária para o diálogo de recorte
      const objectUrl = URL.createObjectURL(file);
      setTempImageUrl(objectUrl);
      
      // Abrir o diálogo de recorte
      setShowCropDialog(true);
      
      console.log("Arquivo selecionado:", file.name, "Tamanho:", Math.round(file.size / 1024), "KB");
    }
  };
  
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Lidar com o cancelamento do recorte
  const handleCropCancel = () => {
    setShowCropDialog(false);
    setTempImageUrl(null);
  };
  
  // Lidar com a conclusão do recorte
  const handleCropComplete = (croppedImageBlob: Blob) => {
    // Criar um arquivo a partir do Blob
    const file = new File([croppedImageBlob], "profile_cropped.jpg", { type: "image/jpeg" });
    
    // Salvar arquivo selecionado
    setSelectedFile(file);
    
    // Criar URL temporária para visualização
    const objectUrl = URL.createObjectURL(croppedImageBlob);
    setProfileImage(objectUrl);
    
    // Fechar diálogo de recorte
    setShowCropDialog(false);
    setTempImageUrl(null);
    
    console.log("Imagem recortada com sucesso:", Math.round(croppedImageBlob.size / 1024), "KB");
  };
  
  // Fazer upload da imagem para o servidor
  const uploadProfileImage = async () => {
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
      console.log("Iniciando upload da imagem:", selectedFile.name);
      
      const formData = new FormData();
      formData.append('profileImage', selectedFile);
      
      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('authToken');
      const sessionId = localStorage.getItem('sessionId');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = token;
        console.log("Token de autenticação encontrado:", token);
      } else {
        console.log("Token de autenticação não encontrado");
      }
      
      if (sessionId) {
        headers['X-Session-ID'] = sessionId;
        console.log("Session ID encontrado:", sessionId);
      } else {
        console.log("Session ID não encontrado");
      }
      
      console.log("Headers para upload:", headers);
      
      // Fazer o upload da imagem
      console.log("Enviando solicitação para /api/doctor-profile-image");
      const response = await fetch('/api/doctor-profile-image', {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include' // Importante para enviar cookies de sessão
      });
      
      console.log("Resposta recebida:", response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na resposta:", errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("Resultado do upload:", result);
      
      // Atualizar a imagem exibida com a URL retornada pelo servidor
      if (result.imageUrl) {
        console.log("Nova URL da imagem:", result.imageUrl);
        setProfileImage(result.imageUrl);
      }
      
      toast({
        title: "Imagem atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso."
      });
      
      // Atualizar o cache de consultas
      console.log("Invalidando consultas para atualizar a UI");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
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
  
  // Adicionar a query para buscar os métodos de pagamento
  const paymentMethodsQuery = useQuery({
    queryKey: ['/api/subscription/payment-methods'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscription/payment-methods');
      if (!response.ok) {
        throw new Error('Falha ao buscar métodos de pagamento');
      }
      return response.json();
    }
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
          aspectRatio={1} // Quadrado
          isOpen={showCropDialog}
        />
      )}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className={`grid w-full ${user?.role === "doctor" ? "grid-cols-2" : "grid-cols-3"}`}>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
            {user?.role !== "doctor" && (
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
                        {/* Botão de upload de imagem para médicos quando um arquivo foi selecionado */}
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
                        
                        {/* Botão de remover imagem */}
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
                          control={doctorForm.control as Control<DoctorProfileFormValues>}
                          name="specialization"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Especialização</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Ex: Clínico Geral" 
                                  disabled={isUpdatingProfile || !isEditMode}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={doctorForm.control as Control<DoctorProfileFormValues>}
                          name="licenseNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número de Registro (CRM)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345-SP" 
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
                        control={doctorForm.control as Control<DoctorProfileFormValues>}
                        name="biography"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Biografia Profissional</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Descreva sua experiência e especialidades..." 
                                disabled={isUpdatingProfile || !isEditMode}
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
                          control={doctorForm.control as Control<DoctorProfileFormValues>}
                          name="education"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Formação Acadêmica</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Universidade, Curso, Ano" 
                                  disabled={isUpdatingProfile || !isEditMode}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={doctorForm.control as Control<DoctorProfileFormValues>}
                          name="experienceYears"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Anos de Experiência</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0"
                                  placeholder="10" 
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
                        control={doctorForm.control as Control<DoctorProfileFormValues>}
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
                                disabled={isUpdatingProfile || !isEditMode}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={doctorForm.control as Control<DoctorProfileFormValues>}
                        name="availableForEmergency"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isUpdatingProfile || !isEditMode}
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
                              console.log("Dados de endereço recebidos do componente AddressForm:", addressData);
                              
                              // Atualizar os valores no formulário principal
                              partnerForm.setValue("zipcode", addressData.zipcode);
                              partnerForm.setValue("street", addressData.street);
                              partnerForm.setValue("number", addressData.number);
                              partnerForm.setValue("complement", addressData.complement || "");
                              partnerForm.setValue("neighborhood", addressData.neighborhood);
                              partnerForm.setValue("city", addressData.city);
                              partnerForm.setValue("state", addressData.state);
                              
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

                  {/* Componente de métodos de pagamento */}
                  <PaymentMethods 
                    paymentMethods={paymentMethodsData?.paymentMethods || []}
                    onUpdate={() => {
                      // Recarregar os métodos de pagamento
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

export default Profile;