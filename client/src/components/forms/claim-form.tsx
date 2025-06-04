import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { createClaim } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

// Schema do formulário de sinistro
const claimFormSchema = z.object({
  userId: z.number(),
  type: z.string(),
  occurrenceDate: z.string(),
  description: z.string(),
  documents: z.array(z.string()).optional(),
  termsAgreed: z.boolean().refine(val => val === true, {
    message: "Você precisa concordar com os termos para enviar o sinistro",
  }),
});

// Inferir o tipo do schema
type ClaimFormValues = z.infer<typeof claimFormSchema>;

export const ClaimForm: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Default form values
  const defaultValues: Partial<ClaimFormValues> = {
    userId: user?.id,
    type: "",
    occurrenceDate: new Date().toISOString().split('T')[0],
    description: "",
    termsAgreed: false,
  };

  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimFormSchema),
    defaultValues,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      setUploadedFiles(fileArray);
    }
  };

  const onSubmit = async (data: ClaimFormValues) => {
    if (!user) {
      toast({
        title: "Erro ao enviar sinistro",
        description: "Você precisa estar logado para enviar um sinistro",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create a FormData object to handle the file uploads
      const formData = new FormData();
      
      // Add the claim data
      formData.append("userId", String(user.id));
      formData.append("type", data.type);
      formData.append("occurrenceDate", data.occurrenceDate);
      formData.append("description", data.description);
      
      // Add files if any
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach(file => {
          formData.append("documents", file);
        });
      }
      
      // Submit the claim
      await createClaim(formData);
      
      toast({
        title: "Sinistro enviado com sucesso",
        description: "Seu sinistro foi enviado e está sendo analisado.",
      });
      
      // Redirect to claims page
      navigate("/claims");
    } catch (error) {
      toast({
        title: "Erro ao enviar sinistro",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao enviar seu sinistro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Sinistro</FormLabel>
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
                    <SelectItem value="Acidente Pessoal">Acidente Pessoal</SelectItem>
                    <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                    <SelectItem value="Diária Hospitalar">Diária Hospitalar</SelectItem>
                    <SelectItem value="Diagnóstico de Doença Grave">Diagnóstico de Doença Grave</SelectItem>
                    <SelectItem value="Internação">Internação</SelectItem>
                    <SelectItem value="Tratamento Médico">Tratamento Médico</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="occurrenceDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da Ocorrência</FormLabel>
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
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição Detalhada</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva detalhadamente o ocorrido, informando tratamentos, diagnósticos e outras informações relevantes."
                  className="min-h-[120px]"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div>
          <FormLabel>Documentos</FormLabel>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label htmlFor="fileUpload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                  <span>Carregar arquivos</span>
                  <input
                    id="fileUpload"
                    name="documents"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    multiple
                    disabled={isSubmitting}
                  />
                </label>
                <p className="pl-1">ou arraste e solte</p>
              </div>
              <p className="text-xs text-gray-500">
                Laudos médicos, receitas, comprovantes, relatórios (PDF, JPG, PNG)
              </p>
              {uploadedFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700">{uploadedFiles.length} arquivo(s) selecionado(s)</p>
                  <ul className="mt-1 text-xs text-gray-500 list-disc list-inside">
                    {uploadedFiles.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <FormField
            control={form.control}
            name="termsAgreed"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Declaro que as informações são verdadeiras</FormLabel>
                  <p className="text-sm text-gray-500">
                    Estou ciente que informações falsas podem resultar no cancelamento do sinistro e outras penalidades previstas.
                  </p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/claims")}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando
              </>
            ) : (
              "Enviar Sinistro"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ClaimForm;
