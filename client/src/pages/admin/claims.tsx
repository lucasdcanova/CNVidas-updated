// @ts-nocheck
import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { getAllClaims, getPendingClaims, updateClaim } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/ui/data-table";
import Breadcrumb from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Filter,
  ThumbsUp,
  ThumbsDown,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Claim } from "@/shared/types";
import { Column, Action } from "@/components/ui/data-table";

// Form schema for claim review
const reviewFormSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    required_error: "Por favor, selecione uma decisão",
  }),
  reviewNotes: z.string().min(1, "Notas de revisão são obrigatórias"),
  amountApproved: z.string().optional(),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

const AdminClaims: React.FC = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  const { data: allClaims = [], refetch: refetchAllClaims } = useQuery({
    queryKey: ["/api/admin/claims"],
    queryFn: getAllClaims,
  });
  
  const { data: pendingClaims = [], refetch: refetchPendingClaims } = useQuery({
    queryKey: ["/api/admin/pending-claims"],
    queryFn: getPendingClaims,
  });
  
  // Review form
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      status: "approved",
      reviewNotes: "",
      amountApproved: "",
    },
  });
  
  // Filter claims by status
  const approvedClaims = allClaims.filter((c: Claim) => c.status === "approved");
  const rejectedClaims = allClaims.filter((c: Claim) => c.status === "rejected");
  
  // Filter claims based on search term
  const filterClaims = (claimsList: Claim[]) => {
    if (!searchTerm) return claimsList;
    
    return claimsList.filter(claim => 
      claim.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(claim.id).includes(searchTerm)
    );
  };
  
  // Get claims based on current tab
  const getCurrentTabClaims = (tab: string) => {
    switch (tab) {
      case "pending": return filterClaims(pendingClaims);
      case "approved": return filterClaims(approvedClaims);
      case "rejected": return filterClaims(rejectedClaims);
      default: return filterClaims(allClaims);
    }
  };
  
  // Claim columns for data table
  const claimColumns: Column<Claim>[] = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
    },
    {
      id: "type",
      header: "Tipo",
      accessorKey: "type",
    },
    {
      id: "occurrenceDate",
      header: "Data da Ocorrência",
      accessorKey: "occurrenceDate",
      cell: (row: Claim) => <span>{format(new Date(row.occurrenceDate), "dd/MM/yyyy", { locale: ptBR })}</span>,
    },
    {
      id: "userId",
      header: "ID do Usuário",
      accessorKey: "userId",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row: Claim) => {
        let colors;
        let label;
        switch (row.status) {
          case "pending":
            colors = "bg-yellow-100 text-yellow-800";
            label = "Em análise";
            break;
          case "approved":
            colors = "bg-green-100 text-green-800";
            label = "Aprovado";
            break;
          case "rejected":
            colors = "bg-red-100 text-red-800";
            label = "Rejeitado";
            break;
          default:
            colors = "bg-gray-100 text-gray-800";
            label = row.status;
        }
        return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors}`}>{label}</span>;
      },
    },
    {
      id: "createdAt",
      header: "Data de Envio",
      accessorKey: "createdAt",
      cell: (row: Claim) => <span>{format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>,
    },
  ];
  
  // Handle view claim details
  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setShowDetailsDialog(true);
  };
  
  // Handle review claim
  const handleReviewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    
    // Reset form with default values
    form.reset({
      status: "approved",
      reviewNotes: "",
      amountApproved: claim.amountRequested ? String(claim.amountRequested / 100) : "",
    });
    
    setShowReviewDialog(true);
  };
  
  // Submit claim review
  // Mutation para atualizar um sinistro
  const updateClaimMutation = useMutation({
    mutationFn: (data: any) => updateClaim(data.id, data),
    onSuccess: (_data, variables) => {
      toast({
        title: variables.status === "approved" ? "Sinistro aprovado" : "Sinistro rejeitado",
        description: "A decisão foi registrada com sucesso.",
      });
      
      // Refetch claims data
      refetchAllClaims();
      refetchPendingClaims();
      
      // Close dialog
      setShowReviewDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar sinistro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmitReview = (data: ReviewFormValues) => {
    if (!selectedClaim) return;
    
    // Convert amount to cents if provided
    const amountApproved = data.amountApproved 
      ? Math.round(parseFloat(data.amountApproved) * 100) 
      : undefined;
    
    // Update claim with review data
    updateClaimMutation.mutate({
      id: selectedClaim.id,
      status: data.status,
      reviewNotes: data.reviewNotes,
      amountApproved,
      reviewedBy: 1, // Current admin user ID would be used in a real implementation
    });
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };
  
  return (
    <AdminLayout title="Gerenciamento de Sinistros">
      <div className="max-w-7xl mx-auto">
        {/* Header with search and filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 mt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h1 className="text-2xl font-bold text-gray-900">Sinistros</h1>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  placeholder="Buscar sinistros..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <Clock className="h-10 w-10 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Sinistros Pendentes</p>
                <h3 className="text-2xl font-bold">{pendingClaims.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Sinistros Aprovados</p>
                <h3 className="text-2xl font-bold">{approvedClaims.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <XCircle className="h-10 w-10 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Sinistros Rejeitados</p>
                <h3 className="text-2xl font-bold">{rejectedClaims.length}</h3>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Claims management tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="all">Todos ({allClaims.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingClaims.length})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados ({approvedClaims.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados ({rejectedClaims.length})</TabsTrigger>
          </TabsList>
          
          {/* Tab contents */}
          <TabsContent value="all">
            <ClaimsList 
              claims={getCurrentTabClaims("all")} 
              columns={claimColumns}
              onViewClaim={handleViewClaim}
              onReviewClaim={handleReviewClaim}
              showReviewAction={false}
            />
          </TabsContent>
          
          <TabsContent value="pending">
            <ClaimsList 
              claims={getCurrentTabClaims("pending")} 
              columns={claimColumns}
              onViewClaim={handleViewClaim}
              onReviewClaim={handleReviewClaim}
              showReviewAction={true}
            />
          </TabsContent>
          
          <TabsContent value="approved">
            <ClaimsList 
              claims={getCurrentTabClaims("approved")} 
              columns={claimColumns}
              onViewClaim={handleViewClaim}
              onReviewClaim={handleReviewClaim}
              showReviewAction={false}
            />
          </TabsContent>
          
          <TabsContent value="rejected">
            <ClaimsList 
              claims={getCurrentTabClaims("rejected")} 
              columns={claimColumns}
              onViewClaim={handleViewClaim}
              onReviewClaim={handleReviewClaim}
              showReviewAction={false}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Claim details dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Sinistro #{selectedClaim?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Tipo de Sinistro</h3>
                  <p className="mt-1">{selectedClaim.type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Data da Ocorrência</h3>
                  <p className="mt-1">{format(new Date(selectedClaim.occurrenceDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <p className="mt-1">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      selectedClaim.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      selectedClaim.status === "approved" ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {selectedClaim.status === "pending" ? "Em análise" :
                       selectedClaim.status === "approved" ? "Aprovado" :
                       "Rejeitado"}
                    </span>
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Data de Envio</h3>
                  <p className="mt-1">{format(new Date(selectedClaim.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                {selectedClaim.amountRequested && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Valor Solicitado</h3>
                    <p className="mt-1">{formatCurrency(selectedClaim.amountRequested)}</p>
                  </div>
                )}
                {selectedClaim.amountApproved && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Valor Aprovado</h3>
                    <p className="mt-1">{formatCurrency(selectedClaim.amountApproved)}</p>
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Descrição</h3>
                <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded-md">{selectedClaim.description}</p>
              </div>
              
              {selectedClaim.documents && selectedClaim.documents.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Documentos Anexados</h3>
                  <ul className="mt-1 space-y-1">
                    {selectedClaim.documents.map((doc: string, index: number) => (
                      <li key={index} className="text-sm text-primary-600 hover:text-primary-500">
                        <a href={doc} target="_blank" rel="noopener noreferrer">
                          Documento {index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedClaim.reviewNotes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Notas de Revisão</h3>
                  <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded-md">{selectedClaim.reviewNotes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fechar
            </Button>
            {selectedClaim?.status === "pending" && (
              <Button onClick={() => {
                setShowDetailsDialog(false);
                handleReviewClaim(selectedClaim);
              }}>
                Analisar Sinistro
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Claim review dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Análise de Sinistro #{selectedClaim?.id}</DialogTitle>
            <DialogDescription>
              Analise os detalhes e tome uma decisão sobre este sinistro.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitReview)} className="space-y-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decisão</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma decisão" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="approved">
                          <div className="flex items-center">
                            <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
                            Aprovar
                          </div>
                        </SelectItem>
                        <SelectItem value="rejected">
                          <div className="flex items-center">
                            <ThumbsDown className="h-4 w-4 mr-2 text-red-500" />
                            Rejeitar
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch("status") === "approved" && selectedClaim?.amountRequested && (
                <FormField
                  control={form.control}
                  name="amountApproved"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Aprovado (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Valor em reais" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="reviewNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas de Revisão</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Adicione suas notas e justificativa para a decisão" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setShowReviewDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {form.watch("status") === "approved" ? "Aprovar Sinistro" : "Rejeitar Sinistro"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

// Claims list component
interface ClaimsListProps {
  claims: Claim[];
  columns: Column<Claim>[];
  onViewClaim: (claim: Claim) => void;
  onReviewClaim: (claim: Claim) => void;
  showReviewAction: boolean;
}

const ClaimsList: React.FC<ClaimsListProps> = ({ 
  claims, 
  columns, 
  onViewClaim, 
  onReviewClaim,
  showReviewAction 
}) => {
  const actions: Action<Claim>[] = showReviewAction
    ? [
        {
          label: "Ver detalhes",
          onClick: (row) => onViewClaim(row),
        },
        {
          label: "Analisar",
          onClick: (row) => onReviewClaim(row),
        },
      ]
    : [
        {
          label: "Ver detalhes",
          onClick: (row) => onViewClaim(row),
        },
      ];

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle>Lista de Sinistros</CardTitle>
          <div className="flex items-center space-x-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Em análise</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable<Claim>
          columns={columns}
          data={claims || []}
          actions={actions}
        />
      </CardContent>
    </Card>
  );
};

export default AdminClaims;
