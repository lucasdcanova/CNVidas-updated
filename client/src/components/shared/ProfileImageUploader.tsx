import { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ImageCropper } from './ImageCropper';

interface ProfileImageUploaderProps {
  currentImage?: string | null;
  userName?: string;
  userType?: 'patient' | 'doctor' | 'partner';
  onImageUpdate?: (imageUrl: string) => void;
}

export default function ProfileImageUploader({
  currentImage,
  userName = 'Usuário',
  userType = 'patient',
  onImageUpdate
}: ProfileImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

      setSelectedFile(file);
      setShowCropper(true);
    }
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setShowCropper(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('profileImage', croppedImageBlob, 'profile.jpg');

      const response = await apiRequest('POST', '/api/profile/upload-image', formData);
      const data = await response.json();

      if (data.imageUrl) {
        // Atualizar cache do React Query
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        
        // Callback para atualizar imagem no componente pai
        if (onImageUpdate) {
          onImageUpdate(data.imageUrl);
        }

        // Mostrar indicador de sucesso
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
  };

  const handleRemoveImage = async () => {
    if (!confirm('Tem certeza que deseja remover sua foto de perfil?')) {
      return;
    }

    setIsUploading(true);

    try {
      await api.delete('/api/profile/upload-image');

      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      if (onImageUpdate) {
        onImageUpdate('');
      }

      toast({
        title: 'Sucesso!',
        description: 'Foto de perfil removida com sucesso.',
      });
    } catch (error: any) {
      console.error('Erro ao remover foto:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao remover sua foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getUserTypeLabel = () => {
    switch (userType) {
      case 'doctor':
        return 'Médico';
      case 'partner':
        return 'Parceiro';
      default:
        return 'Paciente';
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Foto de Perfil</h3>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <Avatar className="h-32 w-32">
                <AvatarImage 
                  src={currentImage || undefined} 
                  alt={userName}
                />
                <AvatarFallback className="text-2xl">
                  {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {uploadSuccess && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-full">
                  <Check className="h-12 w-12 text-green-600" />
                </div>
              )}
              
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Adicione uma foto de perfil para personalizar sua conta
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full sm:w-auto"
                >
                  {currentImage ? (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Alterar Foto
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Adicionar Foto
                    </>
                  )}
                </Button>

                {currentImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    disabled={isUploading}
                    className="w-full sm:w-auto text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover Foto
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar Foto de Perfil</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <ImageCropper
              image={selectedFile}
              onCropComplete={handleCropComplete}
              onCancel={() => {
                setShowCropper(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              aspectRatio={1}
              circularCrop
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}