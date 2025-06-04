import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { getAllPartners, getAdminPartners, updatePartner, createAdminPartner } from "@/lib/api";
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
  Building, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit, 
  Eye, 
  Filter, 
  Plus 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Partner } from "@/shared/types";

const AdminPartners: React.FC = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: getAllPartners,
  });
  
  // Filter partners by status
  const activePartners = partners.filter((p: Partner) => p.status === "active");
  const pendingPartners = partners.filter((p: Partner) => p.status === "pending");
  const inactivePartners = partners.filter((p: Partner) => p.status !== "active" && p.status !== "pending");
  
  // Filter partners based on search term and status
  const filterPartners = (partnersList: Partner[]) => {
    let filtered = partnersList;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(partner => 
        partner.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.businessType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(partner => partner.status === statusFilter);
    }
    
    return filtered;
  };
  
  // Get partners based on current tab
  const getCurrentTabPartners = (tab: string) => {
    switch (tab) {
      case "active": return filterPartners(activePartners);
      case "pending": return filterPartners(pendingPartners);
      case "inactive": return filterPartners(inactivePartners);
      default: return filterPartners(partners);
    }
  };
  
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPartnerDialogOpen, setAddPartnerDialogOpen] = useState(false);
  
  // Form for adding new partner
  const addPartnerForm = useForm({
    defaultValues: {
      businessName: "",
      businessType: "",
      phone: "",
      address: "",
      email: "",
      status: "pending"
    }
  });
  
  const createPartnerMutation = useMutation({
    mutationFn: (data: any) => createAdminPartner(data),
    onSuccess: () => {
      toast({
        title: "Parceiro adicionado",
        description: "O novo parceiro foi adicionado com sucesso.",
      });
      setAddPartnerDialogOpen(false);
      addPartnerForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar parceiro",
        description: error.message || "Ocorreu um erro ao adicionar o parceiro.",
        variant: "destructive",
      });
    },
  });
  
  const updatePartnerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => updatePartner(id, data),
    onSuccess: () => {
      toast({
        title: "Parceiro atualizado",
        description: "As informações do parceiro foram atualizadas com sucesso.",
      });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar parceiro",
        description: error.message || "Ocorreu um erro ao atualizar as informações do parceiro.",
        variant: "destructive",
      });
    },
  });

  // Partner columns for data table
  const partnerColumns = [
    {
      id: "businessName",
      header: "Nome do Parceiro",
      accessorKey: "businessName",
    },
    {
      id: "businessType",
      header: "Tipo",
      accessorKey: "businessType",
    },
    {
      id: "contact",
      header: "Contato",
      accessorKey: "phone",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
          row.status === "active" ? "bg-green-100 text-green-800" :
          row.status === "pending" ? "bg-yellow-100 text-yellow-800" :
          "bg-red-100 text-red-800"
        }`}>
          {row.status === "active" ? "Ativo" :
           row.status === "pending" ? "Pendente" :
           "Inativo"}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Data de Cadastro",
      accessorKey: "createdAt",
      cell: (row: any) => format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR }),
    },
  ];
  
  // Handle view partner details
  const handleViewPartner = (partnerId: number) => {
    const partner = partners.find((p: Partner) => p.id === partnerId);
    setSelectedPartner(partner || null);
    toast({
      title: "Visualizar parceiro",
      description: `Visualizando detalhes do parceiro: ${partner?.businessName}`,
    });
  };
  
  // Handle edit partner
  const handleEditPartner = (partnerId: number) => {
    const partner = partners.find((p: Partner) => p.id === partnerId);
    setSelectedPartner(partner || null);
    setEditDialogOpen(true);
  };
  
  // Handle approve partner
  const handleApprovePartner = (partnerId: number) => {
    const partner = partners.find((p: Partner) => p.id === partnerId);
    if (partner) {
      updatePartnerMutation.mutate({
        id: partner.id,
        data: { status: "active" }
      });
    }
  };
  
  // Handle reject partner
  const handleRejectPartner = (partnerId: number) => {
    const partner = partners.find((p: Partner) => p.id === partnerId);
    if (partner) {
      updatePartnerMutation.mutate({
        id: partner.id,
        data: { status: "inactive" }
      });
    }
  };
  
  // Edit form setup
  const partnerForm = useForm({
    defaultValues: {
      businessName: selectedPartner?.businessName || "",
      businessType: selectedPartner?.businessType || "",
      status: selectedPartner?.status || "pending",
      phone: selectedPartner?.phone || "",
      address: selectedPartner?.address || "",
    }
  });

  // Update form values when selected partner changes
  React.useEffect(() => {
    if (selectedPartner) {
      partnerForm.reset({
        businessName: selectedPartner.businessName || "",
        businessType: selectedPartner.businessType || "",
        status: selectedPartner.status || "pending",
        phone: selectedPartner.phone || "",
        address: selectedPartner.address || "",
      });
    }
  }, [selectedPartner, partnerForm]);

  // Handle form submit
  const onSubmit = (data: any) => {
    if (selectedPartner) {
      updatePartnerMutation.mutate({
        id: selectedPartner.id,
        data
      });
    }
  };

  return (
    <AdminLayout title="Gerenciamento de Parceiros">
      <div className="max-w-7xl mx-auto">
        {/* Header with search and filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 mt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              <h1 className="text-2xl font-bold text-gray-900">Parceiros</h1>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  placeholder="Buscar parceiros..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Dialog open={addPartnerDialogOpen} onOpenChange={setAddPartnerDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Parceiro
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Parceiro</DialogTitle>
                    <DialogDescription>
                      Preencha os dados abaixo para cadastrar um novo parceiro.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...addPartnerForm}>
                    <form onSubmit={addPartnerForm.handleSubmit((data) => createPartnerMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={addPartnerForm.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Empresa</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nome da empresa parceira" required />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addPartnerForm.control}
                        name="businessType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Negócio</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Clínica, Farmácia, etc." required />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addPartnerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="Email de contato" required />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addPartnerForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Telefone de contato" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addPartnerForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Endereço completo" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addPartnerForm.control}
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
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="inactive">Inativo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAddPartnerDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit"
                          disabled={createPartnerMutation.isPending}
                        >
                          {createPartnerMutation.isPending ? "Adicionando..." : "Adicionar Parceiro"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        
        {/* Edit Partner Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Parceiro</DialogTitle>
              <DialogDescription>
                Edite as informações do parceiro abaixo.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...partnerForm}>
              <form onSubmit={partnerForm.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={partnerForm.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={partnerForm.control}
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
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={partnerForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="py-2 mt-2">
                  {selectedPartner?.status !== "active" && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800 mb-2">
                        Este parceiro está com status <strong>{selectedPartner?.status === "pending" ? "pendente" : "inativo"}</strong>.
                      </p>
                      <Button 
                        type="button"
                        variant="outline"
                        className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                        onClick={() => {
                          partnerForm.setValue("status", "active");
                          toast({
                            title: "Status atualizado",
                            description: "O status foi alterado para Ativo no formulário. Clique em Salvar para confirmar as alterações.",
                          });
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Ativo
                      </Button>
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={updatePartnerMutation.isPending}
                  >
                    {updatePartnerMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Partner management tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="all">Todos ({partners.length})</TabsTrigger>
            <TabsTrigger value="active">Ativos ({activePartners.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingPartners.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inativos ({inactivePartners.length})</TabsTrigger>
          </TabsList>
          
          {/* Tab contents */}
          <TabsContent value="all">
            <PartnerList 
              partners={getCurrentTabPartners("all")} 
              columns={partnerColumns}
              onView={handleViewPartner}
              onEdit={handleEditPartner}
              onApprove={handleApprovePartner}
              onReject={handleRejectPartner}
              showApproveReject={false}
            />
          </TabsContent>
          
          <TabsContent value="active">
            <PartnerList 
              partners={getCurrentTabPartners("active")} 
              columns={partnerColumns}
              onView={handleViewPartner}
              onEdit={handleEditPartner}
              onApprove={handleApprovePartner}
              onReject={handleRejectPartner}
              showApproveReject={false}
            />
          </TabsContent>
          
          <TabsContent value="pending">
            <PartnerList 
              partners={getCurrentTabPartners("pending")} 
              columns={partnerColumns}
              onView={handleViewPartner}
              onEdit={handleEditPartner}
              onApprove={handleApprovePartner}
              onReject={handleRejectPartner}
              showApproveReject={true}
            />
          </TabsContent>
          
          <TabsContent value="inactive">
            <PartnerList 
              partners={getCurrentTabPartners("inactive")} 
              columns={partnerColumns}
              onView={handleViewPartner}
              onEdit={handleEditPartner}
              onApprove={handleApprovePartner}
              onReject={handleRejectPartner}
              showApproveReject={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

// Partner list component
interface PartnerListProps {
  partners: Partner[];
  columns: any[];
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  showApproveReject: boolean;
}

const PartnerList: React.FC<PartnerListProps> = ({ 
  partners, 
  columns, 
  onView, 
  onEdit,
  onApprove,
  onReject,
  showApproveReject 
}) => {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle>Lista de Parceiros</CardTitle>
          <div className="flex items-center space-x-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="clinic">Clínica</SelectItem>
                <SelectItem value="doctor">Médico</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="pharmacy">Farmácia</SelectItem>
                <SelectItem value="lab">Laboratório</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showApproveReject ? (
          <DataTable 
            columns={columns} 
            data={partners} 
            actions={[
              {
                label: "Visualizar",
                onClick: (row) => onView(row.id)
              },
              {
                label: "Aprovar",
                onClick: (row) => onApprove(row.id)
              },
              {
                label: "Rejeitar",
                onClick: (row) => onReject(row.id)
              }
            ]}
          />
        ) : (
          <DataTable 
            columns={columns} 
            data={partners} 
            actions={[
              {
                label: "Visualizar",
                onClick: (row) => onView(row.id)
              },
              {
                label: "Editar",
                onClick: (row) => onEdit(row.id)
              }
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPartners;
