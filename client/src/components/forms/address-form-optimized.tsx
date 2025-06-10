import React, { useState, useCallback, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Esquema de validação para endereço
const addressSchema = z.object({
  zipcode: z.string().min(8, 'CEP deve ter 8 dígitos').max(9, 'CEP deve ter no máximo 9 caracteres'),
  street: z.string().min(1, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(2, 'Estado é obrigatório').max(2, 'Use a sigla do estado (ex: SP)'),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

interface AddressFormOptimizedProps {
  defaultValues?: Partial<AddressFormValues>;
  onSubmit: (data: AddressFormValues) => void;
  isSubmitting?: boolean;
  showSubmitButton?: boolean;
  title?: string;
  description?: string;
  standAlone?: boolean;
  isReadOnly?: boolean;
}

// Componente memo para evitar re-renders desnecessários
export const AddressFormOptimized = memo(({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  showSubmitButton = true,
  title,
  description,
  standAlone = true,
  isReadOnly = false,
}: AddressFormOptimizedProps) => {
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  
  // Inicializar o formulário com defaultValues
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      zipcode: defaultValues?.zipcode || '',
      street: defaultValues?.street || '',
      number: defaultValues?.number || '',
      complement: defaultValues?.complement || '',
      neighborhood: defaultValues?.neighborhood || '',
      city: defaultValues?.city || '',
      state: defaultValues?.state || '',
    },
    // Importante: não fazer reset automático quando defaultValues mudam
    // Isso preserva os valores digitados pelo usuário
    mode: 'onChange',
  });

  // Função para buscar endereço pelo CEP usando nossa API interna
  const fetchAddressByCep = useCallback(async (cep: string) => {
    // Remover caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, '');
    
    // Validar CEP
    if (cleanCep.length !== 8) {
      setCepError('CEP deve ter 8 dígitos');
      return;
    }
    
    setCepError(null);
    setIsSearchingCep(true);
    
    try {
      console.log(`Buscando endereço para o CEP: ${cleanCep}`);
      
      // Usar nossa própria API para buscar o CEP
      const response = await axios.get(`/api/address/cep?cep=${cleanCep}`);
      const data = response.data;
      
      console.log('Dados do endereço encontrados:', data);
      
      // Preencher os campos do formulário com os dados do endereço
      // Usar setValue com shouldValidate e shouldDirty para garantir que o formulário seja atualizado
      form.setValue('street', data.street || '', { shouldValidate: true, shouldDirty: true });
      form.setValue('neighborhood', data.neighborhood || '', { shouldValidate: true, shouldDirty: true });
      form.setValue('city', data.city || '', { shouldValidate: true, shouldDirty: true });
      form.setValue('state', data.state || '', { shouldValidate: true, shouldDirty: true });
      
      // Chamar onSubmit com os valores atualizados para sincronizar com o formulário pai
      const currentValues = form.getValues();
      onSubmit({
        ...currentValues,
        street: data.street || currentValues.street,
        neighborhood: data.neighborhood || currentValues.neighborhood,
        city: data.city || currentValues.city,
        state: data.state || currentValues.state,
      });
      
      // Manter o foco no campo de número após preencher o endereço
      setTimeout(() => {
        const numberInput = document.getElementById('number');
        if (numberInput) {
          numberInput.focus();
        }
      }, 100);
      
    } catch (error: any) {
      console.error('Erro ao buscar CEP:', error);
      
      if (error.response?.status === 404) {
        setCepError('CEP não encontrado. Verifique o número digitado.');
      } else {
        setCepError('Erro ao buscar CEP. Tente novamente mais tarde.');
      }
    } finally {
      setIsSearchingCep(false);
    }
  }, [form, onSubmit]);

  // Formatar o CEP enquanto digita (99999-999)
  const formatCep = useCallback((value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 5) {
      return cleanValue;
    }
    return `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`;
  }, []);

  // Handle submit otimizado
  const handleSubmit = useCallback((data: AddressFormValues) => {
    // Limpar formatação do CEP antes de enviar
    const formattedData = {
      ...data,
      zipcode: data.zipcode.replace(/\D/g, ''),
    };
    
    console.log("Enviando dados de endereço:", formattedData);
    onSubmit(formattedData);
  }, [onSubmit]);

  // Handle field change - atualizar o formulário pai em tempo real
  const handleFieldChange = useCallback((fieldName: keyof AddressFormValues, value: string) => {
    // Atualizar o valor no formulário local
    form.setValue(fieldName, value, { shouldValidate: true, shouldDirty: true });
    
    // Obter todos os valores atuais e enviar para o formulário pai
    const currentValues = form.getValues();
    onSubmit(currentValues);
  }, [form, onSubmit]);

  const formFields = (
    <>
      {title && <h3 className="text-lg font-medium">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      
      {cepError && (
        <Alert variant="destructive" className="animate-slide-up mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{cepError}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-1/3">
          <FormField
            control={form.control}
            name="zipcode"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="zipcode"
                      name="zipcode"
                      placeholder="00000-000"
                      disabled={isSubmitting || isReadOnly}
                      value={formatCep(field.value)}
                      onChange={(e) => {
                        const formatted = formatCep(e.target.value);
                        field.onChange(formatted);
                        handleFieldChange('zipcode', formatted);
                        
                        // Se o CEP tiver 8 dígitos, buscar endereço automaticamente
                        if (e.target.value.replace(/\D/g, '').length === 8) {
                          fetchAddressByCep(e.target.value);
                        }
                      }}
                      className="pr-10 transition-all duration-300 hover:shadow-sm focus:shadow-md"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => fetchAddressByCep(field.value)}
                      disabled={isSearchingCep || !field.value || field.value.replace(/\D/g, '').length !== 8}
                    >
                      {isSearchingCep ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="md:w-2/3">
          <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rua</FormLabel>
                <FormControl>
                  <Input
                    id="street"
                    placeholder="Nome da rua"
                    disabled={isSubmitting || isReadOnly}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange('street', e.target.value);
                    }}
                    className="transition-all duration-300 hover:shadow-sm focus:shadow-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-1/4">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl>
                  <Input
                    id="number"
                    placeholder="123"
                    disabled={isSubmitting || isReadOnly}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange('number', e.target.value);
                    }}
                    className="transition-all duration-300 hover:shadow-sm focus:shadow-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="md:w-3/4">
          <FormField
            control={form.control}
            name="complement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl>
                  <Input
                    id="complement"
                    placeholder="Apto 101, Bloco B, etc."
                    disabled={isSubmitting || isReadOnly}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange('complement', e.target.value);
                    }}
                    className="transition-all duration-300 hover:shadow-sm focus:shadow-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
      
      <FormField
        control={form.control}
        name="neighborhood"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bairro</FormLabel>
            <FormControl>
              <Input
                id="neighborhood"
                placeholder="Nome do bairro"
                disabled={isSubmitting || isReadOnly}
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  handleFieldChange('neighborhood', e.target.value);
                }}
                className="transition-all duration-300 hover:shadow-sm focus:shadow-md"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-3/4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input
                    id="city"
                    placeholder="Nome da cidade"
                    disabled={isSubmitting || isReadOnly}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange('city', e.target.value);
                    }}
                    className="transition-all duration-300 hover:shadow-sm focus:shadow-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="md:w-1/4">
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Input
                    id="state"
                    placeholder="UF"
                    disabled={isSubmitting || isReadOnly}
                    maxLength={2}
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      field.onChange(value);
                      handleFieldChange('state', value);
                    }}
                    className="transition-all duration-300 hover:shadow-sm focus:shadow-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
      
      {standAlone && showSubmitButton && (
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary-action"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : "Salvar Endereço"}
          </Button>
        </div>
      )}
    </>
  );

  // Se não for um formulário independente, apenas renderiza os campos
  if (!standAlone) {
    return (
      <Form {...form}>
        <div className="space-y-4 animate-fade-in">
          {formFields}
        </div>
      </Form>
    );
  }

  // Caso contrário, renderiza um formulário completo
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 animate-fade-in">
        {formFields}
      </form>
    </Form>
  );
});

AddressFormOptimized.displayName = 'AddressFormOptimized';