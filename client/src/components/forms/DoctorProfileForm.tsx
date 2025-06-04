import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const doctorProfileSchema = z.object({
  specialization: z.string().min(1, "Especialização é obrigatória"),
  licenseNumber: z.string().min(1, "Número do registro é obrigatório"),
  biography: z.string().optional(),
  education: z.string().optional(),
  experienceYears: z.number().min(0).optional(),
  consultationFee: z.number().min(0).optional(),
});

type DoctorProfileFormValues = z.infer<typeof doctorProfileSchema>;

interface DoctorProfileFormProps {
  initialData?: Partial<DoctorProfileFormValues>;
  onSuccess?: () => void;
}

export default function DoctorProfileForm({ initialData, onSuccess }: DoctorProfileFormProps) {
  const { toast } = useToast();
  const form = useForm<DoctorProfileFormValues>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      specialization: initialData?.specialization || "",
      licenseNumber: initialData?.licenseNumber || "",
      biography: initialData?.biography || "",
      education: initialData?.education || "",
      experienceYears: initialData?.experienceYears || 0,
      consultationFee: initialData?.consultationFee || 0,
    },
  });

  const onSubmit = async (data: DoctorProfileFormValues) => {
    try {
      await apiRequest("PUT", "/api/doctors/profile", data);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro ao atualizar perfil",
        description: "Ocorreu um erro ao atualizar suas informações. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="specialization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Especialização</FormLabel>
              <FormControl>
                <Input placeholder="Sua especialização médica" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="licenseNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número do Registro Profissional</FormLabel>
              <FormControl>
                <Input placeholder="Seu número de registro" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="biography"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Biografia</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Conte um pouco sobre sua experiência e formação"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="education"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Formação</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Sua formação acadêmica"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="experienceYears"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Anos de Experiência</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="consultationFee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor da Consulta (R$)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Salvar Alterações
        </Button>
      </form>
    </Form>
  );
} 