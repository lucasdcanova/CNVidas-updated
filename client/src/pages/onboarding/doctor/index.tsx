import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import StepOne from './step-one';
import StepTwo from './step-two';
import StepThree from './step-three';

export default function DoctorOnboardingFlow() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    // Step 1: Profile Information
    profileImage: '',
    consultationPrice: 0,
    consultationPriceDescription: '',
    fullBio: '',
    areasOfExpertise: [] as string[],
    languagesSpoken: [] as string[],
    achievements: '',
    specialization: '',
    licenseNumber: '',
    education: '',
    experienceYears: 0,
    
    // Step 3: Payment Information (from existing form)
    pixKeyType: '',
    pixKey: '',
    bankName: '',
    accountType: 'corrente'
  });

  // Check if user is a doctor
  useEffect(() => {
    if (user && user.role !== 'doctor') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Get current doctor profile
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

  // Update form when profile loads
  useEffect(() => {
    if (doctorProfile) {
      // If onboarding is already complete, redirect to dashboard
      if (doctorProfile.onboardingCompleted) {
        navigate('/dashboard');
        return;
      }

      // Pre-fill existing data
      setFormData(prev => ({
        ...prev,
        specialization: doctorProfile.specialization || '',
        licenseNumber: doctorProfile.licenseNumber || '',
        education: doctorProfile.education || '',
        experienceYears: doctorProfile.experienceYears || 0,
        consultationPrice: doctorProfile.consultationFee || 0,
        fullBio: doctorProfile.biography || '',
        pixKeyType: doctorProfile.pixKeyType || '',
        pixKey: doctorProfile.pixKey || '',
        bankName: doctorProfile.bankName || '',
        accountType: doctorProfile.accountType || 'corrente',
        profileImage: doctorProfile.profileImage || '',
        consultationPriceDescription: doctorProfile.consultationPriceDescription || '',
        areasOfExpertise: doctorProfile.areasOfExpertise || [],
        languagesSpoken: doctorProfile.languagesSpoken || [],
        achievements: doctorProfile.achievements || ''
      }));
    }
  }, [doctorProfile, navigate]);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">Configuração do Perfil Médico</h2>
            <span className="text-sm text-gray-600">Etapa {currentStep} de 3</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${(currentStep / 3) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <StepOne
              key="step1"
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
            />
          )}
          {currentStep === 2 && (
            <StepTwo
              key="step2"
              formData={formData}
              onNext={handleNext}
              onBack={handleBack}
              user={user}
            />
          )}
          {currentStep === 3 && (
            <StepThree
              key="step3"
              formData={formData}
              updateFormData={updateFormData}
              onBack={handleBack}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}