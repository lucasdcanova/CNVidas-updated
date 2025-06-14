import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, Loader2, User, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ImageCropper } from './ImageCropper';
import { apiRequest, queryClient } from '@/lib/queryClient';

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  // Função para comprimir imagem
  const compressImage = useCallback((file: File, quality: number = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calcular dimensões mantendo aspect ratio
        const maxWidth = 1200;
        const maxHeight = 1200;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Desenhar imagem redimensionada
        ctx?.drawImage(img, 0, 0, width, height);

        // Converter para blob com compressão
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Falha na compressão da imagem'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Falha ao carregar imagem para compressão'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Manipular seleção de arquivo
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);

    // Validação de tipo
    if (!file.type.startsWith('image/')) {
      const errorMsg = `Tipo de arquivo não suportado: ${file.type}. Use apenas imagens (JPG, PNG, GIF, WEBP).`;
      setUploadError(errorMsg);
      toast({
        title: 'Erro - Tipo de arquivo',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    // Validação de tamanho (50MB - será comprimido)
    if (file.size > 50 * 1024 * 1024) {
      const errorMsg = `Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo permitido: 50MB.`;
      setUploadError(errorMsg);
      toast({
        title: 'Erro - Tamanho do arquivo',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    console.log(`Arquivo selecionado: ${file.name}, Tamanho: ${(file.size / 1024 / 1024).toFixed(2)}MB, Tipo: ${file.type}`);

    // Criar URL para o cropper
    const imageUrl = URL.createObjectURL(file);
    setSelectedImageUrl(imageUrl);
    setShowCropper(true);
  }, [toast]);

  // Função para fazer upload da imagem cropada
  const handleCropComplete = useCallback(async (croppedImageBlob: Blob) => {
    setShowCropper(false);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    // Função auxiliar para fazer o upload com retry
    const performUpload = async (blob: Blob, retryCount = 0): Promise<any> => {
      console.log(`Tentativa de upload ${retryCount + 1}/3`);
      
      // Comprimir imagem se for maior que 500KB
      let finalBlob = blob;
      if (blob.size > 500 * 1024) {
        setUploadProgress(10);
        console.log('Comprimindo imagem...');
        
        try {
          // Tentar diferentes níveis de qualidade até conseguir um tamanho adequado
          let quality = 0.8;
          let compressedBlob = await compressImage(new File([blob], 'image.jpg'), quality);
          
          // Se ainda estiver muito grande, comprimir mais
          while (compressedBlob.size > 2 * 1024 * 1024 && quality > 0.3) {
            quality -= 0.1;
            compressedBlob = await compressImage(new File([blob], 'image.jpg'), quality);
          }
          
          finalBlob = compressedBlob;
          console.log(`Compressão concluída. Tamanho final: ${(finalBlob.size / 1024).toFixed(1)}KB (qualidade: ${quality})`);
        } catch (compressionError) {
          console.warn('Falha na compressão, usando imagem original:', compressionError);
          // Continuar com a imagem original se a compressão falhar
        }
      }

      setUploadProgress(30);

      const formData = new FormData();
      formData.append('profileImage', finalBlob, 'profile.jpg');

      // Escolher endpoint baseado no tipo de usuário
      let endpoint = '/api/profile/upload-image';
      if (userType === 'doctor') {
        endpoint = '/api/profile/doctors/profile-image';
      } else if (userType === 'partner') {
        endpoint = '/api/profile/partners/profile-image';
      }

      // Obter token de autenticação
      const authToken = localStorage.getItem('auth_token') || '';

      console.log('=== INICIANDO UPLOAD ===');
      console.log('Endpoint:', endpoint);
      console.log('Tipo de usuário:', userType);
      console.log(`Tamanho final do arquivo: ${(finalBlob.size / 1024).toFixed(1)}KB`);
      console.log('Auth token presente:', !!authToken);
      console.log('FormData criado:', formData.has('profileImage'));

      setUploadProgress(50);

      // Usar XMLHttpRequest para ter controle sobre o progresso
      return new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = 50 + Math.round((e.loaded / e.total) * 40); // 50-90%
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            console.log(`Upload progress: ${percentComplete}% (${e.loaded}/${e.total} bytes)`);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          console.log('=== UPLOAD LOAD EVENT ===');
          console.log('Status:', xhr.status);
          console.log('Response:', xhr.responseText.substring(0, 200) + '...');
          setUploadProgress(95);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              console.log('Upload bem-sucedido:', result);
              resolve(result);
            } catch (e) {
              console.error('Erro ao parsear resposta:', e);
              reject(new Error('Resposta inválida do servidor'));
            }
          } else {
            let errorMessage = `Erro HTTP ${xhr.status}`;
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.message || errorMessage;
            } catch (e) {
              errorMessage = `${errorMessage}: ${xhr.statusText}`;
            }
            console.error('Erro HTTP:', errorMessage);
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('=== UPLOAD ERROR EVENT ===');
          console.error('ReadyState:', xhr.readyState);
          console.error('Status:', xhr.status);
          reject(new Error('Falha na conexão com o servidor'));
        });

        xhr.addEventListener('timeout', () => {
          console.error('=== UPLOAD TIMEOUT EVENT ===');
          console.error('ReadyState:', xhr.readyState);
          console.error('Status:', xhr.status);
          console.error('Timeout após 3 minutos');
          reject(new Error('Timeout - O upload demorou mais que 3 minutos. Tente com uma imagem menor ou verifique sua conexão.'));
        });

        xhr.open('POST', endpoint);
        xhr.setRequestHeader('X-Auth-Token', authToken);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.timeout = 180000; // 3 minutos para arquivos grandes
        xhr.send(formData);
      });
    };

    try {
      // Tentar upload com retry em caso de timeout
      let result;
      let lastError;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await performUpload(croppedImageBlob, attempt);
          break; // Sucesso, sair do loop
        } catch (error: any) {
          lastError = error;
          console.warn(`Tentativa ${attempt + 1} falhou:`, error.message);
          
          // Se for timeout e ainda há tentativas, tentar novamente
          if (error.message.includes('Timeout') && attempt < 2) {
            console.log('Tentando novamente em 2 segundos...');
            setUploadProgress(0);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          // Se não for timeout ou já esgotou tentativas, lançar erro
          throw error;
        }
      }
      
      if (!result) {
        throw lastError || new Error('Falha em todas as tentativas de upload');
      }
      
      setUploadProgress(100);
      
      console.log('Resultado do upload:', result);
      const imageUrl = result.imageUrl || result.profileImage || result.url;

      if (imageUrl) {
        setPreviewImage(imageUrl);
        onImageUpdate?.(imageUrl);

        // Invalidar todas as queries relacionadas ao usuário para forçar atualização
        queryClient.invalidateQueries({ queryKey: ['/api/user'] }); // Query principal do useAuth
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/users/profile'] });
        
        // Para médicos
        if (userType === 'doctor') {
          queryClient.invalidateQueries({ queryKey: ['/api/doctors/profile'] });
          queryClient.invalidateQueries({ queryKey: ['/api/doctors/user'] });
          queryClient.invalidateQueries({ queryKey: ['/api/doctors'] });
        }
        
        // Para parceiros
        if (userType === 'partner') {
          queryClient.invalidateQueries({ queryKey: ['/api/partners/me'] });
          queryClient.invalidateQueries({ queryKey: ['/api/partners/profile'] });
          queryClient.invalidateQueries({ queryKey: ['/api/partners'] });
        }

        // Forçar refetch da query principal após um pequeno delay para garantir atualização
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['/api/user'] });
        }, 500);

        // Mostrar sucesso
        setUploadSuccess(true);
        setTimeout(() => {
          setUploadSuccess(false);
          setUploadProgress(0);
        }, 3000);

        toast({
          title: 'Sucesso!',
          description: 'Foto de perfil atualizada com sucesso.',
        });
      } else {
        throw new Error('Servidor não retornou URL da imagem');
      }
    } catch (error: any) {
      console.error('Erro detalhado no upload:', {
        message: error.message,
        stack: error.stack,
        userType,
        endpoint: userType === 'doctor' ? '/api/profile/doctors/profile-image' : 
                 userType === 'partner' ? '/api/profile/partners/profile-image' : 
                 '/api/profile/upload-image'
      });
      
      const errorMessage = error.message || 'Erro desconhecido ao fazer upload';
      setUploadError(errorMessage);
      
      toast({
        title: 'Erro no Upload',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [userType, onImageUpdate, toast, compressImage]);

  // Função para remover imagem
  const handleRemoveImage = useCallback(async () => {
    try {
      setIsUploading(true);

      let endpoint = '/api/profile/remove-image';
      if (userType === 'doctor') {
        endpoint = '/api/profile/doctors/remove-profile-image';
      } else if (userType === 'partner') {
        endpoint = '/api/profile/partners/remove-profile-image';
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
                  <div className="text-center">
                    <div className="text-white text-xs font-medium mb-1">
                      {uploadProgress}%
                    </div>
                    <div className="w-8 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
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
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    {uploadProgress < 30 ? 'Comprimindo imagem...' :
                     uploadProgress < 50 ? 'Preparando upload...' :
                     uploadProgress < 95 ? 'Enviando foto...' :
                     'Finalizando...'}
                  </p>
                  <div className="w-full max-w-xs mx-auto">
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                </div>
              )}
              
              {uploadSuccess && !isUploading && (
                <p className="text-sm text-green-600 font-medium">
                  Foto atualizada com sucesso!
                </p>
              )}

              {uploadError && !isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">Erro no upload</p>
                  </div>
                  <p className="text-xs text-destructive/80 max-w-xs">
                    {uploadError}
                  </p>
                </div>
              )}

              {!isUploading && !uploadSuccess && !uploadError && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {previewImage ? 'Clique na câmera para alterar' : 'Adicione uma foto de perfil'}
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