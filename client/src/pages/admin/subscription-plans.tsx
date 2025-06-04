import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  CreditCard, 
  Edit, 
  Trash2, 
  Star, 
  AlertCircle, 
  Check, 
  X, 
  Clock,
  Users,
  Shield
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

// Schema para edição de planos
const planSchema = z.object({
  id: z.number(),
  price: z.number().min(0, { message: "Preço não pode ser negativo" }),
});

const AdminSubscriptionPlansPage: React.FC = () => {
  const { toast } = useToast();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<any>(null);

  // Buscar lista de planos
  const { data: plans = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/subscription-plans"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/admin/subscription-plans");
        console.log("Response da API (planos):", res);
        if (res.status !== 200) {
          console.error("Erro ao buscar planos. Status:", res.status);
          return [];
        }
        const data = await res.json();
        console.log("Dados dos planos obtidos:", data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Erro ao buscar planos:", error);
        return [];
      }
    },
  });

  // Estatísticas de planos
  const { data: planStats = {}, isLoading: isStatsLoading } = useQuery({
    queryKey: ["/api/admin/subscription-stats"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/admin/subscription-stats");
        console.log("Response da API (estatísticas):", res);
        if (res.status !== 200) {
          console.error("Erro ao buscar estatísticas. Status:", res.status);
          return { premiumCount: 0, basicCount: 0 };
        }
        const data = await res.json();
        console.log("Dados das estatísticas obtidos:", data);
        return data || { premiumCount: 0, basicCount: 0 };
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
        return { premiumCount: 0, basicCount: 0 };
      }
    },
  });

  // Form para editar plano
  const editForm = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      id: 0,
      price: 0,
    },
  });

  // Mutation para atualizar plano
  const updatePlanMutation = useMutation({
    mutationFn: async (data: z.infer<typeof planSchema>) => {
      const { id, price } = data;
      const res = await apiRequest("PATCH", `/api/admin/subscription-plans/${id}`, { price });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      setOpenEditDialog(false);
      setCurrentPlan(null);
      toast({
        title: "Plano atualizado",
        description: "O valor do plano foi atualizado com sucesso!",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message || "Ocorreu um erro ao atualizar o plano.",
        variant: "destructive",
      });
    },
  });

  // Função para abrir o diálogo de edição
  const handleEditPlan = (plan: any) => {
    setCurrentPlan(plan);
    editForm.reset({
      id: plan.id,
      price: plan.price,
    });
    setOpenEditDialog(true);
  };

  // Função para enviar o formulário de edição
  const onEditSubmit = (data: z.infer<typeof planSchema>) => {
    if (!currentPlan) return;
    updatePlanMutation.mutate(data);
  };

  // Função para formatar o preço em reais
  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price / 100);
  };

  return (
    <AdminLayout title="Gerenciamento de Planos de Assinatura">
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Planos configurados no sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assinantes Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? "..." : planStats.premiumCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Usuários com assinatura Premium
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assinantes Basic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? "..." : planStats.basicCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Usuários com assinatura Basic
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Planos de Assinatura</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <CreditCard size={40} className="text-gray-400" />
              <h3 className="text-lg font-medium text-gray-500">Nenhum plano encontrado</h3>
              <p className="text-sm text-gray-400 text-center max-w-md">
                Não foi possível encontrar planos de assinatura configurados no sistema.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Assinantes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {plan.name === "premium" && (
                            <Star className="h-4 w-4 text-yellow-500" />
                          )}
                          {plan.displayName}
                          {plan.isDefault && (
                            <Badge variant="outline" className="ml-2">
                              Padrão
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            plan.name === "premium"
                              ? "default"
                              : plan.name === "basic"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {plan.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatCurrency(plan.price)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {plan.features?.length > 0 && (
                            <span>{plan.features.slice(0, 2).join(", ")}...</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary"
                        >
                          {plan.name === "premium"
                            ? planStats.premiumCount || 0
                            : plan.name === "basic"
                            ? planStats.basicCount || 0
                            : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de edição */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Valor do Plano</DialogTitle>
            <DialogDescription>
              {currentPlan && (
                <>Atualizando valores para o plano <strong>{currentPlan.displayName}</strong>.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (em centavos)</FormLabel>
                    <FormDescription>
                      Digite o valor em centavos (ex: 10000 = R$ 100,00)
                    </FormDescription>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        placeholder="10000" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Alert className="bg-primary/10 border-primary/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  A alteração do valor afetará todos os novos assinantes.
                  Os usuários atuais não terão seus valores alterados.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updatePlanMutation.isPending}
                  className="w-full"
                >
                  {updatePlanMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSubscriptionPlansPage;