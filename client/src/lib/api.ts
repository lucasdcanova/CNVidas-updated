import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Claim } from "@/shared/types";

export interface ClaimsResponse {
  data: Claim[];
  error?: {
    response?: {
      data?: {
        requiresUpgrade?: boolean;
      };
    };
  };
}

// User API
export const getUserProfile = async () => {
  const res = await apiRequest("GET", "/api/users/profile");
  return await res.json();
};

export const updateUserProfile = async (data: any) => {
  console.log("Enviando atualização de perfil:", data);
  try {
    const res = await apiRequest("PUT", "/api/users/profile", data);
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Erro na resposta da API:", errorText);
      throw new Error(errorText || "Erro ao atualizar o perfil do usuário");
    }
    
    // Invalidar consultas para forçar o recarregamento dos dados atualizados
    queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    
    console.log("Perfil atualizado com sucesso, recarregando dados");
    return await res.json();
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    throw error;
  }
};

export const getUsersByRole = async (role: string) => {
  const res = await apiRequest("GET", `/api/users?role=${role}`);
  return await res.json();
};

// Partners API
export const getAllPartners = async () => {
  const res = await apiRequest("GET", "/api/partners");
  return await res.json();
};

export const getPartner = async (id: number) => {
  const res = await apiRequest("GET", `/api/partners/${id}`);
  return await res.json();
};

export const createPartner = async (data: any) => {
  const res = await apiRequest("POST", "/api/partners", data);
  queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
  return await res.json();
};

export const updatePartner = async (id: number, data: any) => {
  const res = await apiRequest("PUT", `/api/partners/${id}`, data);
  queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
  queryClient.invalidateQueries({ queryKey: [`/api/partners/${id}`] });
  queryClient.invalidateQueries({ queryKey: ["/api/partners/me"] });
  return await res.json();
};

export const getPartnerByUserId = async (userId: number) => {
  const res = await apiRequest("GET", `/api/partners/user/${userId}`);
  return await res.json();
};

export const getCurrentPartner = async () => {
  const res = await apiRequest("GET", "/api/partners/me");
  return await res.json();
};

// Doctors API
export const getAllDoctors = async () => {
  const res = await apiRequest("GET", "/api/doctors");
  return await res.json();
};

export const getDoctor = async (id: number) => {
  const res = await apiRequest("GET", `/api/doctors/${id}`);
  return await res.json();
};

export const getDoctorByUserId = async (userId: number) => {
  const res = await apiRequest("GET", `/api/doctors/user/${userId}`);
  return await res.json();
};

export const updateDoctor = async (id: number, data: any) => {
  const res = await apiRequest("PUT", `/api/doctors/profile`, data);
  
  // Invalidar todas as consultas relacionadas ao perfil do médico
  queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
  queryClient.invalidateQueries({ queryKey: [`/api/doctors/${id}`] });
  queryClient.invalidateQueries({ queryKey: ["/api/doctors/profile"] });
  
  // Importante: também invalidar a consulta específica do médico pelo userId
  // Esta é a consulta usada na página de perfil
  if (data.userId) {
    queryClient.invalidateQueries({ queryKey: ["/api/doctors/user", data.userId] });
  }
  
  return await res.json();
};

// Services API
export const getServices = async (partnerId?: number) => {
  const url = partnerId ? `/api/services?partnerId=${partnerId}` : "/api/services";
  const res = await apiRequest("GET", url);
  return await res.json();
};

export const getService = async (id: number) => {
  const res = await apiRequest("GET", `/api/services/${id}`);
  return await res.json();
};

export const createService = async (data: any) => {
  const res = await apiRequest("POST", "/api/services", data);
  queryClient.invalidateQueries({ queryKey: ["/api/services"] });
  return await res.json();
};

export const updateService = async (id: number, data: any) => {
  const res = await apiRequest("PUT", `/api/services/${id}`, data);
  queryClient.invalidateQueries({ queryKey: ["/api/services"] });
  queryClient.invalidateQueries({ queryKey: [`/api/services/${id}`] });
  return await res.json();
};

export const deleteService = async (id: number) => {
  await apiRequest("DELETE", `/api/partner-services/${id}`);
  queryClient.invalidateQueries({ queryKey: ["/api/services"] });
};

export const getPartnerServicesByPartnerId = async (partnerId: number) => {
  const res = await apiRequest("GET", `/api/services/partner/${partnerId}`);
  return await res.json();
};

// Appointments API
export const getAppointments = async () => {
  const res = await apiRequest("GET", "/api/appointments");
  return await res.json();
};

export const getUpcomingAppointments = async () => {
  const res = await apiRequest("GET", "/api/appointments/upcoming");
  return await res.json();
};

export const createAppointment = async (data: any) => {
  const res = await apiRequest("POST", "/api/appointments", data);
  queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
  queryClient.invalidateQueries({ queryKey: ["/api/appointments/upcoming"] });
  return await res.json();
};

export const updateAppointment = async (id: number, data: any) => {
  const res = await apiRequest("PUT", `/api/appointments/${id}`, data);
  queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
  queryClient.invalidateQueries({ queryKey: ["/api/appointments/upcoming"] });
  return await res.json();
};

// Claims API
export const getClaims = async (): Promise<ClaimsResponse> => {
  const res = await apiRequest("GET", "/api/claims");
  return await res.json();
};

export const getAllClaims = async () => {
  const res = await apiRequest("GET", "/api/admin/claims");
  return await res.json();
};

export const getPendingClaims = async () => {
  const res = await apiRequest("GET", "/api/admin/pending-claims");
  return await res.json();
};

export const createClaim = async (formData: FormData) => {
  const res = await fetch("/api/claims", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
  
  queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
  return await res.json();
};

export const updateClaim = async (id: number, data: any) => {
  const res = await apiRequest("PATCH", `/api/admin/claims/${id}`, data);
  queryClient.invalidateQueries({ queryKey: ["/api/admin/claims"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-claims"] });
  return await res.json();
};

// Notifications API
export const getNotifications = async () => {
  const res = await apiRequest("GET", "/api/notifications");
  return await res.json();
};

export const getUnreadNotificationsCount = async () => {
  const res = await apiRequest("GET", "/api/notifications/unread-count");
  return await res.json();
};

export const markNotificationAsRead = async (id: number) => {
  const res = await apiRequest("PUT", `/api/notifications/${id}/read`);
  queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  return await res.json();
};

export const markAllNotificationsAsRead = async () => {
  const res = await apiRequest("PUT", "/api/notifications/read-all");
  queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  return await res.json();
};

// Telemedicine API
export const integrateTelemedAppointment = async (appointmentId: number, provider: string) => {
  const res = await apiRequest("POST", "/api/telemedicine/integrate", { appointmentId, provider });
  queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
  return await res.json();
};

// QR Code API
export const generateQrToken = async () => {
  const res = await apiRequest("POST", "/api/users/generate-qr");
  return await res.json();
};

export const verifyQrToken = async (token: string) => {
  const res = await apiRequest("POST", "/api/users/verify-qr", { token });
  return await res.json();
};

// Admin API functions
export const createAdminPartner = async (data: any) => {
  const res = await apiRequest("POST", "/api/admin/partners", data);
  queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
  return await res.json();
};

// Admin Services
export const getAdminServices = async () => {
  const res = await apiRequest("GET", "/api/admin/services");
  return await res.json();
};

export const getAdminPartners = async () => {
  const res = await apiRequest("GET", "/api/admin/partners");
  return await res.json();
};

export const createAdminService = async (partnerId: number, data: any) => {
  const res = await apiRequest("POST", `/api/admin/partners/${partnerId}/services`, data);
  queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
  return await res.json();
};

export const updateAdminService = async (id: number, data: any) => {
  const res = await apiRequest("PATCH", `/api/admin/services/${id}`, data);
  queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
  return await res.json();
};

export const deleteAdminService = async (id: number) => {
  const res = await apiRequest("DELETE", `/api/admin/services/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro ao excluir serviço: ${res.status}`);
  }
  queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
};

export const toggleFeatureService = async (id: number, isFeatured: boolean) => {
  const res = await apiRequest("PATCH", `/api/admin/services/${id}/feature`, { isFeatured });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
  return await res.json();
};

// Subscription API
export const getSubscriptionPlans = async () => {
  const res = await apiRequest("GET", "/api/subscription/plans");
  return await res.json();
};

export const getUserSubscription = async () => {
  const res = await apiRequest("GET", "/api/subscription/current");
  const data = await res.json();
  // Se a resposta tem estrutura aninhada, extrair o objeto subscription
  return data.subscription || data;
};

export const createSubscription = async (planId: number) => {
  const res = await apiRequest("POST", "/api/subscription/create", { planId });
  queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
  return await res.json();
};

export const cancelSubscription = async () => {
  const res = await apiRequest("POST", "/api/subscription/cancel");
  queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
  return await res.json();
};

export const updateSubscription = async (planId: number) => {
  const res = await apiRequest("PUT", "/api/subscription", { planId });
  queryClient.invalidateQueries({ queryKey: ["/api/subscription/current"] });
  return await res.json();
};

// Interface para consultas
interface Consultation {
  id: number;
  patientName: string;
  doctorName: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  date: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  doctorId: number;
  type: string;
  notes?: string;
  prescription?: string;
  diagnosis?: string;
}

// Busca todas as consultas de um parceiro
export const getAllConsultations = async (partnerId: number): Promise<Consultation[]> => {
  const response = await fetch(`/api/consultations/partner/${partnerId}`);
  if (!response.ok) {
    throw new Error('Erro ao buscar consultas');
  }
  return response.json();
};
