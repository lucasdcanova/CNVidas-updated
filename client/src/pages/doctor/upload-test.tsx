import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from '@/components/layouts/dashboard-layout';
import { Upload, Check, X } from 'lucide-react';

const DoctorProfileImageUploadTest = () => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Verificar se o usuário é médico
  if (user?.role !== 'doctor') {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Acesso Restrito</CardTitle>
              <CardDescription>Esta página é apenas para médicos.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Função para selecionar arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset states
    setError(null);
    setUploadSuccess(false);
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione apenas imagens (JPEG, PNG, etc.)');
      return;
    }
    
    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('O tamanho máximo permitido é 5MB');
      return;
    }
    
    // Exibir preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // Função para fazer upload
  const uploadImage = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      setError('Nenhuma imagem selecionada');
      return;
    }
    
    try {
      setUploading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('profileImage', fileInputRef.current.files[0]);
      
      // Obter o token de autenticação
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = token;
      }
      
      console.log('Enviando imagem com token:', token);
      
      // Enviar requisição
      const response = await fetch('/api/doctor-profile-image', {
        method: 'POST',
        body: formData,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      
      setUploadSuccess(true);
      toast({
        title: 'Sucesso!',
        description: 'Imagem de perfil atualizada com sucesso.',
      });
      
      console.log('Resposta do servidor:', result);
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao fazer upload');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao fazer upload da imagem',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Upload de Imagem</CardTitle>
            <CardDescription>
              Use esta página para testar o upload de imagem de perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-6">
              {/* Preview da imagem */}
              {preview ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary">
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
                  <Upload size={40} />
                </div>
              )}
              
              {/* Status indicators */}
              {uploadSuccess && (
                <div className="flex items-center text-green-600">
                  <Check className="mr-2" />
                  <span>Upload realizado com sucesso!</span>
                </div>
              )}
              
              {error && (
                <div className="flex items-center text-red-600">
                  <X className="mr-2" />
                  <span>{error}</span>
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
              <div className="flex space-x-4">
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Selecionar Imagem
                </Button>
                
                {preview && (
                  <Button 
                    variant="default" 
                    onClick={uploadImage}
                    disabled={uploading}
                  >
                    {uploading ? "Enviando..." : "Fazer Upload"}
                  </Button>
                )}
              </div>
              
              {/* Debug info */}
              <div className="mt-8 w-full text-xs text-gray-500 bg-gray-50 p-4 rounded">
                <h4 className="font-bold mb-2">Informações para Debug:</h4>
                <p>User ID: {user?.id}</p>
                <p>Role: {user?.role}</p>
                <p>AuthToken disponível: {localStorage.getItem('authToken') ? 'Sim' : 'Não'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DoctorProfileImageUploadTest;