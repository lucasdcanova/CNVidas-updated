import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName?: string;
  description: string;
  price: number;
  features: string[];
  planType: "free" | "basic" | "premium" | "basic_family" | "premium_family" | "ultra" | "ultra_family";
  isFamily?: boolean;
  maxDependents?: number;
  insuranceCoverageAmount?: number;
  specialistDiscount?: number;
}

interface UserSubscription {
  id: number;
  userId: number;
  planId: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan?: SubscriptionPlan;
}

export function useSubscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar planos disponíveis
  const { data: plans, isLoading: isLoadingPlans } = useQuery<SubscriptionPlan[], Error>({
    queryKey: ['/api/subscription/plans'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subscription/plans');
      return await res.json();
    },
  });

  // Buscar assinatura atual
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<UserSubscription, Error>({
    queryKey: ['/api/subscription/current'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subscription/current');
      return await res.json();
    },
  });

  // Criar nova assinatura
  const createSubscriptionMutation = useMutation<any, Error, number>({
    mutationFn: async (planId: number) => {
      const res = await apiRequest('POST', '/api/subscription/create', { planId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      toast({
        title: "Assinatura criada",
        description: "Sua assinatura foi criada com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar assinatura",
        description: error.message || "Ocorreu um erro ao criar sua assinatura.",
        variant: "destructive",
      });
    },
  });

  // Atualizar assinatura
  const updateSubscriptionMutation = useMutation<any, Error, number>({
    mutationFn: async (planId: number) => {
      const res = await apiRequest('PUT', '/api/subscription', { planId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      toast({
        title: "Assinatura atualizada",
        description: "Sua assinatura foi atualizada com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar assinatura",
        description: error.message || "Ocorreu um erro ao atualizar sua assinatura.",
        variant: "destructive",
      });
    },
  });

  // Cancelar assinatura
  const cancelSubscriptionMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/subscription/cancel');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura será cancelada ao final do período atual.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar assinatura",
        description: error.message || "Ocorreu um erro ao cancelar sua assinatura.",
        variant: "destructive",
      });
    },
  });

  return {
    plans,
    subscription,
    isLoading: isLoadingPlans || isLoadingSubscription,
    createSubscription: createSubscriptionMutation.mutate,
    updateSubscription: updateSubscriptionMutation.mutate,
    cancelSubscription: cancelSubscriptionMutation.mutate,
    isCreating: createSubscriptionMutation.isPending,
    isUpdating: updateSubscriptionMutation.isPending,
    isCancelling: cancelSubscriptionMutation.isPending,
  };
} 