import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { UseMutationResult, useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, Edit, Plus, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { deleteService } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PartnerService, Partner } from '@/shared/types';

interface ServiceFormData {
  name: string;
  description: string;
  regularPrice: string;
  discountPercentage: number;
  discountPrice?: string;
  duration: number;
  isFeatured: boolean;
  isActive: boolean;
  category: string;
  serviceImage?: string;
}

interface ServiceMutationVariables {
  id?: number;
  data: ServiceFormData;
}

// Form schema for service
const serviceSchema = z.object({
  name: z.string().min(3, { message: "Nome do serviço deve ter pelo menos 3 caracteres" }),
  description: z.string().min(10, { message: "Descrição deve ter pelo menos 10 caracteres" }),
  regularPrice: z.union([z.number().positive(), z.string()]).transform(value => {
    if (typeof value === 'string') {
      return value;
    }
    return value.toString();
  }),
  discountPercentage: z.number().min(0, { message: "Desconto não pode ser negativo" }).max(100, { message: "Desconto não pode ser maior que 100%" }),
  discountPrice: z.union([z.number(), z.string()]).optional().default("0"),
  duration: z.number().min(5, { message: "Duração mínima é de 5 minutos" }).default(30),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  category: z.string().min(1, { message: "Selecione uma categoria" }),
  serviceImage: z.string().optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

const PartnerServicesPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentService, setCurrentService] = useState<PartnerService | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Handler para upload de imagem
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar tipo de arquivo (apenas imagens)
    if (!file.type.match('image.*')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione apenas arquivos de imagem",
        variant: "destructive",
      });
      return;
    }

    // Verificar tamanho do arquivo (máx. 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 2MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setImagePreview(imageData);
      setUploadedImage(imageData);
      
      // Atualiza o valor do campo serviceImage no formulário
      form.setValue("serviceImage", imageData);
    };
    reader.readAsDataURL(file);
  };

  // Fetch partner information
  const { 
    data: partner,
    isLoading: isLoadingPartner
  } = useQuery<Partner | null>({
    queryKey: ["/api/partners/current"],
    queryFn: async () => {
      if (!user) {
        return null;
      }
      const res = await apiRequest("GET", `/api/partners/user/${user.id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch partner info");
      }
      return await res.json();
    },
    enabled: !!user
  });

  // Fetch partner's services
  const { 
    data: services = [], 
    isLoading: isLoadingServices,
    isError: isServicesError, 
    error: servicesError 
  } = useQuery<PartnerService[], Error>({
    queryKey: ["/api/services"],
    queryFn: async () => {
      if (!user) {
        console.log("User not authenticated, cannot fetch services");
        return [];
      }
      
      console.log(`Fetching services for partner with user ID: ${user.id}`);
      try {
        const res = await apiRequest("GET", `/api/services?userId=${user.id}`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch services: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Services fetched successfully:", data);
        return data;
      } catch (error) {
        console.error("Error fetching services:", error);
        throw error;
      }
    },
    enabled: !!user,
    retry: 1,
  });

  // Create service mutation
  const createServiceMutation = useMutation<PartnerService, Error, ServiceFormData>({
    mutationFn: async (data) => {
      console.log("Creating new service with data:", data);
      const res = await apiRequest("POST", "/api/partner-services", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Error creating service: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Serviço criado",
        description: "O serviço foi adicionado com sucesso",
      });
      setOpenDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update service mutation
  const updateServiceMutation = useMutation<PartnerService, Error, ServiceMutationVariables>({
    mutationFn: async ({ id, data }) => {
      console.log(`Updating service with ID: ${id}, data:`, data);
      const res = await apiRequest("PATCH", `/api/partner-services/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Error updating service: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Serviço atualizado",
        description: "As alterações foram salvas com sucesso",
      });
      setOpenDialog(false);
      setIsEditing(false);
      setCurrentService(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      toast({
        title: "Serviço removido",
        description: "O serviço foi removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form hook
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      regularPrice: "0,00",
      discountPrice: "0,00",
      discountPercentage: 0,
      duration: 30,
      isFeatured: false,
      isActive: true,
      category: "",
      serviceImage: "",
    },
  });

  // Handle form submission
  const onSubmit = (data: ServiceFormValues) => {
    try {
      console.log("Form data before conversion:", data);
      
      // Ensure price is a valid number and convert to cents for backend
      let regularPriceInCents: number;
      
      // Handle price input with possible comma as decimal separator
      if (typeof data.regularPrice === 'string') {
        // Replace comma with dot for proper number conversion
        const priceStr = (data.regularPrice as string).replace(',', '.');
        regularPriceInCents = Math.round(parseFloat(priceStr) * 100);
      } else {
        regularPriceInCents = Math.round(data.regularPrice * 100);
      }
      
      // Validate that we have a valid number after conversion
      if (isNaN(regularPriceInCents)) {
        throw new Error("Preço inválido: por favor informe um valor numérico válido");
      }
      
      // Calculate discount price based on percentage
      let discountPriceInCents = regularPriceInCents;
      if (data.discountPercentage > 0) {
        discountPriceInCents = Math.round(regularPriceInCents * (1 - data.discountPercentage / 100));
      }
      
      // Remove properties that should be modified or could cause type issues
      const { regularPrice: _, discountPrice: __, ...restData } = data;
      
      const formattedData: ServiceFormData = {
        regularPrice: String(regularPriceInCents),
        discountPrice: String(discountPriceInCents),
        name: data.name.trim(),
        description: data.description.trim(),
        category: data.category,
        duration: data.duration || 30,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isFeatured: data.isFeatured !== undefined ? data.isFeatured : false,
        discountPercentage: data.discountPercentage,
        serviceImage: uploadedImage || undefined,
      };
      
      console.log("Formatted data after conversion:", formattedData);
      
      if (isEditing && currentService) {
        updateServiceMutation.mutate({ id: currentService.id, data: formattedData });
      } else {
        createServiceMutation.mutate(formattedData);
      }
    } catch (error) {
      console.error("Error in onSubmit:", error);
      toast({
        title: "Erro ao processar o serviço",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao processar os dados do serviço",
        variant: "destructive",
      });
    }
  };

  // Edit service
  const handleEdit = (service: PartnerService) => {
    setIsEditing(true);
    setCurrentService(service);
    
    // Configurar o preview da imagem se existir
    if (service.serviceImage) {
      setImagePreview(service.serviceImage);
      setUploadedImage(service.serviceImage);
    } else {
      setImagePreview(null);
      setUploadedImage(null);
    }
    
    // Converter os valores de centavos para reais para exibição e formatar como moeda BR
    const regularPriceInReais = service.regularPrice / 100;
    const discountPriceInReais = (service.discountPrice || 0) / 100;
    
    // Format as Brazilian currency without R$ symbol
    const formattedRegularPrice = regularPriceInReais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).replace('R$', '');
    
    const formattedDiscountPrice = discountPriceInReais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).replace('R$', '');
    
    form.reset({
      name: service.name,
      description: service.description || "",
      regularPrice: formattedRegularPrice,
      discountPrice: formattedDiscountPrice,
      discountPercentage: service.discountPercentage || 0,
      duration: service.duration || 30,
      isFeatured: service.isFeatured || false,
      isActive: service.isActive !== false, // Se for undefined, mantém como true
      category: service.category,
      serviceImage: service.serviceImage || "",
    });
    
    setOpenDialog(true);
  };

  // Add new service
  const handleAddNew = () => {
    setIsEditing(false);
    setCurrentService(null);
    setImagePreview(null);
    setUploadedImage(null);
    form.reset({
      name: "",
      description: "",
      regularPrice: "0,00",
      discountPrice: "0,00",
      discountPercentage: 0,
      duration: 30,
      isFeatured: false,
      isActive: true,
      category: "",
      serviceImage: "",
    });
    setOpenDialog(true);
  };

  return (
    <DashboardLayout title="Gerenciamento de Serviços">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Meus Serviços</h1>
          <p className="text-gray-600">Gerencie os serviços oferecidos pela sua empresa</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Serviço
        </Button>
      </div>

      {isLoadingServices || isLoadingPartner ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isServicesError ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <span className="text-6xl text-red-500">⚠️</span>
            <h3 className="text-xl font-medium">Erro ao carregar serviços</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {servicesError instanceof Error 
                ? servicesError.message 
                : "Não foi possível carregar seus serviços. Tente novamente mais tarde."}
            </p>
            <Button onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {services && services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <Card key={service.id} className="overflow-hidden flex flex-col">
                  {/* Imagem do serviço ou fallback para a imagem do parceiro */}
                  <div className="w-full h-48 relative">
                    <img 
                      src={service.serviceImage || 'https://placehold.co/600x400/e2e8f0/64748b?text=CN+Vidas'} 
                      alt={service.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Se falhar ao carregar a imagem, mostre um plano de fundo genérico
                        e.currentTarget.src = 'https://placehold.co/600x400/e2e8f0/64748b?text=CN+Vidas';
                      }}
                    />
                    {service.isFeatured && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                          Destacado
                        </span>
                      </div>
                    )}
                    {!service.isActive && (
                      <div className="absolute top-2 left-2">
                        <span className="bg-white bg-opacity-80 text-gray-700 text-xs px-2 py-1 rounded-full">
                          Inativo
                        </span>
                      </div>
                    )}
                  </div>
                  <CardHeader className="bg-primary/5">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{service.name}</CardTitle>
                        <CardDescription className="mt-1">{service.category}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 flex-grow">
                    <p className="mb-4 text-sm text-gray-600 line-clamp-3">{service.description}</p>
                    <div className="flex justify-between items-center">
                      <div>
                        {service.discountPercentage && service.discountPercentage > 0 ? (
                          <>
                            {service.discountPrice ? (
                              <p className="text-lg font-bold">
                                R$ {(service.discountPrice / 100).toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-lg font-bold">Consulte</p>
                            )}
                            {service.regularPrice ? (
                              <p className="text-xs line-through text-gray-500">
                                R$ {(service.regularPrice / 100).toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500">Preço indisponível</p>
                            )}
                            <p className="text-xs text-green-600">
                              {service.discountPercentage}% de desconto
                            </p>
                          </>
                        ) : (
                          <>
                            {service.regularPrice ? (
                              <p className="text-lg font-bold">
                                R$ {(service.regularPrice / 100).toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-lg font-bold">Consulte</p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {service.createdAt ? (
                          <>Adicionado em {new Date(service.createdAt).toLocaleDateString('pt-BR')}</>
                        ) : (
                          <span>Data não disponível</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(service)}
                    >
                      <Edit className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleteServiceMutation.isPending}
                        >
                          {deleteServiceMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" /> Remover
                            </>
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Confirmar exclusão</DialogTitle>
                          <DialogDescription>
                            Você tem certeza que deseja remover o serviço "{service.name}"? 
                            Esta ação não pode ser desfeita.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex space-x-2 pt-4">
                          <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                          </DialogClose>
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              deleteServiceMutation.mutate(service.id);
                            }}
                            disabled={deleteServiceMutation.isPending}
                          >
                            {deleteServiceMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Confirmar exclusão
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <span className="material-icons text-6xl text-gray-300">medical_services</span>
                <h3 className="text-xl font-medium">Nenhum serviço cadastrado</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Você ainda não possui serviços cadastrados. Adicione seu primeiro serviço para
                  que seus clientes possam visualizá-lo.
                </p>
                <Button onClick={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Serviço
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Service Form Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] overflow-y-auto pt-6">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Serviço" : "Adicionar Novo Serviço"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Edite as informações do serviço selecionado"
                : "Preencha os detalhes do novo serviço que deseja oferecer"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Serviço</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Consulta Cardiológica" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
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
                        </SelectGroup>
                        
                        <SelectGroup>
                          <SelectLabel>Farmácias e Medicamentos</SelectLabel>
                          <SelectItem value="Farmácia">Farmácia</SelectItem>
                          <SelectItem value="Farmácia de Manipulação">Farmácia de Manipulação</SelectItem>
                          <SelectItem value="Medicamentos Especiais">Medicamentos Especiais</SelectItem>
                          <SelectItem value="Medicamentos de Alto Custo">Medicamentos de Alto Custo</SelectItem>
                        </SelectGroup>
                        
                        <SelectGroup>
                          <SelectLabel>Outros</SelectLabel>
                          <SelectItem value="Outro">Outro Serviço</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva os detalhes do serviço oferecido" 
                        rows={4} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagem do Serviço</FormLabel>
                    <FormDescription>
                      Adicione uma imagem que represente seu serviço (opcional)
                    </FormDescription>
                    <div className="flex flex-col space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="mt-1"
                      />
                      {imagePreview && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 mb-1">Preview:</p>
                          <div className="relative w-32 h-32 border rounded overflow-hidden">
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                      <input type="hidden" {...field} value={field.value} />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="regularPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço Regular (R$)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-[9px] text-muted-foreground">
                            R$
                          </span>
                          <Input 
                            type="text" 
                            placeholder="0,00" 
                            className="pl-9"
                            value={field.value}
                            onChange={(e) => {
                              // Get the raw input value
                              let inputValue = e.target.value;
                              
                              // Remove any non-numeric characters except decimal separator
                              inputValue = inputValue.replace(/[^\d.,]/g, '');
                              
                              // Replace comma with dot for calculation
                              const calcValue = inputValue.replace(',', '.');
                              
                              try {
                                const numericValue = parseFloat(calcValue);
                                
                                // Atualiza o valor no formulário (mesmo que seja texto para formatação)
                                field.onChange(inputValue);
                                
                                // Calcula o preço com desconto se houver percentual
                                if (!isNaN(numericValue)) {
                                  const discountPercentage = form.getValues("discountPercentage");
                                  if (discountPercentage > 0) {
                                    const discountPrice = numericValue * (1 - discountPercentage / 100);
                                    form.setValue(
                                      "discountPrice", 
                                      discountPrice.toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      }).replace('R$', '')
                                    );
                                  } else {
                                    const formattedPrice = numericValue.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    }).replace('R$', '');
                                    
                                    form.setValue("discountPrice", formattedPrice);
                                  }
                                }
                              } catch (error) {
                                console.error("Price input error:", error);
                              }
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Valor sem desconto (em R$)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto (%)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="text"  
                            placeholder="0" 
                            value={field.value}
                            onChange={(e) => {
                              // Get raw input and clean non-numeric characters
                              let inputValue = e.target.value.replace(/[^\d]/g, '');
                              
                              // Parse to integer
                              let value = parseInt(inputValue);
                              
                              // Enforce limits
                              if (isNaN(value)) value = 0;
                              if (value < 0) value = 0;
                              if (value > 100) value = 100;
                              
                              // Update field value
                              field.onChange(value);
                              
                              // Calculate discount price from regular price
                              try {
                                const regularPriceStr = form.getValues("regularPrice");
                                let regularPrice: number;
                                
                                if (typeof regularPriceStr === 'string') {
                                  regularPrice = parseFloat(regularPriceStr.replace(',', '.'));
                                } else {
                                  regularPrice = regularPriceStr;
                                }
                                
                                if (!isNaN(regularPrice) && regularPrice > 0) {
                                  const discountPrice = regularPrice * (1 - value / 100);
                                  
                                  // Format as Brazilian currency
                                  const formattedDiscountPrice = discountPrice.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }).replace('R$', '');
                                  
                                  // Update form with the formatted price as string
                                  form.setValue("discountPrice", formattedDiscountPrice);
                                }
                              } catch (error) {
                                console.error("Error calculating discount:", error);
                              }
                            }}
                          />
                          <span className="absolute right-3 top-[9px] text-muted-foreground">
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>Percentual de desconto aplicado</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Hidden field for discountPrice that gets calculated automatically */}
                <input type="hidden" {...form.register("discountPrice")} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (minutos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="5" 
                          step="5" 
                          placeholder="30" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Tempo estimado do serviço</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Ativo</FormLabel>
                        <FormDescription>
                          Serviços inativos não são exibidos para pacientes
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
              </div>

              {/* Nota informativa sobre serviços em destaque */}
              <div className="flex flex-row items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="space-y-0.5">
                  <h4 className="text-base font-medium text-yellow-800">Serviços em Destaque</h4>
                  <p className="text-sm text-yellow-700">
                    Serviços em destaque aparecem com prioridade na busca dos pacientes. 
                    Entre em contato com a administração para solicitar que seu serviço seja destacado.
                  </p>
                </div>
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              
              {/* Campo escondido para manter compatibilidade */}
              <input type="hidden" {...form.register("isFeatured")} value="false" />

              <FormField
                control={form.control}
                name="serviceImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagem do Serviço</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        <Input
                          type="text"
                          placeholder="URL da imagem ou string em base64"
                          {...field}
                        />
                        {field.value && (
                          <div className="mt-2 rounded-md overflow-hidden border w-full max-w-[200px]">
                            <img 
                              src={field.value} 
                              alt="Preview da imagem do serviço" 
                              className="w-full h-auto object-cover aspect-video"
                              onError={(e) => {
                                // Esconde a imagem se houver erro ao carregá-la
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Cole uma URL de imagem ou o código base64 da imagem. Se não informado, a imagem do perfil do parceiro será usada.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={createServiceMutation.isPending || updateServiceMutation.isPending}>
                  {(createServiceMutation.isPending || updateServiceMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? "Salvando..." : "Criando..."}
                    </>
                  ) : (
                    isEditing ? "Salvar Alterações" : "Adicionar Serviço"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PartnerServicesPage;