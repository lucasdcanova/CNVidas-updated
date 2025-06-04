import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { createAppointment, getPartnerServicesByPartnerId } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Service } from "@/shared/types";
import { appointmentSchema } from '@shared/schema';

// Schema do formulário de agendamento
const appointmentFormSchema = appointmentSchema.extend({
  appointmentDate: z.string().min(1, "A data da consulta é obrigatória"),
  appointmentTime: z.string().min(1, "O horário da consulta é obrigatório"),
});

// Inferir o tipo do schema
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentFormProps {
  initialServiceId?: number;
  initialPartnerId?: number;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ 
  initialServiceId,
  initialPartnerId
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: services = [] } = useQuery({
    queryKey: ["/api/services", initialPartnerId],
    queryFn: () => initialPartnerId ? getPartnerServicesByPartnerId(initialPartnerId) : [],
    enabled: !!initialPartnerId,
  });

  // Create a combined date and time from separate inputs
  const combineDateAndTime = (date: string, time: string): string => {
    return `${date}T${time}:00`;
  };

  // Default form values
  const defaultValues: Partial<AppointmentFormValues> = {
    userId: user?.id,
    serviceId: initialServiceId,
    type: "telemedicine",
    duration: 30,
    status: "scheduled",
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: "10:00",
  };

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: AppointmentFormValues) => {
    if (!user) {
      toast({
        title: "Erro ao agendar consulta",
        description: "Você precisa estar logado para agendar uma consulta",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Combine date and time
      const dateTime = combineDateAndTime(data.appointmentDate, data.appointmentTime);
      
      // Prepare appointment data
      const appointmentData = {
        userId: user.id,
        serviceId: data.serviceId,
        type: data.type,
        date: dateTime,
        duration: data.duration,
        status: "scheduled",
        specialization: data.specialization,
        doctorName: data.doctorName,
      };
      
      // Submit the appointment
      await createAppointment(appointmentData);
      
      toast({
        title: "Consulta agendada com sucesso",
        description: "Sua consulta foi agendada. Você receberá uma confirmação em breve.",
      });
      
      // Redirect to telemedicine page
      navigate("/telemedicine");
    } catch (error) {
      toast({
        title: "Erro ao agendar consulta",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao agendar sua consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected service from the list
  const selectedService = services.find((service: Service) => service.id === form.watch("serviceId"));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Consulta</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="telemedicine">Telemedicina</SelectItem>
                  <SelectItem value="in-person">Presencial</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {initialPartnerId && (
          <FormField
            control={form.control}
            name="serviceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serviço</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                  disabled={isSubmitting || !services.length}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {services.map((service: Service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name} - R$ {(service.discountPrice / 100).toFixed(2).replace('.', ',')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="specialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Especialidade</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Clínica Geral, Psicologia, etc."
                    disabled={isSubmitting}
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="doctorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do(a) Médico(a)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Dr. João Silva"
                    disabled={isSubmitting}
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="appointmentDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da Consulta</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="appointmentTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horário</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duração (minutos)</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                value={field.value?.toString()}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a duração" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {selectedService && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Detalhes do Serviço Selecionado</h3>
            <p className="text-sm text-gray-600 mt-1">{selectedService.description}</p>
            <div className="mt-2 flex items-center">
              <p className="text-xs text-gray-500 line-through mr-2">
                R$ {(selectedService.regularPrice / 100).toFixed(2).replace('.', ',')}
              </p>
              <p className="text-base font-bold text-primary-600">
                R$ {(selectedService.discountPrice / 100).toFixed(2).replace('.', ',')}
              </p>
              <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                {selectedService.discountPercentage}% OFF
              </span>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/telemedicine")}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agendando
              </>
            ) : (
              "Agendar Consulta"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AppointmentForm;
