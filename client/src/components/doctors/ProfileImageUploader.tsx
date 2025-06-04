import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

// Componente para upload de imagem de perfil do médico
export const DoctorProfileImageUploader: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Manipulador de seleção de arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione apenas imagens (JPEG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }
    
    // Validar tamanho do arquivo (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 5MB",
        variant: "destructive"
      });
      return;
    }
    
    // Exibir preview da imagem
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // Função para fazer upload da imagem
  const uploadImage = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Por favor, selecione uma imagem para fazer upload",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('profileImage', fileInputRef.current.files[0]);
      
      // Obter o token de autenticação salvo no localStorage
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = token;
      }
      
      // Log para debug
      console.log("Enviando imagem com token:", token);
      
      // Enviar requisição para o servidor
      const response = await fetch('/api/doctor-profile-image', {
        method: 'POST',
        body: formData,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      
      toast({
        title: "Imagem atualizada com sucesso",
        description: "Sua foto de perfil foi atualizada."
      });
      
      // Limpar o preview e o input
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Atualizar os dados do usuário e do médico no cache
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/profile'] });
      
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro ao atualizar imagem",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };
  
  // Função para abrir o seletor de arquivos
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="flex flex-col items-center space-y-4 p-4 border rounded-md">
      <h3 className="text-lg font-medium">Foto de Perfil</h3>
      
      {/* Preview da imagem */}
      {imagePreview && (
        <div className="relative w-32 h-32 rounded-full overflow-hidden mb-2">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      {/* Input de arquivo (oculto) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Botões */}
      <div className="flex space-x-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={triggerFileInput}
          disabled={uploading}
        >
          Selecionar Imagem
        </Button>
        
        {imagePreview && (
          <Button 
            type="button" 
            onClick={uploadImage}
            disabled={uploading}
          >
            {uploading ? "Enviando..." : "Enviar"}
          </Button>
        )}
      </div>
    </div>
  );
};