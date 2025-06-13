import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface DoctorOnboardingGuardProps {
  children: React.ReactNode;
}

export function DoctorOnboardingGuard({ children }: DoctorOnboardingGuardProps) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  
  // Get doctor profile to check if onboarding is complete
  const { data: doctorProfile, isLoading } = useQuery({
    queryKey: ['/api/doctors/profile'],
    queryFn: ({ signal }) => 
      fetch('/api/doctors/profile', { 
        signal,
        credentials: 'include' 
      })
        .then(res => {
          if (!res.ok) throw new Error('Falha ao buscar perfil');
          return res.json();
        }),
    enabled: !!user && user.role === 'doctor'
  });

  useEffect(() => {
    // Skip if not a doctor or still loading
    if (!user || user.role !== 'doctor' || isLoading) return;
    
    // Skip if already on onboarding page
    if (location === '/doctor-onboarding') return;
    
    // Check if onboarding is complete
    if (doctorProfile && !doctorProfile.welcomeCompleted) {
      // Check if essential fields are filled
      const isProfileIncomplete = !doctorProfile.specialization || 
                                 !doctorProfile.licenseNumber || 
                                 !doctorProfile.education ||
                                 !doctorProfile.consultationFee ||
                                 !doctorProfile.pixKey ||
                                 !doctorProfile.bankName;
      
      if (isProfileIncomplete) {
        navigate('/doctor-onboarding');
      }
    }
  }, [user, doctorProfile, isLoading, location, navigate]);

  // Show loading while checking profile
  if (user && user.role === 'doctor' && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}