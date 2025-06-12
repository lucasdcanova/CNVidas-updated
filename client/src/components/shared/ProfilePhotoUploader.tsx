import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, Loader2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ImageCropper } from './ImageCropper';
import { apiRequest } from '@/lib/queryClient';

interface ProfilePhotoUploaderProps {
  currentImage?: string | null;
  userName?: string;
  userType?: 'patient' | 'doctor' | 'partner';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showRemoveButton?: boolean;
  onImageUpdate?: (imageUrl: string | null) => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40'
};

const buttonSizes = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12'
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6'
};

export default function ProfilePhotoUploader({
  currentImage,
  userName = 'Usuário',
  userType = 'patient',
  size = 'lg',
  showRemoveButton = true,
  onImageUpdate,
  className = ''
}: ProfilePhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(currentImage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Função para obter as iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  // Manipular seleção de arquivo
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de tipo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione apenas arquivos de imagem.',
        variant: 'destructive',
      });
      return;
    }

    // Validação de tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 5MB.',
        variant: 'destructive',
      });
      return;
    }

    // Criar URL para o cropper
    const imageUrl = URL.createObjectURL(file);
    setSelectedImageUrl(imageUrl);
    setShowCropper(true);
    setUploadSuccess(false);
  }, [toast]);

  // Função para fazer upload da imagem cropada
  const handleCropComplete = useCallback(async (croppedImageBlob: Blob) => {
    setShowCropper(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('profileImage', croppedImageBlob, 'profile.jpg');

      // Escolher endpoint baseado no tipo de usuário
      let endpoint = '/api/profile/upload-image';
      if (userType === 'doctor') {
        endpoint = '/api/doctors/profile-image';
      } else if (userType === 'partner') {
        endpoint = '/api/partners/profile-image';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Auth-Token': localStorage.getItem('auth_token') || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      const result = await response.json();
      const imageUrl = result.imageUrl || result.profileImage || result.url;

      if (imageUrl) {
        setPreviewImage(imageUrl);
        onImageUpdate?.(imageUrl);

        // Mostrar sucesso
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);

        toast({
          title: 'Sucesso!',
          description: 'Foto de perfil atualizada com sucesso.',
        });
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro ao fazer upload',
        description: error.message || 'Ocorreu um erro ao atualizar sua foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [userType, onImageUpdate, toast]);

  // Função para remover imagem
  const handleRemoveImage = useCallback(async () => {
    try {
      setIsUploading(true);

      let endpoint = '/api/profile/remove-image';
      if (userType === 'doctor') {
        endpoint = '/api/doctors/remove-profile-image';
      } else if (userType === 'partner') {
        endpoint = '/api/partners/remove-profile-image';
      }

      const response = await apiRequest('DELETE', endpoint);

      if (response.ok) {
        setPreviewImage(null);
        onImageUpdate?.(null);
        toast({
          title: 'Sucesso',
          description: 'Foto de perfil removida com sucesso.',
        });
      }
    } catch (error: any) {
      console.error('Erro ao remover imagem:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a foto de perfil.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [userType, onImageUpdate, toast]);

  // Cancelar cropper
  const handleCropCancel = useCallback(() => {
    setShowCropper(false);
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
      setSelectedImageUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedImageUrl]);

  // Trigger file input
  const triggerFileInput = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  return (
    <>
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Avatar com indicadores de status */}
            <div className="relative">
              <Avatar className={`${sizeClasses[size]} border-2 border-border`}>
                <AvatarImage 
                  src={previewImage || undefined} 
                  alt={userName}
                  className="object-cover"
                />
                <AvatarFallback className="text-lg font-medium">
                  {previewImage ? (
                    <User className={iconSizes[size]} />
                  ) : (
                    getInitials(userName)
                  )}
                </AvatarFallback>
              </Avatar>

              {/* Overlay de carregamento */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className={`${iconSizes[size]} text-white animate-spin`} />
                </div>
              )}

              {/* Overlay de sucesso */}
              {uploadSuccess && !isUploading && (
                <div className="absolute inset-0 bg-green-500/20 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <Check className={`${iconSizes[size]} text-green-600`} />
                </div>
              )}

              {/* Botão de câmera */}
              <Button
                size="icon"
                variant="secondary"
                className={`absolute bottom-0 right-0 rounded-full shadow-lg ${buttonSizes[size]}`}
                onClick={triggerFileInput}
                disabled={isUploading}
              >
                <Camera className={iconSizes[size]} />
              </Button>
            </div>

            {/* Status e informações */}
            <div className="text-center space-y-2">
              {isUploading && (
                <p className="text-sm text-muted-foreground font-medium">
                  Enviando foto...
                </p>
              )}
              
              {uploadSuccess && !isUploading && (
                <p className="text-sm text-green-600 font-medium">
                  Foto atualizada com sucesso!
                </p>
              )}

              {!isUploading && !uploadSuccess && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {previewImage ? 'Clique na câmera para alterar' : 'Adicione uma foto de perfil'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou GIF. Máximo 5MB
                  </p>
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                onClick={triggerFileInput}
                disabled={isUploading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {previewImage ? 'Alterar' : 'Adicionar'}
              </Button>

              {previewImage && showRemoveButton && (
                <Button
                  variant="outline"
                  onClick={handleRemoveImage}
                  disabled={isUploading}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>

            {/* Input de arquivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cropper Modal */}
      {showCropper && selectedImageUrl && (
        <ImageCropper
          imageUrl={selectedImageUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          isOpen={showCropper}
        />
      )}
    </>
  );
} 