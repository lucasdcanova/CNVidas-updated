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
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    
    if (sortOrder === 'newest') {
      return dateB - dateA; // Mais recente primeiro
    } else {
      return dateA - dateB; // Mais antigo primeiro
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
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 pb-3 lg:pb-2">
          <CardTitle className="text-base lg:text-lg font-medium">Filtros e Busca</CardTitle>
          <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
            <DialogTrigger asChild>
              <Button className="w-full lg:w-auto lg:ml-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="lg:inline">Novo Usuário</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
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
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:gap-4">
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome, email ou usuário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="lg:w-64">
              <Select onValueChange={(value) => setFilterRole(value === "all" ? null : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Perfil</SelectLabel>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="patient">Pacientes</SelectItem>
                    <SelectItem value="doctor">Médicos</SelectItem>
                    <SelectItem value="partner">Parceiros</SelectItem>
                    <SelectItem value="admin">Administradores</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-64">
              <Select onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)} defaultValue="newest">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ordenar por data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Ordenação</SelectLabel>
                    <SelectItem value="newest">Mais recente primeiro</SelectItem>
                    <SelectItem value="oldest">Mais antigo primeiro</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <ResponsiveTable>
                <ResponsiveTableHeader>
                  <TableRow>
                    <ResponsiveTableHead>Nome</ResponsiveTableHead>
                    <ResponsiveTableHead>Email</ResponsiveTableHead>
                    <ResponsiveTableHead>Usuário</ResponsiveTableHead>
                    <ResponsiveTableHead>Perfil</ResponsiveTableHead>
                    <ResponsiveTableHead>Plano</ResponsiveTableHead>
                    <ResponsiveTableHead>Status Assinatura</ResponsiveTableHead>
                    <ResponsiveTableHead>Data de Cadastro</ResponsiveTableHead>
                    <ResponsiveTableHead>Verificado</ResponsiveTableHead>
                    <ResponsiveTableHead className="text-right">Ações</ResponsiveTableHead>
                  </TableRow>
                </ResponsiveTableHeader>
                <ResponsiveTableBody>
                  {filteredUsers?.length > 0 ? (
                    filteredUsers.map((user) => (
                      <ResponsiveTableRow key={user.id}>
                        <ResponsiveTableCell header="Nome" className="font-medium">{user.fullName}</ResponsiveTableCell>
                        <ResponsiveTableCell header="Email">{user.email}</ResponsiveTableCell>
                        <ResponsiveTableCell header="Usuário">{user.username}</ResponsiveTableCell>
                        <ResponsiveTableCell header="Perfil">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'patient' ? 'bg-green-100 text-green-800' :
                            user.role === 'doctor' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'partner' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role === 'patient' ? 'Paciente' :
                             user.role === 'doctor' ? 'Médico' :
                             user.role === 'partner' ? 'Parceiro' : 'Admin'}
                          </span>
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Plano">
                          {user.role === 'patient' ? (
                            user.subscriptionPlan ? (
                              <Badge className={`
                                ${user.subscriptionPlan === 'premium' ? 'bg-yellow-500 hover:bg-yellow-600' : 
                                  user.subscriptionPlan === 'basic' ? 'bg-blue-500 hover:bg-blue-600' : 
                                  'bg-slate-500 hover:bg-slate-600'
                                }
                              `}>
                                {user.subscriptionPlan.charAt(0).toUpperCase() + user.subscriptionPlan.slice(1)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Gratuito</Badge>
                            )
                          ) : (
                            <Badge variant="outline">N/A</Badge>
                          )}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Status">
                          {user.role === 'patient' ? (
                            <Badge variant={user.subscriptionStatus === 'active' ? 'default' : 'destructive'}>
                              {user.subscriptionStatus === 'active' ? 'Ativo' : 
                               user.subscriptionStatus === 'inactive' ? 'Inativo' : 
                               user.subscriptionStatus === 'pending' ? 'Pendente' : 
                               user.subscriptionStatus || 'N/A'}
                            </Badge>
                          ) : (
                            <Badge variant="outline">N/A</Badge>
                          )}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Data de Cadastro">
                          <span className="text-sm text-gray-600">
                            {new Date(user.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Verificado">
                          {user.emailVerified ? (
                            <Check size={18} className="text-green-500" />
                          ) : (
                            <X size={18} className="text-red-500" />
                          )}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Ações" className="text-right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Settings size={16} />
                                  <span className="sr-only">Ações</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
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
                                        <span>Alterar Plano</span>
                                      </DropdownMenuItem>
                                      
                                      {/* Conceder acesso premium */}
                                      <DropdownMenuItem onClick={() => {
                                        setCurrentUser(user);
                                        setOpenPremiumAccessDialog(true);
                                      }}>
                                        <Star className="mr-2 h-4 w-4" />
                                        <span>Conceder Plano Gratuito</span>
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
                                          <span>Cancelar Assinatura</span>
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
                                        <span>Editar Perfil Médico</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => window.open(`/admin/doctors/${user.id}/availability`, '_blank')}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        <span>Gerenciar Agenda</span>
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
                                    <span>Excluir Usuário</span>
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
                      <ResponsiveTableCell header="" className="text-center py-6 text-gray-500" style={{ gridColumn: '1 / -1' }}>
                        {searchQuery || filterRole ? (
                          <div className="flex flex-col items-center">
                            <AlertCircle className="h-8 w-8 mb-2" />
                            <p>Nenhum usuário encontrado com os filtros selecionados.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <AlertCircle className="h-8 w-8 mb-2" />
                            <p>Nenhum usuário cadastrado no sistema.</p>
                          </div>
                        )}
                      </ResponsiveTableCell>
                    </ResponsiveTableRow>
                  )}
                </ResponsiveTableBody>
              </ResponsiveTable>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Diálogo para gerenciar plano de assinatura */}
      <Dialog open={openPlanDialog} onOpenChange={setOpenPlanDialog}>
        <DialogContent className="sm:max-w-[425px]">
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
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic (R$ 89,90/mês)</SelectItem>
                  <SelectItem value="basic_family">Basic Family (R$ 149,90/mês)</SelectItem>
                  <SelectItem value="premium">Premium (R$ 129,90/mês)</SelectItem>
                  <SelectItem value="premium_family">Premium Family (R$ 199,90/mês)</SelectItem>
                  <SelectItem value="ultra">Ultra (R$ 169,90/mês)</SelectItem>
                  <SelectItem value="ultra_family">Ultra Family (R$ 239,90/mês)</SelectItem>
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
        <DialogContent className="sm:max-w-[425px]">
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
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="basic_family">Basic Family</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="premium_family">Premium Family</SelectItem>
                  <SelectItem value="ultra">Ultra</SelectItem>
                  <SelectItem value="ultra_family">Ultra Family</SelectItem>
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
        <DialogContent className="sm:max-w-[425px]">
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
        <DialogContent className="sm:max-w-[550px]">
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
    </AdminLayout>
  );
};

export default AdminUsersPage;