import { QueryClient, QueryFunction, useQuery, useMutation } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    console.log(`Sending API request: ${method} ${url}`);
    
    // Verificar se existe um token de autenticação
    const authToken = localStorage.getItem("authToken");
    const sessionID = localStorage.getItem("sessionID");
    
    // Adicionar token nos headers se disponível
    const headers: Record<string, string> = {
      ...(data ? { "Content-Type": "application/json" } : {}),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };
    
    // Adicionar cookies diretamente ao header Cookie (abordagem alternativa)
    if (sessionID) {
      headers["X-Session-ID"] = sessionID;
      console.log(`Usando X-Session-ID: ${sessionID}`);
    }
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
      // Também enviar como um header dedicado para compatibilidade
      headers["X-Auth-Token"] = authToken;
      console.log(`API Request com token de autenticação: ${method} ${url}`);
    }
    
    // Recuperar usuário armazenado no localStorage como backup
    const userDataString = localStorage.getItem("userData");
    if (userDataString && !authToken) {
      try {
        const userData = JSON.parse(userDataString);
        if (userData && userData.id) {
          console.log("Usando dados de usuário armazenados localmente como referência");
          headers["X-User-ID"] = userData.id.toString();
        }
      } catch (e) {
        console.warn("Erro ao processar dados de usuário armazenados:", e);
      }
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Importante para enviar cookies
      mode: 'cors',
      cache: 'no-cache',
    });

    console.log(`API Request ${method} ${url} - Status: ${res.status}`);
    
    // Log the response headers for debugging
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    console.log(`Response headers:`, responseHeaders);
    
    // Se a requisição retornar 401 e temos um token, ele pode estar inválido
    if (res.status === 401 && authToken) {
      console.log(`Token de autenticação inválido para ${method} ${url}, removendo-o`);
      localStorage.removeItem("authToken");
    }
    
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API Request error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const endpoint = queryKey[0] as string;
      console.log(`Sending query request: GET ${endpoint}`);
      
      // Verificar se existe um token de autenticação
      const authToken = localStorage.getItem("authToken");
      const sessionID = localStorage.getItem("sessionID");
      
      // Adicionar o token de autenticação aos headers se disponível
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };
      
      // Adicionar ID da sessão para facilitar debugging
      if (sessionID) {
        headers["X-Session-ID"] = sessionID;
        console.log(`Usando X-Session-ID: ${sessionID}`);
      }
      
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      
      const res = await fetch(endpoint, {
        method: 'GET',
        credentials: "include",
        headers,
        mode: 'cors',
        cache: 'no-cache'
      });

      console.log(`Query ${endpoint} - Status: ${res.status}`);
      
      // Log response headers for debugging
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log(`Response headers for ${endpoint}:`, responseHeaders);
      
      if (res.status === 401) {
        // Se o token de autenticação está presente mas a requisição falhou com 401,
        // talvez o token seja inválido, então vamos removê-lo
        if (authToken) {
          console.log(`Token de autenticação inválido para ${endpoint}, removendo-o`);
          localStorage.removeItem("authToken");
        }
        
        if (unauthorizedBehavior === "returnNull") {
          console.log(`Query ${endpoint} - Unauthorized, returning null`);
          return null;
        } else {
          console.error(`Authentication required for ${endpoint}`);
          throw new Error("Authentication required");
        }
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Data received from ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Query error:`, error);
      throw error;
    }
  };

// Re-export hooks para uso em componentes
export { useQuery, useMutation };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
