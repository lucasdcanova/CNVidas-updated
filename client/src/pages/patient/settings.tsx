import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Bell, Shield, Clock, Mail, Phone, Lock, UserPlus, Eye, EyeOff } from "lucide-react";

// Schema para validação de formulário de preferências de notificação
const notificationSchema = z.object({
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  pushNotifications: z.boolean().default(true),
  notificationFrequency: z.enum(["immediate", "daily", "weekly"]).default("immediate"),
  appointmentReminders: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
});

// Schema para validação de formulário de privacidade
const privacySchema = z.object({
  shareWithDoctors: z.boolean().default(true),
  shareWithPartners: z.boolean().default(false),
  shareFullMedicalHistory: z.boolean().default(false),
  allowAnonymizedDataUse: z.boolean().default(true),
  profileVisibility: z.enum(["public", "contacts", "private"]).default("contacts"),
});

type NotificationSettings = z.infer<typeof notificationSchema>;
type PrivacySettings = z.infer<typeof privacySchema>;

const PatientSettings = () => {
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useUser();
  const [activeTab, setActiveTab] = useState("notifications");
  
  // Carregar configurações atuais do usuário
  const { data: userSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["/api/users/settings"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/users/settings", {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.log("Erro ao carregar configurações, usando valores padrão:", error);
        // Retornar valores padrão se houver erro
        return {
          notifications: {
            emailNotifications: true,
            smsNotifications: false,
            pushNotifications: true,
            notificationFrequency: "immediate",
            appointmentReminders: true,
            marketingEmails: false,
          },
          privacy: {
            shareWithDoctors: true,
            shareWithPartners: false,
            shareFullMedicalHistory: false,
            allowAnonymizedDataUse: true,
            profileVisibility: "contacts",
          }
        };
      }
    },
    enabled: !!user,
  });

  // Formulário de preferências de notificação
  const notificationForm = useForm<NotificationSettings>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      notificationFrequency: "immediate",
      appointmentReminders: true,
      marketingEmails: false,
    },
  });

  // Formulário de privacidade
  const privacyForm = useForm<PrivacySettings>({
    resolver: zodResolver(privacySchema),
    defaultValues: {
      shareWithDoctors: true,
      shareWithPartners: false,
      shareFullMedicalHistory: false,
      allowAnonymizedDataUse: true,
      profileVisibility: "contacts",
    },
  });

  // Atualizar formulários quando os dados são carregados
  React.useEffect(() => {
    if (userSettings) {
      if (userSettings.notifications) {
        notificationForm.reset(userSettings.notifications);
      }
      if (userSettings.privacy) {
        privacyForm.reset(userSettings.privacy);
      }
    }
  }, [userSettings, notificationForm, privacyForm]);

  // Mutation para salvar configurações
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/users/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar configurações: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "Suas preferências foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/settings"] });
    },
    onError: (error) => {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Handler para salvar preferências de notificação
  const onNotificationSubmit = (data: NotificationSettings) => {
    saveSettingsMutation.mutateAsync({
      notifications: data
    });
  };

  // Handler para salvar configurações de privacidade
  const onPrivacySubmit = (data: PrivacySettings) => {
    saveSettingsMutation.mutateAsync({
      privacy: data
    });
  };

  if (isUserLoading || isSettingsLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4 max-w-4xl animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded mb-8 w-2/3"></div>
          <div className="grid gap-6">
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Acesso Negado</CardTitle>
              <CardDescription>
                É necessário estar logado para acessar esta página.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-primary animate-fade-in">Configurações da Conta</h1>
        <p className="text-gray-500 mb-6 animate-fade-in delay-100">
          Gerencie suas preferências e ajuste como a plataforma funciona para você.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up">
          <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span>Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Privacidade</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Configure como e quando deseja receber notificações da plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationForm}>
                  <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                    <div className="grid gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Canais de Notificação</h3>
                        <Separator />
                        
                        <FormField
                          control={notificationForm.control}
                          name="emailNotifications"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <Mail className="w-5 h-5 text-primary" />
                                  Notificações por Email
                                </FormLabel>
                                <FormDescription>
                                  Receba notificações e atualizações no seu email.
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
                        
                        <FormField
                          control={notificationForm.control}
                          name="smsNotifications"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <Phone className="w-5 h-5 text-primary" />
                                  Notificações por SMS
                                </FormLabel>
                                <FormDescription>
                                  Receba lembretes e alertas importantes via SMS.
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
                        
                        <FormField
                          control={notificationForm.control}
                          name="pushNotifications"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <Bell className="w-5 h-5 text-primary" />
                                  Notificações Push
                                </FormLabel>
                                <FormDescription>
                                  Receba notificações instantâneas no navegador ou aplicativo.
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
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Preferências de Frequência</h3>
                        <Separator />
                        
                        <FormField
                          control={notificationForm.control}
                          name="notificationFrequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                Frequência de Notificações
                              </FormLabel>
                              <FormDescription>
                                Defina com que frequência deseja receber notificações não urgentes.
                              </FormDescription>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full transition-all duration-300 hover:shadow-sm focus:shadow-md">
                                    <SelectValue placeholder="Selecione uma frequência" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="immediate">Imediatamente</SelectItem>
                                  <SelectItem value="daily">Resumo Diário</SelectItem>
                                  <SelectItem value="weekly">Resumo Semanal</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={notificationForm.control}
                          name="appointmentReminders"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Lembretes de Consulta</FormLabel>
                                <FormDescription>
                                  Receba lembretes sobre suas consultas agendadas.
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
                        
                        <FormField
                          control={notificationForm.control}
                          name="marketingEmails"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Emails Promocionais</FormLabel>
                                <FormDescription>
                                  Receba informações sobre novos serviços e ofertas.
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
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="transition-all duration-300 hover:shadow-md"
                        disabled={saveSettingsMutation.isPending || !notificationForm.formState.isDirty}
                      >
                        {saveSettingsMutation.isPending ? "Salvando..." : "Salvar Preferências"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Privacidade</CardTitle>
                <CardDescription>
                  Controle quem pode ver suas informações e como seus dados são compartilhados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...privacyForm}>
                  <form onSubmit={privacyForm.handleSubmit(onPrivacySubmit)} className="space-y-6">
                    <div className="grid gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Compartilhamento de Dados</h3>
                        <Separator />
                        
                        <FormField
                          control={privacyForm.control}
                          name="shareWithDoctors"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <UserPlus className="w-5 h-5 text-primary" />
                                  Compartilhar com Médicos
                                </FormLabel>
                                <FormDescription>
                                  Permitir que médicos da plataforma vejam seu histórico médico.
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
                        
                        <FormField
                          control={privacyForm.control}
                          name="shareWithPartners"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Compartilhar com Parceiros</FormLabel>
                                <FormDescription>
                                  Compartilhar dados com clínicas e parceiros da plataforma.
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
                        
                        <FormField
                          control={privacyForm.control}
                          name="shareFullMedicalHistory"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Histórico Médico Completo</FormLabel>
                                <FormDescription>
                                  Compartilhar seu histórico médico completo com prestadores de serviço.
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
                        
                        <FormField
                          control={privacyForm.control}
                          name="allowAnonymizedDataUse"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-300 hover:shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                  <Lock className="w-5 h-5 text-primary" />
                                  Uso de Dados Anonimizados
                                </FormLabel>
                                <FormDescription>
                                  Permitir o uso de seus dados de forma anônima para pesquisas e melhorias da plataforma.
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
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Visibilidade do Perfil</h3>
                        <Separator />
                        
                        <FormField
                          control={privacyForm.control}
                          name="profileVisibility"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" />
                                Visibilidade do Perfil
                              </FormLabel>
                              <FormDescription>
                                Defina quem pode ver informações do seu perfil na plataforma.
                              </FormDescription>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full transition-all duration-300 hover:shadow-sm focus:shadow-md">
                                    <SelectValue placeholder="Selecione uma opção" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="public">Público (Todos os usuários)</SelectItem>
                                  <SelectItem value="contacts">Somente Contatos (Médicos e clínicas que você consulta)</SelectItem>
                                  <SelectItem value="private">Privado (Apenas você e administradores)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="transition-all duration-300 hover:shadow-md"
                        disabled={saveSettingsMutation.isPending || !privacyForm.formState.isDirty}
                      >
                        {saveSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PatientSettings;