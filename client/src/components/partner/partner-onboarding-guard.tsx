import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface PartnerOnboardingGuardProps {
  children: React.ReactNode;
}

export function PartnerOnboardingGuard({ children }: PartnerOnboardingGuardProps) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  
  // Get partner profile
  const { data: partnerProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['/api/partners/me'],
    queryFn: ({ signal }) => 
      fetch('/api/partners/me', { 
        signal,
        credentials: 'include' 
      })
        .then(res => {
          if (!res.ok) throw new Error('Falha ao buscar perfil');
          return res.json();
        }),
    enabled: !!user && user.role === 'partner'
  });

  // Check partner addresses
  const { data: addresses, isLoading: loadingAddresses } = useQuery({
    queryKey: ['/api/partners/addresses'],
    queryFn: ({ signal }) => 
      fetch('/api/partners/addresses', { 
        signal,
        credentials: 'include' 
      })
        .then(res => res.json()),
    enabled: !!partnerProfile
  });

  // Check partner services
  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['/api/partners/my-services'],
    queryFn: ({ signal }) => 
      fetch('/api/partners/my-services', { 
        signal,
        credentials: 'include' 
      })
        .then(res => res.json()),
    enabled: !!partnerProfile
  });

  useEffect(() => {
    // Skip if not a partner or still loading
    if (!user || user.role !== 'partner' || loadingProfile || loadingAddresses || loadingServices) return;
    
    // Skip if already on onboarding page
    if (location === '/partner-onboarding') return;
    
    // Check if onboarding is complete
    if (partnerProfile) {
      // Check if essential fields are filled
      const isProfileIncomplete = !partnerProfile.businessName || 
                                 !partnerProfile.businessType || 
                                 !partnerProfile.cnpj ||
                                 !partnerProfile.phone;
      
      // Check if has at least one address and one active service
      const hasNoAddresses = !addresses || addresses.length === 0;
      const hasNoActiveServices = !services || !services.some((s: any) => s.isActive);
      
      if (isProfileIncomplete || hasNoAddresses || hasNoActiveServices) {
        navigate('/partner-onboarding');
      }
    }
  }, [user, partnerProfile, addresses, services, loadingProfile, loadingAddresses, loadingServices, location, navigate]);

  // Show loading while checking profile
  if (user && user.role === 'partner' && (loadingProfile || loadingAddresses || loadingServices)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}