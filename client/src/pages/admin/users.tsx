import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveTable,
  ResponsiveTableHeader,
  ResponsiveTableBody,
  ResponsiveTableHead,
  ResponsiveTableRow,
  ResponsiveTableCell,
} from "@/components/ui/responsive-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchIcon, UserPlus, Edit, Trash2, AlertCircle, Check, X, Eye, Shield, CreditCard, Star, Calendar, Video, Settings, Hammer, Building2, Stethoscope, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getPlanName } from "@/components/shared/plan-indicator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { User, Doctor } from '@/shared/types';

interface DoctorFormData {
  specialization: string;
  licenseNumber: string;
  biography?: string;
  education?: string;
  experienceYears?: number;
  consultationFee?: number;
  availableForEmergency: boolean;
  profileImage?: string;
  status: string;
}

interface UserWithDoctor extends User {
  doctor?: Doctor;
}

// Schema para criação e edição de usuários
const userSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  username: z.string().min(3, { message: "Nome de usuário deve ter pelo menos 3 caracteres" }),
  fullName: z.string().min(3, { message: "Nome completo é obrigatório" }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }).optional(),
  role: z.enum(["patient", "doctor", "partner", "admin"], {
    invalid_type_error: "Perfil inválido",
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Schema para edição de perfil médico
const doctorSchema = z.object({
  specialization: z.string().min(2, { message: "Especialização é obrigatória" }),
  licenseNumber: z.string().min(4, { message: "Número de registro profissional é obrigatório" }),
  biography: z.string().optional(),
  education: z.string().optional(),
  experienceYears: z.coerce.number().min(0).optional(),
  consultationFee: z.coerce.number().min(0, { message: "Valor da consulta deve ser positivo" }).optional(),
  availableForEmergency: z.boolean().default(false),
  profileImage: z.string().optional(),
  status: z.string().default("pending"),
});

// Schema para o formulário de edição de usuário
const userFormSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  username: z.string().min(3, { message: "Nome de usuário deve ter pelo menos 3 caracteres" }),
  fullName: z.string().min(3, { message: "Nome completo deve ter pelo menos 3 caracteres" }),
  password: z.string().optional(),
  role: z.enum(["patient", "doctor", "partner", "admin"]),
  phone: z.string().optional(),
  address: z.string().optional(),
  emailVerified: z.boolean().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

// Função utilitária para formatar datas de forma segura
const formatDate = (dateValue: string | Date | null | undefined): string => {
  if (!dateValue) return 'Não informado';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Data inválida';
  }
};

const AdminUsersPage: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openNewDialog, setOpenNewDialog] = useState<boolean>(false);
  const [openEditDialog, setOpenEditDialog] = useState<boolean>(false);
  const [openDoctorDialog, setOpenDoctorDialog] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserWithDoctor | null>(null);
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Buscar lista de usuários
  const { data: users = [], isLoading } = useQuery<UserWithDoctor[], Error>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      console.log("Buscando lista de usuários admin");
      
      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      
      if (!response.ok) {
        console.error(`Erro ao buscar usuários: ${response.status} ${response.statusText}`);
        throw new Error("Falha ao carregar lista de usuários. Verifique sua permissão.");
      }
      
      const data = await response.json();
      console.log(`Recebidos ${data.length} usuários`);
      return data;
    },
    retry: 1,
  });

  // Filtrar usuários baseado na busca e no filtro de role
  const filteredUsers = Array.isArray(users) ? users.filter((user) => {
    const matchesSearch = 
      searchQuery === "" || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === null || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    // Ordenação cronológica baseada na data de criação
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    
    // Verificar se as datas são válidas
    const validDateA = !isNaN(dateA) ? dateA : 0;
    const validDateB = !isNaN(dateB) ? dateB : 0;
    
    if (sortOrder === 'newest') {
      return validDateB - validDateA; // Mais recente primeiro
    } else {
      return validDateA - validDateB; // Mais antigo primeiro
    }
  }) : [];

  // Form para criar novo usuário
  const createForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      username: "",
      fullName: "",
      password: "",
      role: "patient",
    },
  });

  // Form para editar usuário
  const editForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      username: "",
      fullName: "",
      password: "",
      role: "patient",
      phone: "",
      address: "",
      emailVerified: false,
    },
  });
  
  // Form para editar perfil médico
  const doctorForm = useForm<DoctorFormData>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      specialization: "",
      licenseNumber: "",
      biography: "",
      education: "",
      experienceYears: 0,
      consultationFee: 0,
      availableForEmergency: false,
      status: "pending",
    },
  });

  // Estado para diálogos adicionais
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [openPremiumAccessDialog, setOpenPremiumAccessDialog] = useState(false);
  const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] = useState<string>("free");
  const [premiumAccessReason, setPremiumAccessReason] = useState<string>("");
  const [selectedPremiumPlan, setSelectedPremiumPlan] = useState<string>("basic");

  // Mutation para criar usuário
  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpenNewDialog(false);
      createForm.reset();
      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Ocorreu um erro ao criar o usuário.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema> & { id: number }) => {
      const { id, ...userData } = data;
      // Remover senha se estiver vazia
      if (!userData.password) {
        delete userData.password;
      }
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpenEditDialog(false);
      editForm.reset();
      toast({
        title: "Usuário atualizado",
        description: "O usuário foi atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Ocorreu um erro ao atualizar o usuário.",
        variant: "destructive",
      });
    },
  });
  
  // Mutation para atualizar perfil médico
  const updateDoctorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof doctorSchema> & { id: number }) => {
      const { id, ...doctorData } = data;
      const res = await apiRequest("PATCH", `/api/admin/doctors/${id}`, doctorData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: [`/api/doctors/${currentDoctor?.userId}`] });
      setOpenDoctorDialog(false);
      setCurrentUser(null);
      setCurrentDoctor(null);
      toast({
        title: "Médico atualizado",
        description: "Os dados do médico foram atualizados com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar médico",
        description: error.message || "Ocorreu um erro ao atualizar o perfil médico.",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover usuário",
        description: error.message || "Ocorreu um erro ao remover o usuário.",
        variant: "destructive",
      });
    },
  });
  
  // Mutation para atualizar plano de assinatura
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, subscriptionPlan }: { userId: number, subscriptionPlan: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/subscription`, {
        subscriptionPlan,
        subscriptionStatus: "active"
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpenPlanDialog(false);
      setCurrentUser(null);
      toast({
        title: "Plano atualizado",
        description: "O plano de assinatura foi atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message || "Ocorreu um erro ao atualizar o plano de assinatura.",
        variant: "destructive",
      });
    },
  });
  
  // Mutation para conceder acesso premium gratuito
  const grantPremiumAccessMutation = useMutation({
    mutationFn: async ({ userId, plan, reason }: { userId: number, plan: string, reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/premium-access`, {
        plan,
        reason
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Falha ao conceder acesso");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpenPremiumAccessDialog(false);
      setPremiumAccessReason("");
      setSelectedPremiumPlan("basic");
      setCurrentUser(null);
      toast({
        title: "Acesso concedido",
        description: "Acesso premium concedido com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao conceder acesso",
        description: error.message || "Ocorreu um erro ao conceder acesso premium.",
        variant: "destructive",
      });
    },
  });

  // Função para abrir o diálogo de edição
  const handleEditUser = (user: UserWithDoctor) => {
    setCurrentUser(user);
    editForm.reset({
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone || "",
      address: user.address || "",
      emailVerified: user.emailVerified,
    });
    setOpenEditDialog(true);
  };
  
  // Função para abrir o diálogo de edição de médico
  const handleEditDoctor = async (user: UserWithDoctor) => {
    if (!user.doctor) {
      toast({
        title: "Erro",
        description: "Este usuário não possui um perfil médico.",
        variant: "destructive",
      });
      return;
    }

    setCurrentUser(user);
    setCurrentDoctor(user.doctor);
    doctorForm.reset({
      specialization: user.doctor.specialization,
      licenseNumber: user.doctor.licenseNumber,
      biography: user.doctor.biography || "",
      education: user.doctor.education || "",
      experienceYears: user.doctor.experienceYears || 0,
      consultationFee: user.doctor.consultationFee || 0,
      availableForEmergency: user.doctor.availableForEmergency,
      status: user.doctor.status,
    });
    setOpenDoctorDialog(true);
  };

  // Função para enviar o formulário de criação
  const onCreateSubmit = (data: z.infer<typeof userSchema>) => {
    createUserMutation.mutate(data);
  };

  // Função para enviar o formulário de edição
  const onEditSubmit = (data: UserFormData) => {
    if (!currentUser) return;
    updateUserMutation.mutate({ ...data, id: currentUser.id });
  };
  
  // Função para enviar o formulário de edição de médico
  const onDoctorEditSubmit = (data: z.infer<typeof doctorSchema>) => {
    if (!currentUser?.doctor) return;
    updateDoctorMutation.mutate({ ...data, id: currentUser.doctor.id });
  };

  // Função para deletar usuário
  const handleDeleteUser = (id: number) => {
    deleteUserMutation.mutate(id);
  };

  return (
    <AdminLayout title="Gerenciamento de Usuários">
      <div className="space-y-4 lg:space-y-6 max-w-full">
        <Card className="w-full">
          <CardHeader className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-3 sm:pb-2">
            <CardTitle className="text-lg sm:text-xl font-medium">Filtros e Busca</CardTitle>
            <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto sm:ml-auto" size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span>Novo Usuário</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Preencha os campos abaixo para criar um novo usuário no sistema.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome de Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="usuario123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome Completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Perfil</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um perfil" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="patient">Paciente</SelectItem>
                              <SelectItem value="doctor">Médico</SelectItem>
                              <SelectItem value="partner">Parceiro</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={createUserMutation.isPending}
                        className="w-full"
                      >
                        {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col space-y-3 sm:space-y-3 lg:space-y-0 lg:flex-row lg:gap-4">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <Input
                    className="pl-9 h-9 sm:h-10 text-sm sm:text-base"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 flex-shrink-0">
                <div className="w-full sm:w-40 lg:w-48">
                  <Select onValueChange={(value) => setFilterRole(value === "all" ? null : value)}>
                    <SelectTrigger className="w-full h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue placeholder="Filtrar perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Perfil</SelectLabel>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="patient">Pacientes</SelectItem>
                        <SelectItem value="doctor">Médicos</SelectItem>
                        <SelectItem value="partner">Parceiros</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40 lg:w-48">
                  <Select onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)} defaultValue="newest">
                    <SelectTrigger className="w-full h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue placeholder="Ordenar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Ordenação</SelectLabel>
                        <SelectItem value="newest">Mais recentes</SelectItem>
                        <SelectItem value="oldest">Mais antigos</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="px-3 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-xl">Lista de Usuários</CardTitle>
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full max-w-[250px]" />
                      <Skeleton className="h-4 w-full max-w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full overflow-auto">
                <div className="pr-4">
                  <ResponsiveTable>
                  <ResponsiveTableHeader>
                    <TableRow>
                      <ResponsiveTableHead className="min-w-[200px]">Nome</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[200px] hidden sm:table-cell">Email</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[120px] hidden lg:table-cell">Usuário</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[100px]">Perfil</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[100px] hidden sm:table-cell">Plano</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[120px] hidden md:table-cell">Status</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[150px] hidden xl:table-cell">Cadastro</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[100px] hidden lg:table-cell text-center">Verificado</ResponsiveTableHead>
                      <ResponsiveTableHead className="min-w-[80px] w-[80px] text-right">Ações</ResponsiveTableHead>
                    </TableRow>
                  </ResponsiveTableHeader>
                  <ResponsiveTableBody>
                    {filteredUsers?.length > 0 ? (
                      filteredUsers.map((user) => (
                        <ResponsiveTableRow key={user.id}>
                          <ResponsiveTableCell header="Nome" className="font-medium">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 text-xs sm:text-sm font-semibold flex-shrink-0">
                                {user.fullName?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-sm sm:text-base">{user.fullName}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate sm:hidden">{user.email}</p>
                              </div>
                            </div>
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Email" className="hidden sm:table-cell">
                            <span className="truncate block max-w-[200px]">{user.email}</span>
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Usuário" className="hidden lg:table-cell">
                            <span className="truncate block max-w-[120px]">{user.username}</span>
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Perfil">
                            <Badge className={`text-xs sm:text-sm whitespace-nowrap ${
                              user.role === 'patient' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                              user.role === 'doctor' ? 'bg-purple-100 text-purple-800 hover:bg-purple-100' :
                              user.role === 'partner' ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' :
                              'bg-blue-100 text-blue-800 hover:bg-blue-100'
                            }`}>
                              <span className="flex items-center gap-1">
                                {user.role === 'patient' ? <Users className="h-3 w-3" /> :
                                 user.role === 'doctor' ? <Stethoscope className="h-3 w-3" /> :
                                 user.role === 'partner' ? <Building2 className="h-3 w-3" /> : 
                                 <Shield className="h-3 w-3" />}
                                {user.role === 'patient' ? 'Paciente' :
                                 user.role === 'doctor' ? 'Médico' :
                                 user.role === 'partner' ? 'Parceiro' : 'Admin'}
                              </span>
                            </Badge>
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Plano" className="hidden sm:table-cell">
                            {user.role === 'patient' ? (
                              user.subscriptionPlan ? (
                                <Badge className={`text-xs sm:text-sm whitespace-nowrap ${
                                  user.subscriptionPlan === 'premium' || user.subscriptionPlan === 'premium_family' ? 'bg-yellow-500 hover:bg-yellow-600' : 
                                  user.subscriptionPlan === 'basic' || user.subscriptionPlan === 'basic_family' ? 'bg-blue-500 hover:bg-blue-600' : 
                                  user.subscriptionPlan === 'ultra' || user.subscriptionPlan === 'ultra_family' ? 'bg-purple-500 hover:bg-purple-600' :
                                  'bg-slate-500 hover:bg-slate-600'
                                }`}>
                                  {getPlanName(user.subscriptionPlan as any)}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs sm:text-sm whitespace-nowrap">Gratuito</Badge>
                              )
                            ) : (
                              <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                            )}
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Status" className="hidden md:table-cell">
                            {user.role === 'patient' ? (
                              <Badge 
                                variant={user.subscriptionStatus === 'active' ? 'default' : 'destructive'}
                                className="text-xs sm:text-sm whitespace-nowrap"
                              >
                                {user.subscriptionStatus === 'active' ? 'Ativo' : 
                                 user.subscriptionStatus === 'inactive' ? 'Inativo' : 
                                 user.subscriptionStatus === 'pending' ? 'Pendente' : 
                                 user.subscriptionStatus || 'N/A'}
                              </Badge>
                            ) : (
                              <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                            )}
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Cadastro" className="hidden xl:table-cell">
                            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(user.createdAt)}
                            </span>
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Verificado" className="hidden lg:table-cell">
                            <div className="flex justify-center">
                              {user.emailVerified ? (
                                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                              )}
                            </div>
                          </ResponsiveTableCell>
                          <ResponsiveTableCell header="Ações" className="text-right w-[80px]">
                            <div className="flex items-center justify-end gap-2 min-w-[80px]">
                              {/* Mobile quick actions */}
                              <div className="flex sm:hidden gap-1">
                                {user.role === 'patient' && user.subscriptionPlan && (
                                  <Badge className="text-xs" variant={user.subscriptionStatus === 'active' ? 'default' : 'outline'}>
                                    {getPlanName(user.subscriptionPlan as any)}
                                  </Badge>
                                )}
                                {user.emailVerified ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 relative z-10"
                                  >
                                    <Settings className="h-4 w-4" />
                                    <span className="sr-only">Ações</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 sm:w-56">
                                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Editar Usuário</span>
                                    </DropdownMenuItem>
                                    
                                    {/* Mostrar opções de assinatura apenas para pacientes */}
                                    {user.role === 'patient' && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => window.location.href = `/admin/users/dependents/${user.id}`}
                                        >
                                          <Users className="mr-2 h-4 w-4" />
                                          <span>Gerenciar Dependentes</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Assinatura</DropdownMenuLabel>
                                        
                                        {/* Gerenciar plano */}
                                        <DropdownMenuItem onClick={() => {
                                          setCurrentUser(user);
                                          setSelectedSubscriptionPlan(user.subscriptionPlan || 'free');
                                          setOpenPlanDialog(true);
                                        }}>
                                          <CreditCard className="mr-2 h-4 w-4" />
                                          <span className="text-sm">Alterar Plano</span>
                                        </DropdownMenuItem>
                                        
                                        {/* Conceder acesso premium */}
                                        <DropdownMenuItem onClick={() => {
                                          setCurrentUser(user);
                                          setOpenPremiumAccessDialog(true);
                                        }}>
                                          <Star className="mr-2 h-4 w-4" />
                                          <span className="text-sm">Conceder Plano</span>
                                        </DropdownMenuItem>
                                        
                                        {/* Cancelar assinatura */}
                                        {user.subscriptionStatus === 'active' && (
                                          <DropdownMenuItem onClick={() => {
                                            if (confirm(`Deseja realmente cancelar a assinatura de ${user.fullName}?`)) {
                                              updateSubscriptionMutation.mutate({ 
                                                userId: user.id, 
                                                subscriptionPlan: 'free' 
                                              });
                                            }
                                          }}>
                                            <X className="mr-2 h-4 w-4" />
                                            <span className="text-sm">Cancelar Assinatura</span>
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    )}
                                    
                                    {/* Ações específicas para médicos */}
                                    {user.role === 'doctor' && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleEditDoctor(user)}>
                                          <Stethoscope className="mr-2 h-4 w-4" />
                                          <span className="text-sm">Perfil Médico</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => window.open(`/admin/doctors/${user.id}/availability`, '_blank')}>
                                          <Calendar className="mr-2 h-4 w-4" />
                                          <span className="text-sm">Gerenciar Agenda</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onClick={() => {
                                        // Abrir diálogo de confirmação de exclusão
                                        document.getElementById(`delete-dialog-${user.id}`)?.click();
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span className="text-sm">Excluir Usuário</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              {/* Diálogo de confirmação para exclusão - mantido escondido */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    id={`delete-dialog-${user.id}`} 
                                    variant="ghost" 
                                    size="icon"
                                    className="hidden"
                                  >
                                    <span className="sr-only">Excluir</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o usuário "{user.fullName}"?
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="bg-red-500 hover:bg-red-600"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </ResponsiveTableCell>
                        </ResponsiveTableRow>
                      ))
                    ) : (
                      <ResponsiveTableRow>
                        <ResponsiveTableCell colSpan={9} className="h-24">
                          <div className="flex flex-col items-center justify-center py-8">
                            <AlertCircle className="h-8 w-8 mb-2 text-muted-foreground" />
                            <p className="text-sm sm:text-base text-muted-foreground text-center">
                              {searchQuery || filterRole ? 
                                'Nenhum usuário encontrado com os filtros selecionados.' : 
                                'Nenhum usuário cadastrado no sistema.'}
                            </p>
                          </div>
                        </ResponsiveTableCell>
                      </ResponsiveTableRow>
                    )}
                    </ResponsiveTableBody>
                  </ResponsiveTable>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Diálogo para gerenciar plano de assinatura */}
        <Dialog open={openPlanDialog} onOpenChange={setOpenPlanDialog}>
          <DialogContent className="w-[95vw] max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Gerenciar Plano de Assinatura</DialogTitle>
              <DialogDescription>
                Atualize o plano de assinatura do usuário {currentUser?.fullName}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subscription-plan">Plano de Assinatura</Label>
                <Select 
                  defaultValue={selectedSubscriptionPlan} 
                  onValueChange={setSelectedSubscriptionPlan}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="basic">Básico (R$ 89,90/mês)</SelectItem>
                    <SelectItem value="basic_family">Básico Família (R$ 149,90/mês)</SelectItem>
                    <SelectItem value="premium">Premium (R$ 129,90/mês)</SelectItem>
                    <SelectItem value="premium_family">Premium Família (R$ 199,90/mês)</SelectItem>
                    <SelectItem value="ultra">Ultra (R$ 169,90/mês)</SelectItem>
                    <SelectItem value="ultra_family">Ultra Família (R$ 239,90/mês)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setOpenPlanDialog(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (!currentUser) return;
                  updateSubscriptionMutation.mutate({
                    userId: currentUser.id,
                    subscriptionPlan: selectedSubscriptionPlan
                  });
                }}
                disabled={updateSubscriptionMutation.isPending}
              >
                {updateSubscriptionMutation.isPending ? "Atualizando..." : "Atualizar Plano"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Diálogo para conceder acesso premium gratuito */}
        <Dialog open={openPremiumAccessDialog} onOpenChange={setOpenPremiumAccessDialog}>
          <DialogContent className="w-[95vw] max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Conceder Acesso Premium Gratuito</DialogTitle>
              <DialogDescription>
                Conceda acesso premium gratuito para o usuário {currentUser?.fullName}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="premium-plan">Plano a Conceder</Label>
                <Select 
                  defaultValue={selectedPremiumPlan} 
                  onValueChange={setSelectedPremiumPlan}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Básico</SelectItem>
                    <SelectItem value="basic_family">Básico Família</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="premium_family">Premium Família</SelectItem>
                    <SelectItem value="ultra">Ultra</SelectItem>
                    <SelectItem value="ultra_family">Ultra Família</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-reason">Motivo da Gratuidade</Label>
                <Input
                  id="premium-reason"
                  placeholder="Informe o motivo da concessão gratuita"
                  value={premiumAccessReason}
                  onChange={(e) => setPremiumAccessReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setOpenPremiumAccessDialog(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (!currentUser || !premiumAccessReason) return;
                  grantPremiumAccessMutation.mutate({
                    userId: currentUser.id,
                    plan: selectedPremiumPlan,
                    reason: premiumAccessReason
                  });
                }}
                disabled={grantPremiumAccessMutation.isPending || !premiumAccessReason}
              >
                {grantPremiumAccessMutation.isPending ? "Concedendo..." : "Conceder Acesso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo para editar usuário */}
        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent className="w-[95vw] max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Edite os dados do usuário abaixo. Deixe a senha em branco para mantê-la inalterada.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="usuario123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome Completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha (deixe em branco para manter)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perfil</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um perfil" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="patient">Paciente</SelectItem>
                          <SelectItem value="doctor">Médico</SelectItem>
                          <SelectItem value="partner">Parceiro</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="emailVerified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between border p-3 rounded-md mt-4">
                      <div className="space-y-0.5">
                        <FormLabel>Verificação de Email</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          {field.value ? "Email verificado" : "Email não verificado"}
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={updateUserMutation.isPending}
                    className="w-full"
                  >
                    {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Diálogo para editar perfil médico */}
        <Dialog open={openDoctorDialog} onOpenChange={setOpenDoctorDialog}>
          <DialogContent className="w-[95vw] max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Editar Perfil Médico</DialogTitle>
              <DialogDescription>
                Edite as informações do médico {currentUser?.fullName || currentUser?.username}.
              </DialogDescription>
            </DialogHeader>

            <Form {...doctorForm}>
              <form onSubmit={doctorForm.handleSubmit(onDoctorEditSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={doctorForm.control}
                    name="specialization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Especialização</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Cardiologia" {...field} />
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
                        <FormLabel>CRM</FormLabel>
                        <FormControl>
                          <Input placeholder="Número do CRM" {...field} />
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
                      <FormLabel>Biografia</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Resumo sobre o médico" 
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={doctorForm.control}
                  name="education"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formação</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Formação e experiência acadêmica" 
                          className="min-h-[80px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={doctorForm.control}
                    name="experienceYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anos de Experiência</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={doctorForm.control}
                    name="consultationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Consulta (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={doctorForm.control}
                  name="availableForEmergency"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Disponível para Emergências</FormLabel>
                        <FormDescription>
                          Ativar disponibilidade para consultas de emergência
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={doctorForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="approved">Aprovado</SelectItem>
                          <SelectItem value="rejected">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenDoctorDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateDoctorMutation.isPending}>
                    {updateDoctorMutation.isPending ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;