import { useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { AddressFormValues } from '@/components/forms/address-form-optimized';

interface UseAddressFormProps<T> {
  form: UseFormReturn<T>;
  fieldMapping: {
    zipcode: keyof T;
    street: keyof T;
    number: keyof T;
    complement: keyof T;
    neighborhood: keyof T;
    city: keyof T;
    state: keyof T;
    address?: keyof T; // Campo de endereço completo (legado)
  };
}

export function useAddressForm<T>({ form, fieldMapping }: UseAddressFormProps<T>) {
  // Usar ref para evitar re-renders desnecessários
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Callback otimizado para atualizar os campos de endereço
  const updateAddressFields = useCallback((addressData: AddressFormValues) => {
    // Cancelar qualquer atualização pendente
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Debounce as atualizações para evitar múltiplas renderizações
    updateTimeoutRef.current = setTimeout(() => {
      // Atualizar cada campo com shouldDirty para marcar como modificado
      form.setValue(fieldMapping.zipcode as any, addressData.zipcode, { 
        shouldDirty: true,
        shouldValidate: false // Evitar validação durante digitação
      });
      
      form.setValue(fieldMapping.street as any, addressData.street, { 
        shouldDirty: true,
        shouldValidate: false 
      });
      
      form.setValue(fieldMapping.number as any, addressData.number, { 
        shouldDirty: true,
        shouldValidate: false 
      });
      
      form.setValue(fieldMapping.complement as any, addressData.complement || '', { 
        shouldDirty: true,
        shouldValidate: false 
      });
      
      form.setValue(fieldMapping.neighborhood as any, addressData.neighborhood, { 
        shouldDirty: true,
        shouldValidate: false 
      });
      
      form.setValue(fieldMapping.city as any, addressData.city, { 
        shouldDirty: true,
        shouldValidate: false 
      });
      
      form.setValue(fieldMapping.state as any, addressData.state, { 
        shouldDirty: true,
        shouldValidate: false 
      });
      
      // Se houver campo de endereço completo (legado), atualizar também
      if (fieldMapping.address) {
        const fullAddress = `${addressData.street}, ${addressData.number}${
          addressData.complement ? `, ${addressData.complement}` : ''
        } - ${addressData.neighborhood} - ${addressData.city}/${addressData.state} - CEP: ${addressData.zipcode}`;
        
        form.setValue(fieldMapping.address as any, fullAddress, { 
          shouldDirty: true,
          shouldValidate: false 
        });
      }
    }, 100); // Debounce de 100ms
  }, [form, fieldMapping]);
  
  // Função para obter os valores atuais dos campos de endereço
  const getAddressValues = useCallback((): AddressFormValues => {
    return {
      zipcode: form.watch(fieldMapping.zipcode as any) || '',
      street: form.watch(fieldMapping.street as any) || '',
      number: form.watch(fieldMapping.number as any) || '',
      complement: form.watch(fieldMapping.complement as any) || '',
      neighborhood: form.watch(fieldMapping.neighborhood as any) || '',
      city: form.watch(fieldMapping.city as any) || '',
      state: form.watch(fieldMapping.state as any) || '',
    };
  }, [form, fieldMapping]);
  
  return {
    updateAddressFields,
    getAddressValues,
  };
}