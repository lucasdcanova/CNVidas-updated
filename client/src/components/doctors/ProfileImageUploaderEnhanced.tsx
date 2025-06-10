import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { ImageCropper } from "@/components/shared/ImageCropper";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface ProfileImageUploaderEnhancedProps {
  currentImageUrl?: string;
  userName?: string;
}

export const ProfileImageUploaderEnhanced: React.FC<ProfileImageUploaderEnhancedProps> = ({ 
  currentImageUrl, 
  userName = "Médico" 
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
    
    // Exibir imagem no cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setShowCropper(true);
      setUploadSuccess(false);
    };
    reader.readAsDataURL(file);
  };

  // Função para processar imagem cortada
  const handleCroppedImage = (croppedDataUrl: string) => {
    setCroppedImage(croppedDataUrl);
    setShowCropper(false);
    // Fazer upload automaticamente após cortar
    uploadImage(croppedDataUrl);
  };

  // Função para converter base64 para blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Função para fazer upload da imagem
  const uploadImage = async (imageDataUrl: string) => {
    try {
      setUploading(true);
      setUploadSuccess(false);
      
      // Converter base64 para blob
      const blob = dataURLtoBlob(imageDataUrl);
      
      // Criar FormData
      const formData = new FormData();
      formData.append('profileImage', blob, 'profile.jpg');
      
      // Enviar requisição para o servidor
      const response = await fetch('/api/profile/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          // Não definir Content-Type - deixar o browser definir automaticamente para multipart/form-data
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}`);
      }
      
      const result = await response.json();
      
      // Mostrar sucesso
      setUploadSuccess(true);
      toast({
        title: "Foto atualizada com sucesso!",
        description: "Sua foto de perfil foi atualizada.",
      });
      
      // Limpar o preview e o input após 2 segundos
      setTimeout(() => {
        setCroppedImage(null);
        setUploadSuccess(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
      
      // Atualizar os dados do usuário
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/profile'] });
      
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro ao atualizar foto",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao enviar a imagem",
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

  // Função para obter iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          <h3 className="text-lg font-semibold">Foto de Perfil</h3>
          
          {/* Avatar atual ou preview */}
          <div className="relative">
            <Avatar className="w-32 h-32">
              <AvatarImage 
                src={croppedImage || currentImageUrl} 
                alt={userName} 
              />
              <AvatarFallback className="text-2xl">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            
            {/* Indicador de status */}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
            
            {uploadSuccess && !uploading && (
              <div className="absolute inset-0 bg-green-500/20 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-300">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            )}
            
            {/* Botão de câmera */}
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-0 right-0 rounded-full shadow-lg"
              onClick={triggerFileInput}
              disabled={uploading}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>

          {/* Status text */}
          {uploading && (
            <p className="text-sm text-muted-foreground">Enviando foto...</p>
          )}
          
          {uploadSuccess && !uploading && (
            <p className="text-sm text-green-600 font-medium">Foto atualizada com sucesso!</p>
          )}

          {/* Input de arquivo (oculto) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Botão alternativo */}
          <Button 
            variant="outline" 
            onClick={triggerFileInput}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Escolher Nova Foto
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB
          </p>
        </div>
      </CardContent>

      {/* Modal do Image Cropper */}
      {showCropper && selectedImage && (
        <ImageCropper
          imageSrc={selectedImage}
          onCropComplete={handleCroppedImage}
          onCancel={() => {
            setShowCropper(false);
            setSelectedImage(null);
          }}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </Card>
  );
};