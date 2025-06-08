import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, LoginCredentials, RegisterCredentials } from "@/shared/types";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<Response, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterCredentials>;
  forgotPasswordMutation: UseMutationResult<Response, Error, { email: string }>;
  resetPasswordMutation: UseMutationResult<Response, Error, { token: string; password: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Função para verificar a autenticação do usuário
  const checkAuth = async (): Promise<User | null> => {
    try {
      console.log("Verificando autenticação do usuário...");
      
      // Verificar cookies disponíveis - deve mostrar o cookie da sessão
      console.log("Cookies disponíveis ANTES da requisição:", document.cookie);
      
      // Obter token de autenticação do localStorage se disponível
      const authToken = localStorage.getItem("authToken");
      
      // Criar headers com token de autenticação se disponível
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };
      
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
        headers["X-Auth-Token"] = authToken;
        console.log("Usando token de autenticação:", authToken);
      }
      
      // Adicionar ID da sessão para facilitar debugging
      const sessionID = localStorage.getItem("sessionID");
      if (sessionID) {
        headers["X-Session-ID"] = sessionID;
      }
      
      // Adicionar ID de usuário como backup se disponível
      const userDataString = localStorage.getItem("userData");
      if (userDataString && !authToken) {
        try {
          const userData = JSON.parse(userDataString);
          if (userData && userData.id) {
            headers["X-User-ID"] = userData.id.toString();
          }
        } catch (e) {
          console.warn("Erro ao processar dados de usuário do localStorage");
        }
      }
      
      // Fazer a requisição com todas as configurações necessárias
      const res = await fetch("/api/user", {
        method: 'GET',
        credentials: "include", // Importante: inclui cookies na requisição
        headers,
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!res.ok) {
        console.error("Erro na verificação de autenticação:", res.status, res.statusText);
        return null;
      }
      
      const userData = await res.json();
      console.log("Usuário autenticado:", userData);
      return userData;
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error);
      return null;
    }
  };

  // Query para verificar autenticação
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/user"],
    queryFn: checkAuth,
    retry: 1,
  });

  // Mutation para login
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      console.log("Tentando login com credenciais:", { email: credentials.email });
      
      const response = await apiRequest("POST", "/api/login", credentials);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Falha no login");
      }
      
      const responseData = await response.json();
      
      // Armazenar token de autenticação se disponível
      if (responseData.authToken) {
        console.log("Token de autenticação recebido:", responseData.authToken);
        localStorage.setItem("authToken", responseData.authToken);
      }
      
      // Armazenar ID da sessão se disponível
      if (responseData.sessionId) {
        console.log("ID da sessão recebido:", responseData.sessionId);
        localStorage.setItem("sessionID", responseData.sessionId);
      }
      
      // Armazenar dados do usuário localmente para autenticação alternativa em chamadas de emergência
      try {
        localStorage.setItem("userData", JSON.stringify({
          id: responseData.id,
          email: responseData.email,
          role: responseData.role,
          username: responseData.username,
          fullName: responseData.fullName
        }));
        console.log("Dados do usuário armazenados para autenticação alternativa");
      } catch (e) {
        console.warn("Erro ao armazenar dados do usuário:", e);
      }
      
      return responseData;
    },
    onSuccess: (userData: User & { sessionId?: string, authToken?: string }) => {
      console.log("Login bem-sucedido:", userData);
      
      // Salvar os dados do usuário na cache
      queryClient.setQueryData(["/api/user"], userData);
      
      // Redirecionar com base no papel do usuário
      if (userData.role === "admin") {
        console.log("Usuário é administrador, redirecionando para /admin/users");
        window.location.href = "/admin/users";
      } else if (userData.role === "doctor") {
        console.log("Usuário é médico, redirecionando para /doctor-telemedicine");
        window.location.href = "/doctor-telemedicine";
      } else if (userData.role === "partner") {
        console.log("Usuário é parceiro, redirecionando para /partner/dashboard");
        window.location.href = "/partner/dashboard";
      } else {
        // Pacientes e outros usuários vão para a página principal
        console.log("Usuário é paciente, redirecionando para /dashboard");
        window.location.href = "/dashboard";
      }
      
      // Forçar uma verificação de autenticação
      setTimeout(() => refetch(), 300);
    },
    onError: (error: Error) => {
      console.error("Erro no login:", error);
      toast({
        title: "Erro no login",
        description: error.message || "Não foi possível fazer login. Verifique suas credenciais.",
        variant: "destructive",
      });
    },
  });

  // Mutation para logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      
      // Limpar dados locais
      localStorage.removeItem("authToken");
      localStorage.removeItem("sessionID");
      localStorage.removeItem("userData");
      
      // Limpar cache
      queryClient.clear();
      
      return response;
    },
    onSuccess: () => {
      console.log("Logout bem-sucedido");
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      console.error("Erro no logout:", error);
      toast({
        title: "Erro ao sair",
        description: "Não foi possível efetuar o logout. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para registro
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      console.log("Tentando registrar com dados:", { email: credentials.email });
      
      const response = await apiRequest("POST", "/api/register", credentials);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Falha no registro");
      }
      
      const userData = await response.json();
      
      // Armazenar o token de autenticação se disponível
      if (userData.authToken) {
        console.log("Token de autenticação recebido no registro:", userData.authToken);
        localStorage.setItem("authToken", userData.authToken);
      }
      
      // Armazenar dados do usuário localmente para autenticação alternativa
      try {
        localStorage.setItem("userData", JSON.stringify({
          id: userData.id,
          email: userData.email,
          role: userData.role,
          username: userData.username,
          fullName: userData.fullName
        }));
        console.log("Dados do usuário armazenados após registro");
      } catch (e) {
        console.warn("Erro ao armazenar dados do usuário:", e);
      }
      
      // Save user data to cache
      queryClient.setQueryData(["/api/user"], userData);
      
      return userData;
    },
    onSuccess: (userData: User & { sessionId?: string, authToken?: string }) => {
      console.log("Registro bem-sucedido:", userData);
      
      // Salvar os dados do usuário na cache (login automático)
      queryClient.setQueryData(["/api/user"], userData);
      
      toast({
        title: "Conta criada com sucesso",
        description: `Bem-vindo(a) ao CN Vidas, ${userData.fullName}!`,
      });
      
      // Redirecionar com base no papel do usuário (login automático)
      if (userData.role === "admin") {
        console.log("Usuário é administrador, redirecionando para /admin/users");
        window.location.href = "/admin/users";
      } else if (userData.role === "doctor") {
        console.log("Usuário é médico, redirecionando para /doctor-telemedicine");
        window.location.href = "/doctor-telemedicine";
      } else if (userData.role === "partner") {
        console.log("Usuário é parceiro, redirecionando para /partner/dashboard");
        window.location.href = "/partner/dashboard";
      } else if (userData.role === "patient") {
        // Novos pacientes vão direto para a página de seleção obrigatória de plano
        console.log("Usuário é paciente, redirecionando para /first-subscription");
        window.location.href = "/first-subscription";
      } else {
        console.log("Usuário registrado, redirecionando para /dashboard");
        window.location.href = "/dashboard";
      }
      
      // Forçar uma verificação de autenticação
      setTimeout(() => refetch(), 300);
    },
    onError: (error: Error) => {
      console.error("Erro no registro:", error);
      toast({
        title: "Erro no registro",
        description: error.message || "Não foi possível criar sua conta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para recuperação de senha
  const forgotPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      return await apiRequest("POST", "/api/forgot-password", { email });
    },
    onSuccess: () => {
      toast({
        title: "E-mail enviado",
        description: "Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar e-mail",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para redefinição de senha
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      return await apiRequest("POST", "/api/reset-password", { token, password });
    },
    onSuccess: () => {
      toast({
        title: "Senha redefinida com sucesso",
        description: "Você já pode fazer login com sua nova senha.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        forgotPasswordMutation,
        resetPasswordMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
