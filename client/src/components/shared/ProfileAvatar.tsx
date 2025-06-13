import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfileImage } from '@/hooks/use-profile-image';
import { User, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileAvatarProps {
  imageUrl?: string | null;
  userName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showReloadButton?: boolean;
  enableFallback?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24'
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8'
};

const textSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
};

export function ProfileAvatar({
  imageUrl,
  userName = 'Usuário',
  size = 'md',
  className = '',
  showReloadButton = false,
  enableFallback = true,
  onClick
}: ProfileAvatarProps) {
  const {
    currentImage,
    isLoading,
    hasError,
    initials,
    handleImageError,
    reloadImage
  } = useProfileImage({
    imageUrl,
    userName,
    enableFallback
  });

  return (
    <div className={`relative inline-block ${className}`}>
      <Avatar 
        className={`${sizeClasses[size]} border-2 border-border cursor-pointer transition-all hover:border-primary/50`}
        onClick={onClick}
      >
        <AvatarImage 
          src={currentImage || undefined}
          alt={userName}
          className="object-cover"
          onError={handleImageError}
        />
        <AvatarFallback className={`${textSizes[size]} font-medium bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700`}>
          {currentImage ? (
            <User className={iconSizes[size]} />
          ) : (
            initials
          )}
        </AvatarFallback>
      </Avatar>

      {/* Indicador de carregamento */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
          <RefreshCw className={`${iconSizes[size]} animate-spin text-white`} />
        </div>
      )}

      {/* Indicador de erro */}
      {hasError && !isLoading && (
        <div className="absolute -top-1 -right-1 h-3 w-3 bg-yellow-500 rounded-full border border-white" 
             title="Imagem não encontrada - usando fallback" />
      )}

      {/* Botão de reload */}
      {showReloadButton && hasError && !isLoading && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white shadow-md hover:bg-gray-50"
          onClick={(e) => {
            e.stopPropagation();
            reloadImage();
          }}
          title="Tentar carregar imagem novamente"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default ProfileAvatar; 