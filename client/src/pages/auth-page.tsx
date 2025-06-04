import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/layouts/auth-layout";
import { useLocation } from "wouter";

// Login form schema
const loginSchema = z.object({
  email: z.string().email({ message: "Informe um e-mail válido" }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
});

// Importação das funções de validação de CPF e CNPJ
import { validateCPF, formatCPF, unformatCPF } from "@/lib/cpf-validator";
import { validateCNPJ, formatCNPJ, unformatCNPJ } from "@/lib/cnpj-validator";

// Registration form schema
const registerSchema = z.discriminatedUnion("role", [
  // Schema para pacientes (requer CPF)
  z.object({
    role: z.literal("patient"),
    email: z.string().email({ message: "Informe um e-mail válido" }),
    username: z.string().optional(),
    cpf: z.string().min(11, { message: "CPF inválido" }).max(14, { message: "CPF inválido" }),
    cnpj: z.string().optional(),
    password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
    fullName: z.string().min(3, { message: "O nome completo é obrigatório" }),
  }),
  // Schema para parceiros (requer CNPJ)
  z.object({
    role: z.literal("partner"),
    email: z.string().email({ message: "Informe um e-mail válido" }),
    username: z.string().optional(),
    cpf: z.string().optional(),
    cnpj: z.string().min(14, { message: "CNPJ inválido" }).max(18, { message: "CNPJ inválido" }),
    password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
    fullName: z.string().min(3, { message: "O nome da empresa é obrigatório" }),
  }),
  // Schema para médicos e admins (requer username)
  z.object({
    role: z.enum(["doctor", "admin"]),
    email: z.string().email({ message: "Informe um e-mail válido" }),
    username: z.string().min(3, { message: "O nome de usuário deve ter pelo menos 3 caracteres" }),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
    fullName: z.string().min(3, { message: "O nome completo é obrigatório" }),
  }),
]).superRefine((data, ctx) => {
  // Se for paciente, CPF é obrigatório e deve ser válido
  if (data.role === "patient") {
    if (!data.cpf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF é obrigatório para pacientes",
        path: ["cpf"]
      });
      return false;
    }
    
    const cleanCPF = unformatCPF(data.cpf);
    if (!validateCPF(cleanCPF)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF inválido. Verifique os dígitos informados",
        path: ["cpf"]
      });
      return false;
    }
  }
  
  // Se for parceiro, CNPJ é obrigatório e deve ser válido
  if (data.role === "partner") {
    if (!data.cnpj) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ é obrigatório para empresas",
        path: ["cnpj"]
      });
      return false;
    }
    
    const cleanCNPJ = unformatCNPJ(data.cnpj);
    if (!validateCNPJ(cleanCNPJ)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ inválido. Verifique os dígitos informados",
        path: ["cnpj"]
      });
      return false;
    }
  }
  
  // Se for médico, username é obrigatório
  if (data.role === "doctor" && !data.username) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Registro no CRM é obrigatório",
      path: ["username"]
    });
    return false;
  }
  
  // Se for admin, username é obrigatório
  if (data.role === "admin" && !data.username) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nome de usuário é obrigatório para administradores",
      path: ["username"]
    });
    return false;
  }
  
  return true;
});

// Types for the form values
type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

// Lista de estados brasileiros para o seletor de UF do CRM
const estadosBrasileiros = [
  { value: "AC", label: "AC" },
  { value: "AL", label: "AL" },
  { value: "AP", label: "AP" },
  { value: "AM", label: "AM" },
  { value: "BA", label: "BA" },
  { value: "CE", label: "CE" },
  { value: "DF", label: "DF" },
  { value: "ES", label: "ES" },
  { value: "GO", label: "GO" },
  { value: "MA", label: "MA" },
  { value: "MT", label: "MT" },
  { value: "MS", label: "MS" },
  { value: "MG", label: "MG" },
  { value: "PA", label: "PA" },
  { value: "PB", label: "PB" },
  { value: "PR", label: "PR" },
  { value: "PE", label: "PE" },
  { value: "PI", label: "PI" },
  { value: "RJ", label: "RJ" },
  { value: "RN", label: "RN" },
  { value: "RS", label: "RS" },
  { value: "RO", label: "RO" },
  { value: "RR", label: "RR" },
  { value: "SC", label: "SC" },
  { value: "SP", label: "SP" },
  { value: "SE", label: "SE" },
  { value: "TO", label: "TO" }
];

const AuthPage: React.FC = () => {
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [estadoSelecionado, setEstadoSelecionado] = useState("SP");
  const [, navigate] = useLocation();
  
  // Redirect if already authenticated with role-based routing
  useEffect(() => {
    if (user) {
      if (user.role === "doctor") {
        navigate("/doctor-telemedicine");
      } else if (user.role === "partner") {
        navigate("/partner/services"); // Caminho correto com a barra entre partner e services
      } else if (user.role === "admin") {
        navigate("/admin/users");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate]);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      cpf: "",
      cnpj: "",
      password: "",
      fullName: "",
      role: "patient",
    },
  });
  
  // Handle login form submission with role-based redirection
  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoggingIn(true);
    try {
      console.log("Attempting login with:", { email: data.email });
      
      // Make sure we're using the proper credentials format without role
      const loginData = {
        email: data.email,
        password: data.password
      };
      
      const user = await loginMutation.mutateAsync(loginData);
      console.log("Login successful, user data received:", user);
      
      // Store the session ID from the debug info in localStorage for debugging
      if (user && (user as any)._debug && (user as any)._debug.sessionID) {
        localStorage.setItem('sessionID', (user as any)._debug.sessionID);
        console.log("Session ID stored:", (user as any)._debug.sessionID);
      }
      
      // Short delay to ensure session is properly established
      setTimeout(() => {
        // Redirect based on user role
        if (user.role === "doctor") {
          navigate("/doctor-telemedicine");
        } else if (user.role === "partner") {
          navigate("/partner/services"); // Caminho corrigido com a barra entre partner e services
        } else if (user.role === "admin") {
          navigate("/admin/users");
        } else if (user.role === "patient") {
          // Verificar se o paciente precisa escolher um plano examinando os dados
          if (user.subscriptionStatus !== "active" || user.subscriptionPlan === "free") {
            navigate("/first-subscription");
          } else {
            navigate("/dashboard");
          }
        } else {
          navigate("/dashboard");
        }
      }, 500);
    } catch (error) {
      // Additional error logging
      console.error("Login error:", error);
      toast({
        title: "Erro no login",
        description: "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  // Handle register form submission with role-based redirection
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setIsRegistering(true);
    try {
      console.log("Attempting registration with:", { email: data.email, role: data.role });
      
      // Make sure we're using the proper registration format based on role
      let registerData;
      
      if (data.role === "patient") {
        // Para pacientes, enviamos o CPF e geramos um username baseado no CPF (sem pontuação)
        const cleanCPF = data.cpf ? unformatCPF(data.cpf) : "";
        registerData = {
          email: data.email,
          username: `p${cleanCPF}`, // Prefixo 'p' seguido do CPF sem formatação
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          cpf: data.cpf // Enviamos o CPF formatado também
        };
      } else if (data.role === "partner") {
        // Para parceiros/empresas, usamos o CNPJ como base para o username
        const cleanCNPJ = data.cnpj ? unformatCNPJ(data.cnpj) : "";
        registerData = {
          email: data.email,
          username: `e${cleanCNPJ}`, // Prefixo 'e' (empresa) seguido pelo CNPJ sem formatação
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          cnpj: data.cnpj // Enviamos o CNPJ formatado também
        };
      } else {
        // Para médicos e admins, usamos o username fornecido
        // Garantimos que username nunca seja undefined
        registerData = {
          email: data.email,
          username: data.username || `u_${Date.now()}`, // Fallback para evitar username undefined
          password: data.password,
          fullName: data.fullName,
          role: data.role
        };
      }
      
      const user = await registerMutation.mutateAsync(registerData);
      console.log("Registration successful, user data received:", user);
      
      // Store the session ID if available
      if (user && (user as any)._debug && (user as any)._debug.sessionID) {
        localStorage.setItem('sessionID', (user as any)._debug.sessionID);
        console.log("Session ID stored:", (user as any)._debug.sessionID);
      }
      
      // Show success message
      toast({
        title: "Cadastro realizado com sucesso",
        description: `Bem-vindo(a) ao CN Vidas, ${user.fullName}!`,
      });
      
      // Short delay to ensure session is properly established
      setTimeout(() => {
        // Redirect based on user role
        if (user.role === "doctor") {
          navigate("/doctor-telemedicine");
        } else if (user.role === "partner") {
          navigate("/partner/services"); // Caminho correto com a barra
        } else if (user.role === "admin") {
          navigate("/admin/users");
        } else if (user.role === "patient") {
          // Novos pacientes vão direto para a página de seleção obrigatória de plano
          navigate("/first-subscription");
        } else {
          navigate("/dashboard");
        }
      }, 500);
    } catch (error) {
      // Additional error logging
      console.error("Registration error:", error);
      toast({
        title: "Erro no cadastro",
        description: "Verifique seus dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };
  
  return (
    <AuthLayout>
      <Tabs defaultValue="register" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-gray-100/60 backdrop-blur-sm rounded-xl">
          <TabsTrigger value="login" className="rounded-lg py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Login
          </TabsTrigger>
          <TabsTrigger value="register" className="rounded-lg py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Cadastro
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <div className="p-6">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-gray-800">Bem-vindo de volta</h1>
              <p className="text-gray-500 mt-2 text-sm">
                Acesse sua conta para continuar
              </p>
            </div>
            
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">E-mail</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="seu@email.com" 
                          type="email" 
                          disabled={isLoggingIn}
                          className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel className="text-gray-700">Senha</FormLabel>
                        <a href="/esqueci-senha" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                          Esqueceu a senha?
                        </a>
                      </div>
                      <FormControl>
                        <Input 
                          placeholder="Sua senha" 
                          type="password"
                          disabled={isLoggingIn}
                          className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex items-center">
                  <input 
                    id="remember-me" 
                    name="remember-me" 
                    type="checkbox" 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Lembrar-me
                  </label>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 text-white font-medium shadow-md hover:shadow-lg"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Entrando...
                    </>
                  ) : "Entrar"}
                </Button>
                
                <p className="text-center text-xs text-gray-500 mt-4">
                  O sistema identificará automaticamente seu perfil com base no email cadastrado.
                </p>
              </form>
            </Form>
          </div>
        </TabsContent>
        
        <TabsContent value="register">
          <div className="p-6">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-gray-800">Crie sua conta</h1>
              <p className="text-gray-500 mt-2 text-sm">
                Preencha os dados para criar seu perfil na CN Vidas
              </p>
            </div>
            
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">E-mail</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="seu@email.com" 
                          type="email" 
                          disabled={isRegistering}
                          className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {registerForm.watch("role") === "patient" ? (
                    <FormField
                      control={registerForm.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">CPF</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="000.000.000-00" 
                              disabled={isRegistering}
                              className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              onChange={(e) => {
                                // Formata o CPF enquanto o usuário digita
                                let value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 11) {
                                  // Formata conforme o usuário digita
                                  if (value.length > 9) {
                                    value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
                                  } else if (value.length > 6) {
                                    value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
                                  } else if (value.length > 3) {
                                    value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
                                  }
                                  field.onChange(value);
                                }
                              }}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : registerForm.watch("role") === "doctor" ? (
                    <div className="space-y-2">
                      <FormLabel className="text-gray-700">Registro no CRM</FormLabel>
                      <div className="flex items-center space-x-2">
                        <div className="w-1/3">
                          <Select 
                            defaultValue={estadoSelecionado}
                            onValueChange={setEstadoSelecionado}
                          >
                            <SelectTrigger className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {estadosBrasileiros.map((estado) => (
                                <SelectItem key={estado.value} value={estado.value}>
                                  {estado.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-2/3">
                          <FormField
                            control={registerForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    placeholder="12345" 
                                    disabled={isRegistering}
                                    className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    {...field}
                                    value={field.value?.replace(/CRM[A-Z]{2}/i, '') || ''}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/\D/g, '');
                                      field.onChange(`CRM${estadoSelecionado}${value}`);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ) : registerForm.watch("role") === "partner" ? (
                    <FormField
                      control={registerForm.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">CNPJ da Empresa</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="00.000.000/0000-00" 
                              disabled={isRegistering}
                              className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              onChange={(e) => {
                                // Formatação do CNPJ
                                let value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 14) {
                                  // Formata conforme o usuário digita
                                  if (value.length > 12) {
                                    value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
                                  } else if (value.length > 8) {
                                    value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
                                  } else if (value.length > 5) {
                                    value = value.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
                                  } else if (value.length > 2) {
                                    value = value.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
                                  }
                                  field.onChange(value);
                                }
                              }}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Nome de usuário</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="seunome123" 
                              disabled={isRegistering}
                              className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">Senha</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Mínimo de 6 caracteres" 
                            type="password" 
                            disabled={isRegistering}
                            className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={registerForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">Nome completo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Seu Nome Completo" 
                          disabled={isRegistering}
                          className="rounded-xl h-12 backdrop-blur-sm bg-white/80 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={registerForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">Tipo de perfil</FormLabel>
                      <div className="grid grid-cols-3 gap-3 mb-2">
                        <div 
                          className={`flex flex-col items-center p-4 border ${
                            field.value === "patient" 
                              ? "border-blue-500 bg-blue-50 text-blue-700" 
                              : "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                          } rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow`}
                          onClick={() => field.onChange("patient")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-sm font-medium">Paciente</span>
                        </div>
                        
                        <div 
                          className={`flex flex-col items-center p-4 border ${
                            field.value === "doctor" 
                              ? "border-blue-500 bg-blue-50 text-blue-700" 
                              : "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                          } rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow`}
                          onClick={() => field.onChange("doctor")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                          <span className="text-sm font-medium">Médico</span>
                        </div>
                        
                        <div 
                          className={`flex flex-col items-center p-4 border ${
                            field.value === "partner" 
                              ? "border-blue-500 bg-blue-50 text-blue-700" 
                              : "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                          } rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow`}
                          onClick={() => field.onChange("partner")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-sm font-medium">Empresa</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 text-white font-medium shadow-md hover:shadow-lg mt-4"
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Cadastrando...
                    </>
                  ) : "Criar conta"}
                </Button>
                
                <p className="text-center text-xs text-gray-500 mt-2">
                  Ao criar uma conta, você concorda com nossos <a href="#" className="text-blue-600 hover:underline">Termos de Serviço</a> e <a href="#" className="text-blue-600 hover:underline">Política de Privacidade</a>.
                </p>
              </form>
            </Form>
          </div>
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
};

export default AuthPage;