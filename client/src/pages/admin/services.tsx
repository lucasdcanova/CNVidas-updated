import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveTable,
  ResponsiveTableHeader,
  ResponsiveTableBody,
  ResponsiveTableHead,
  ResponsiveTableRow,
  ResponsiveTableCell,
} from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, Search, Edit, Trash2, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Interface para os serviços
interface Service {
  id: number;
  partnerId: number;
  name: string;
  description: string;
  price?: number; // Pode não estar presente no formato original
  regularPrice?: number; // Pode estar presente neste formato
  discountPrice?: number;
  discountPercentage?: number;
  category?: string;
  duration?: number;
  active?: boolean; // versão antiga
  isActive?: boolean; // versão nova
  isFeatured: boolean;
  createdAt?: string;
  updatedAt?: string;
  partnerName?: string;
}

// Interface para os parceiros
interface Partner {
  id: number;
  businessName: string;
}

const AdminServices: React.FC = () => {
  // Estado
  const [searchQuery, setSearchQuery] = useState("");
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { toast } = useToast();

  // Função para carregar serviços
  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("GET", "/api/admin/services");
      const data = await response.json();
      // Garantir que data seja sempre um array
      const servicesArray = Array.isArray(data) ? data : [];
      setServices(servicesArray);
      console.log("Serviços carregados:", servicesArray);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast({
        title: "Erro ao carregar serviços",
        description: "Não foi possível carregar a lista de serviços.",
        variant: "destructive",
      });
      setServices([]); // Garantir array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar parceiros
  const loadPartners = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/partners");
      const data = await response.json();
      // Garantir que data seja sempre um array
      const partnersArray = Array.isArray(data) ? data : [];
      setPartners(partnersArray);
    } catch (error) {
      console.error("Erro ao carregar parceiros:", error);
      setPartners([]); // Garantir array vazio em caso de erro
    }
  };

  // Carregar dados quando o componente montar
  useEffect(() => {
    loadServices();
    loadPartners();
  }, []);

  // Filtrar serviços baseado na busca
  const filteredServices = services.filter((service) => {
    const matchesSearch = 
      searchQuery === "" || 
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.partnerName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Função para atualizar serviço
  const updateService = async (data: any) => {
    try {
      // Formatar os dados diretamente no formato que o backend espera
      // O schema do banco espera regularPrice e isActive
      
      // Usar o preço exatamente como informado pelo administrador
      console.log("Valor do preço informado:", data.price, typeof data.price);
      
      const serviceData = {
        id: data.id,
        name: data.name,
        description: data.description,
        regularPrice: data.price,
        isActive: data.active !== undefined ? data.active : undefined
      };
      
      console.log("Enviando para o backend:", serviceData);
      
      const response = await apiRequest("PATCH", `/api/admin/services/${data.id}`, serviceData);
      if (!response.ok) {
        throw new Error("Falha ao atualizar serviço");
      }
      const updatedService = await response.json();
      console.log("Resposta do backend:", updatedService);
      
      toast({
        title: "Serviço atualizado",
        description: "O serviço foi atualizado com sucesso.",
      });
      
      // Forçar recarregamento completo dos dados
      loadServices();
      
      setOpenEditDialog(false);
      return updatedService;
    } catch (error) {
      console.error("Erro ao atualizar serviço:", error);
      toast({
        title: "Erro ao atualizar serviço",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Função para excluir serviço
  const deleteService = async (id: number) => {
    try {
      const response = await apiRequest("DELETE", `/api/admin/services/${id}`);
      if (!response.ok) {
        throw new Error("Falha ao excluir serviço");
      }
      
      // Remover o serviço da lista
      setServices(prevServices => prevServices.filter(service => service.id !== id));
      
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast({
        title: "Erro ao excluir serviço",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Função para alternar destaque
  const toggleFeature = async (id: number, isFeatured: boolean) => {
    try {
      const response = await apiRequest("PATCH", `/api/admin/services/${id}/feature`, { isFeatured });
      if (!response.ok) {
        throw new Error("Falha ao alterar destaque");
      }
      const updatedService = await response.json();
      
      toast({
        title: isFeatured ? "Serviço destacado" : "Destaque removido",
        description: isFeatured 
          ? "O serviço foi adicionado aos destaques." 
          : "O serviço foi removido dos destaques.",
      });
      
      // Força um recarregamento completo dos dados
      loadServices();
    } catch (error) {
      console.error("Erro ao atualizar destaque:", error);
      toast({
        title: "Erro ao atualizar destaque",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Função para criar serviço
  const createService = async (data: any) => {
    try {
      const response = await apiRequest("POST", `/api/admin/services`, {
        ...data,
        partnerId: parseInt(data.partnerId),
      });
      if (!response.ok) {
        throw new Error("Falha ao criar serviço");
      }
      const newService = await response.json();
      
      // Adicionar o novo serviço à lista
      setServices(prevServices => [...prevServices, newService]);
      
      toast({
        title: "Serviço criado",
        description: "O serviço foi criado com sucesso.",
      });
      
      setOpenCreateDialog(false);
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
      toast({
        title: "Erro ao criar serviço",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handlers de UI
  const handleEdit = (service: Service) => {
    setCurrentService(service);
    setOpenEditDialog(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.")) {
      deleteService(id);
    }
  };

  const handleToggleFeature = (id: number, currentFeatured: boolean) => {
    toggleFeature(id, !currentFeatured);
  };

  const handleSubmitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentService) return;
    
    const formData = new FormData(e.currentTarget);
    
    // Obter o valor do campo 'active'
    const activeValue = formData.get("active");
    const active = activeValue === 'true';
    
    console.log("Formulário de edição submetido:", {
      name: formData.get("name"),
      description: formData.get("description"),
      price: parseFloat(formData.get("price") as string),
      active: active,
      rawActiveValue: activeValue,
    });
    
    const updatedServiceData = {
      id: currentService.id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string) * 100, // Converter para centavos
      active: active,
    };
    
    updateService(updatedServiceData);
  };
  
  const handleSubmitCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const partnerId = formData.get("partnerId") as string;
    
    if (!partnerId) {
      toast({
        title: "Erro ao criar serviço",
        description: "Selecione um parceiro válido.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Formulário de criação submetido:", {
      partnerId,
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      active: formData.get("active"),
      isFeatured: formData.get("isFeatured"),
    });
    
    const newServiceData = {
      partnerId,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string) * 100, // Converter para centavos
      active: formData.get("active") === "on",
      isFeatured: formData.get("isFeatured") === "on",
    };
    
    createService(newServiceData);
  };

  return (
    <AdminLayout title="Gerenciar Serviços Parceiros">
      <Card className="mb-4 lg:mb-6">
        <CardHeader className="pb-3 lg:pb-6">
          <div className="flex flex-col space-y-3 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
            <div>
              <CardTitle className="text-lg lg:text-xl">Serviços Parceiros</CardTitle>
              <CardDescription className="text-sm lg:text-base mt-1 lg:mt-2">
                Gerencie os serviços oferecidos pelos parceiros na plataforma.
              </CardDescription>
            </div>
            <div className="flex flex-col lg:flex-row gap-2 lg:gap-3">
              <Button 
                variant="outline" 
                onClick={loadServices}
                className="w-full lg:w-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> 
                <span>Atualizar</span>
              </Button>
              <Button 
                onClick={() => setOpenCreateDialog(true)}
                className="w-full lg:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" /> 
                <span>Adicionar Serviço</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6">
          <div className="flex mb-4 lg:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Buscar serviços..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="border rounded-md">
              <ResponsiveTable>
                <ResponsiveTableHeader>
                  <TableRow>
                    <ResponsiveTableHead>Nome</ResponsiveTableHead>
                    <ResponsiveTableHead>Parceiro</ResponsiveTableHead>
                    <ResponsiveTableHead>Preço</ResponsiveTableHead>
                    <ResponsiveTableHead>Status</ResponsiveTableHead>
                    <ResponsiveTableHead>Destaque</ResponsiveTableHead>
                    <ResponsiveTableHead className="text-right">Ações</ResponsiveTableHead>
                  </TableRow>
                </ResponsiveTableHeader>
                <ResponsiveTableBody>
                  {filteredServices.length > 0 ? (
                    filteredServices.map((service) => (
                      <ResponsiveTableRow key={service.id}>
                        <ResponsiveTableCell header="Nome" className="font-medium">{service.name}</ResponsiveTableCell>
                        <ResponsiveTableCell header="Parceiro">{service.partnerName || "Parceiro Desconhecido"}</ResponsiveTableCell>
                        <ResponsiveTableCell header="Preço">R$ {((service.regularPrice || service.price || 0) / 100).toFixed(2)}</ResponsiveTableCell>
                        <ResponsiveTableCell header="Status">
                          {service.isActive || service.active ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800">
                              <AlertCircle className="mr-1 h-3 w-3" /> Inativo
                            </Badge>
                          )}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Destaque">
                          <Switch 
                            checked={service.isFeatured || false} 
                            onCheckedChange={() => handleToggleFeature(service.id, service.isFeatured || false)}
                          />
                        </ResponsiveTableCell>
                        <ResponsiveTableCell header="Ações" className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </ResponsiveTableCell>
                      </ResponsiveTableRow>
                    ))
                  ) : (
                    <ResponsiveTableRow>
                      <ResponsiveTableCell header="" className="text-center py-6 lg:py-8 text-gray-500" style={{ gridColumn: '1 / -1' }}>
                        <div className="flex flex-col items-center space-y-2">
                          <AlertCircle className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm lg:text-base">Nenhum serviço encontrado.</p>
                        </div>
                      </ResponsiveTableCell>
                    </ResponsiveTableRow>
                  )}
                </ResponsiveTableBody>
              </ResponsiveTable>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de edição de serviço */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
            <DialogDescription>
              Atualize as informações do serviço abaixo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Serviço</Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="Ex: Consulta Cardiológica"
                  defaultValue={currentService?.name || ""} 
                  required 
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Select name="category" defaultValue={currentService?.category || ""} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Especialidades Médicas</SelectLabel>
                      <SelectItem value="Alergologia">Alergologia</SelectItem>
                      <SelectItem value="Anestesiologia">Anestesiologia</SelectItem>
                      <SelectItem value="Angiologia">Angiologia</SelectItem>
                      <SelectItem value="Cardiologia">Cardiologia</SelectItem>
                      <SelectItem value="Cirurgia Geral">Cirurgia Geral</SelectItem>
                      <SelectItem value="Cirurgia Plástica">Cirurgia Plástica</SelectItem>
                      <SelectItem value="Dermatologia">Dermatologia</SelectItem>
                      <SelectItem value="Endocrinologia">Endocrinologia</SelectItem>
                      <SelectItem value="Gastroenterologia">Gastroenterologia</SelectItem>
                      <SelectItem value="Geriatria">Geriatria</SelectItem>
                      <SelectItem value="Ginecologia">Ginecologia e Obstetrícia</SelectItem>
                      <SelectItem value="Hematologia">Hematologia</SelectItem>
                      <SelectItem value="Infectologia">Infectologia</SelectItem>
                      <SelectItem value="Neurologia">Neurologia</SelectItem>
                      <SelectItem value="Oftalmologia">Oftalmologia</SelectItem>
                      <SelectItem value="Oncologia">Oncologia</SelectItem>
                      <SelectItem value="Ortopedia">Ortopedia e Traumatologia</SelectItem>
                      <SelectItem value="Otorrinolaringologia">Otorrinolaringologia</SelectItem>
                      <SelectItem value="Pediatria">Pediatria</SelectItem>
                      <SelectItem value="Pneumologia">Pneumologia</SelectItem>
                      <SelectItem value="Psiquiatria">Psiquiatria</SelectItem>
                      <SelectItem value="Reumatologia">Reumatologia</SelectItem>
                      <SelectItem value="Urologia">Urologia</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Exames e Diagnósticos</SelectLabel>
                      <SelectItem value="Análises Clínicas">Análises Clínicas</SelectItem>
                      <SelectItem value="Eletrocardiograma">Eletrocardiograma</SelectItem>
                      <SelectItem value="Ecocardiograma">Ecocardiograma</SelectItem>
                      <SelectItem value="Endoscopia">Endoscopia</SelectItem>
                      <SelectItem value="Mamografia">Mamografia</SelectItem>
                      <SelectItem value="Radiografia">Radiografia</SelectItem>
                      <SelectItem value="Ressonância Magnética">Ressonância Magnética</SelectItem>
                      <SelectItem value="Tomografia">Tomografia Computadorizada</SelectItem>
                      <SelectItem value="Ultrassonografia">Ultrassonografia</SelectItem>
                      <SelectItem value="Laboratorial">Exames Laboratoriais</SelectItem>
                      <SelectItem value="Imagem">Exames de Imagem</SelectItem>
                      <SelectItem value="Preventivo">Check-up Completo</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Terapias e Saúde Complementar</SelectLabel>
                      <SelectItem value="Acupuntura">Acupuntura</SelectItem>
                      <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                      <SelectItem value="Fonoaudiologia">Fonoaudiologia</SelectItem>
                      <SelectItem value="Nutrição">Nutrição</SelectItem>
                      <SelectItem value="Odontologia">Odontologia</SelectItem>
                      <SelectItem value="Psicologia">Psicologia</SelectItem>
                      <SelectItem value="Psicopedagogia">Psicopedagogia</SelectItem>
                      <SelectItem value="Terapia Ocupacional">Terapia Ocupacional</SelectItem>
                      <SelectItem value="Outro">Outro Serviço</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  placeholder="Descreva os detalhes do serviço oferecido" 
                  defaultValue={currentService?.description || ""}
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Preço Regular (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-[9px] text-muted-foreground">
                      R$
                    </span>
                    <Input 
                      id="price" 
                      name="price" 
                      type="text" 
                      placeholder="0,00" 
                      className="pl-9"
                      defaultValue={
                        currentService?.regularPrice 
                          ? (currentService.regularPrice / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })
                          : currentService?.price 
                            ? (currentService.price / 100).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })
                            : "0,00"
                      }
                      required 
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">Valor sem desconto (em R$)</div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="discountPercentage">Desconto (%)</Label>
                  <div className="relative">
                    <Input 
                      id="discountPercentage" 
                      name="discountPercentage" 
                      type="text" 
                      placeholder="0" 
                      defaultValue={currentService?.discountPercentage || "0"}
                    />
                    <span className="absolute right-3 top-[9px] text-muted-foreground">
                      %
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">Percentual de desconto aplicado</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duração (minutos)</Label>
                  <Input 
                    id="duration" 
                    name="duration" 
                    type="number" 
                    min="5" 
                    step="5" 
                    placeholder="30" 
                    defaultValue={currentService?.duration || "30"}
                  />
                  <div className="text-sm text-muted-foreground">Tempo estimado do serviço</div>
                </div>
                
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="text-base">Ativo</Label>
                    <div className="text-sm text-muted-foreground">
                      Serviços inativos não são exibidos para pacientes
                    </div>
                  </div>
                  <Switch 
                    id="active" 
                    name="active" 
                    checked={currentService?.isActive || currentService?.active || false}
                    onCheckedChange={(checked) => {
                      // Atualiza o valor no objeto currentService para refletir na UI
                      if (currentService) {
                        setCurrentService({
                          ...currentService,
                          isActive: checked,
                          active: checked
                        });
                      }
                    }}
                  />
                  <input 
                    type="hidden" 
                    name="active" 
                    value={(currentService?.isActive || currentService?.active) ? 'true' : 'false'} 
                  />
                </div>
              </div>
              
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isFeatured" className="text-base">Destacar Serviço</Label>
                  <div className="text-sm text-muted-foreground">
                    Serviços destacados aparecem com prioridade na busca dos pacientes
                  </div>
                </div>
                <Switch
                  id="isFeatured"
                  name="isFeatured"
                  checked={currentService?.isFeatured || false}
                  onCheckedChange={(checked) => {
                    // Atualiza o valor no objeto currentService para refletir na UI
                    if (currentService) {
                      setCurrentService({
                        ...currentService,
                        isFeatured: checked
                      });
                    }
                  }}
                />
                <input 
                  type="hidden" 
                  name="isFeatured" 
                  value={currentService?.isFeatured ? 'true' : 'false'} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setOpenEditDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de criação de serviço */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Serviço</DialogTitle>
            <DialogDescription>
              Preencha as informações do novo serviço abaixo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="partnerId">Parceiro</Label>
                <Select name="partnerId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um parceiro" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.length > 0 ? (
                      partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.businessName}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-2 text-sm text-gray-500">
                        Nenhum parceiro encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Serviço</Label>
                <Input id="name" name="name" placeholder="Ex: Consulta Cardiológica" required />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Especialidades Médicas</SelectLabel>
                      <SelectItem value="Alergologia">Alergologia</SelectItem>
                      <SelectItem value="Anestesiologia">Anestesiologia</SelectItem>
                      <SelectItem value="Angiologia">Angiologia</SelectItem>
                      <SelectItem value="Cardiologia">Cardiologia</SelectItem>
                      <SelectItem value="Cirurgia Geral">Cirurgia Geral</SelectItem>
                      <SelectItem value="Cirurgia Plástica">Cirurgia Plástica</SelectItem>
                      <SelectItem value="Dermatologia">Dermatologia</SelectItem>
                      <SelectItem value="Endocrinologia">Endocrinologia</SelectItem>
                      <SelectItem value="Gastroenterologia">Gastroenterologia</SelectItem>
                      <SelectItem value="Geriatria">Geriatria</SelectItem>
                      <SelectItem value="Ginecologia">Ginecologia e Obstetrícia</SelectItem>
                      <SelectItem value="Hematologia">Hematologia</SelectItem>
                      <SelectItem value="Infectologia">Infectologia</SelectItem>
                      <SelectItem value="Neurologia">Neurologia</SelectItem>
                      <SelectItem value="Oftalmologia">Oftalmologia</SelectItem>
                      <SelectItem value="Oncologia">Oncologia</SelectItem>
                      <SelectItem value="Ortopedia">Ortopedia e Traumatologia</SelectItem>
                      <SelectItem value="Otorrinolaringologia">Otorrinolaringologia</SelectItem>
                      <SelectItem value="Pediatria">Pediatria</SelectItem>
                      <SelectItem value="Pneumologia">Pneumologia</SelectItem>
                      <SelectItem value="Psiquiatria">Psiquiatria</SelectItem>
                      <SelectItem value="Reumatologia">Reumatologia</SelectItem>
                      <SelectItem value="Urologia">Urologia</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Exames e Diagnósticos</SelectLabel>
                      <SelectItem value="Análises Clínicas">Análises Clínicas</SelectItem>
                      <SelectItem value="Eletrocardiograma">Eletrocardiograma</SelectItem>
                      <SelectItem value="Ecocardiograma">Ecocardiograma</SelectItem>
                      <SelectItem value="Endoscopia">Endoscopia</SelectItem>
                      <SelectItem value="Mamografia">Mamografia</SelectItem>
                      <SelectItem value="Radiografia">Radiografia</SelectItem>
                      <SelectItem value="Ressonância Magnética">Ressonância Magnética</SelectItem>
                      <SelectItem value="Tomografia">Tomografia Computadorizada</SelectItem>
                      <SelectItem value="Ultrassonografia">Ultrassonografia</SelectItem>
                      <SelectItem value="Laboratorial">Exames Laboratoriais</SelectItem>
                      <SelectItem value="Imagem">Exames de Imagem</SelectItem>
                      <SelectItem value="Preventivo">Check-up Completo</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Terapias e Saúde Complementar</SelectLabel>
                      <SelectItem value="Acupuntura">Acupuntura</SelectItem>
                      <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                      <SelectItem value="Fonoaudiologia">Fonoaudiologia</SelectItem>
                      <SelectItem value="Nutrição">Nutrição</SelectItem>
                      <SelectItem value="Odontologia">Odontologia</SelectItem>
                      <SelectItem value="Psicologia">Psicologia</SelectItem>
                      <SelectItem value="Psicopedagogia">Psicopedagogia</SelectItem>
                      <SelectItem value="Terapia Ocupacional">Terapia Ocupacional</SelectItem>
                      <SelectItem value="Outro">Outro Serviço</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  placeholder="Descreva os detalhes do serviço oferecido" 
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Preço Regular (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-[9px] text-muted-foreground">
                      R$
                    </span>
                    <Input 
                      id="price" 
                      name="price" 
                      type="text" 
                      placeholder="0,00" 
                      className="pl-9"
                      defaultValue="0,00" 
                      required 
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">Valor sem desconto (em R$)</div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="discountPercentage">Desconto (%)</Label>
                  <div className="relative">
                    <Input 
                      id="discountPercentage" 
                      name="discountPercentage" 
                      type="text" 
                      placeholder="0" 
                      defaultValue="0"
                    />
                    <span className="absolute right-3 top-[9px] text-muted-foreground">
                      %
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">Percentual de desconto aplicado</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duração (minutos)</Label>
                  <Input 
                    id="duration" 
                    name="duration" 
                    type="number" 
                    min="5" 
                    step="5" 
                    placeholder="30" 
                    defaultValue="30"
                  />
                  <div className="text-sm text-muted-foreground">Tempo estimado do serviço</div>
                </div>
                
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="text-base">Ativo</Label>
                    <div className="text-sm text-muted-foreground">
                      Serviços inativos não são exibidos para pacientes
                    </div>
                  </div>
                  <Switch
                    id="active"
                    name="active"
                    defaultChecked={true}
                  />
                </div>
              </div>
              
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isFeatured" className="text-base">Destacar Serviço</Label>
                  <div className="text-sm text-muted-foreground">
                    Serviços destacados aparecem com prioridade na busca dos pacientes
                  </div>
                </div>
                <Switch
                  id="isFeatured"
                  name="isFeatured"
                  defaultChecked={false}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setOpenCreateDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Criar Serviço
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminServices;