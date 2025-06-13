import { useState, useEffect } from 'react';
import logoFallback from '@/assets/logo_cn_vidas_white_bg.svg';

interface UseProfileImageOptions {
  imageUrl?: string | null;
  userName?: string;
  enableFallback?: boolean;
}

export function useProfileImage({ 
  imageUrl, 
  userName = 'Usuário',
  enableFallback = true 
}: UseProfileImageOptions) {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Função para gerar iniciais do nome
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Função para verificar se a imagem existe
  const checkImageExists = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };

  // Efeito para processar a URL da imagem
  useEffect(() => {
    const processImage = async () => {
      if (!imageUrl) {
        setCurrentImage(null);
        setHasError(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        // Verificar se a imagem existe
        const exists = await checkImageExists(imageUrl);
        
        if (exists) {
          setCurrentImage(imageUrl);
          setHasError(false);
        } else {
          console.warn(`Imagem de perfil não encontrada: ${imageUrl}`);
          setHasError(true);
          
          if (enableFallback) {
            // Usar imagem de fallback
            setCurrentImage(logoFallback);
          } else {
            setCurrentImage(null);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar imagem de perfil:', error);
        setHasError(true);
        
        if (enableFallback) {
          setCurrentImage(logoFallback);
        } else {
          setCurrentImage(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    processImage();
  }, [imageUrl, enableFallback]);

  // Função para lidar com erro de carregamento da imagem
  const handleImageError = () => {
    if (!hasError) {
      console.warn(`Erro ao carregar imagem: ${imageUrl}`);
      setHasError(true);
      
      if (enableFallback) {
        setCurrentImage(logoFallback);
      } else {
        setCurrentImage(null);
      }
    }
  };

  // Função para forçar recarregamento da imagem
  const reloadImage = () => {
    if (imageUrl) {
      setHasError(false);
      setIsLoading(true);
      
      // Adicionar timestamp para forçar reload
      const urlWithTimestamp = `${imageUrl}?t=${Date.now()}`;
      checkImageExists(urlWithTimestamp).then((exists) => {
        if (exists) {
          setCurrentImage(urlWithTimestamp);
          setHasError(false);
        } else {
          setHasError(true);
          if (enableFallback) {
            setCurrentImage(logoFallback);
          } else {
            setCurrentImage(null);
          }
        }
        setIsLoading(false);
      });
    }
  };

  return {
    currentImage,
    isLoading,
    hasError,
    initials: getInitials(userName),
    handleImageError,
    reloadImage,
    fallbackImage: logoFallback
  };
} 