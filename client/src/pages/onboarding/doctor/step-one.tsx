import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Camera,
  DollarSign,
  FileText,
  Award,
  Globe,
  X,
  Plus,
  Stethoscope,
  GraduationCap,
  Briefcase,
  Hash
} from 'lucide-react';
import ProfileImageUploader from '@/components/shared/ProfileImageUploader';

interface StepOneProps {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
}

export default function StepOne({ formData, updateFormData, onNext }: StepOneProps) {
  const { toast } = useToast();
  const [newExpertise, setNewExpertise] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  const handleAddExpertise = () => {
    if (newExpertise.trim()) {
      updateFormData({
        areasOfExpertise: [...formData.areasOfExpertise, newExpertise.trim()]
      });
      setNewExpertise('');
    }
  };

  const handleRemoveExpertise = (index: number) => {
    const updated = formData.areasOfExpertise.filter((_: any, i: number) => i !== index);
    updateFormData({ areasOfExpertise: updated });
  };

  const handleAddLanguage = () => {
    if (newLanguage.trim()) {
      updateFormData({
        languagesSpoken: [...formData.languagesSpoken, newLanguage.trim()]
      });
      setNewLanguage('');
    }
  };

  const handleRemoveLanguage = (index: number) => {
    const updated = formData.languagesSpoken.filter((_: any, i: number) => i !== index);
    updateFormData({ languagesSpoken: updated });
  };

  const handleProfileImageUpdate = (imageUrl: string) => {
    updateFormData({ profileImage: imageUrl });
  };

  const validateAndNext = () => {
    if (!formData.specialization || !formData.licenseNumber || !formData.education) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.consultationPrice || formData.consultationPrice < 50) {
      toast({
        title: 'Valor inválido',
        description: 'O valor mínimo da consulta é R$ 50,00.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.fullBio || formData.fullBio.length < 100) {
      toast({
        title: 'Biografia muito curta',
        description: 'Por favor, escreva uma biografia mais detalhada (mínimo 100 caracteres).',
        variant: 'destructive'
      });
      return;
    }

    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto"
    >
      <Card className="shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Complete seu Perfil Profissional
          </CardTitle>
          <CardDescription className="text-blue-100">
            Essas informações ajudarão os pacientes a conhecerem melhor você e seu trabalho
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Profile Image Upload */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Foto de Perfil
            </h3>
            <div className="w-full max-w-md mx-auto">
              <ProfileImageUploader
                currentImage={formData.profileImage}
                userName={formData.fullName || 'Médico'}
                userType="doctor"
                onImageUpdate={handleProfileImageUpdate}
              />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Uma foto profissional ajuda a criar confiança com os pacientes
            </p>
          </motion.div>

          {/* Professional Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="grid md:grid-cols-2 gap-6"
          >
            <div className="space-y-2">
              <Label htmlFor="specialization" className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Especialidade *
              </Label>
              <Input
                id="specialization"
                placeholder="Ex: Cardiologia, Clínica Geral"
                value={formData.specialization}
                onChange={(e) => updateFormData({ specialization: e.target.value })}
                className="border-gray-300 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="licenseNumber" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Número do CRM *
              </Label>
              <Input
                id="licenseNumber"
                placeholder="Ex: 123456/SP"
                value={formData.licenseNumber}
                onChange={(e) => updateFormData({ licenseNumber: e.target.value })}
                className="border-gray-300 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="education" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Formação Acadêmica *
              </Label>
              <Input
                id="education"
                placeholder="Ex: Medicina - USP (2015)"
                value={formData.education}
                onChange={(e) => updateFormData({ education: e.target.value })}
                className="border-gray-300 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experienceYears" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Anos de Experiência
              </Label>
              <Input
                id="experienceYears"
                type="number"
                min="0"
                placeholder="Ex: 10"
                value={formData.experienceYears}
                onChange={(e) => updateFormData({ experienceYears: parseInt(e.target.value) || 0 })}
                className="border-gray-300 focus:border-blue-500"
              />
            </div>
          </motion.div>

          {/* Consultation Price */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <Label htmlFor="consultationPrice" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valor da Consulta *
            </Label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                <Input
                  id="consultationPrice"
                  type="number"
                  min="50"
                  step="10"
                  placeholder="0,00"
                  className="pl-10 border-gray-300 focus:border-blue-500"
                  value={formData.consultationPrice}
                  onChange={(e) => updateFormData({ consultationPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <Textarea
              placeholder="Descreva o que está incluído no valor da consulta (opcional)"
              rows={2}
              value={formData.consultationPriceDescription}
              onChange={(e) => updateFormData({ consultationPriceDescription: e.target.value })}
              className="border-gray-300 focus:border-blue-500"
            />
          </motion.div>

          {/* Full Biography */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-2"
          >
            <Label htmlFor="fullBio" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Biografia Completa * (mínimo 100 caracteres)
            </Label>
            <Textarea
              id="fullBio"
              placeholder="Conte sobre sua trajetória, experiência, abordagem médica e o que o motiva na medicina..."
              rows={6}
              value={formData.fullBio}
              onChange={(e) => updateFormData({ fullBio: e.target.value })}
              className="border-gray-300 focus:border-blue-500"
            />
            <p className="text-sm text-gray-600">
              {formData.fullBio.length}/100 caracteres
            </p>
          </motion.div>

          {/* Areas of Expertise */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-2"
          >
            <Label className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Áreas de Especialização
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Cardiologia Intervencionista"
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddExpertise()}
                className="border-gray-300 focus:border-blue-500"
              />
              <Button onClick={handleAddExpertise} size="icon" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.areasOfExpertise.map((area: string, index: number) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {area}
                  <button
                    onClick={() => handleRemoveExpertise(index)}
                    className="ml-2 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </motion.div>

          {/* Languages */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-2"
          >
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Idiomas
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Português, Inglês, Espanhol"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddLanguage()}
                className="border-gray-300 focus:border-blue-500"
              />
              <Button onClick={handleAddLanguage} size="icon" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.languagesSpoken.map((lang: string, index: number) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {lang}
                  <button
                    onClick={() => handleRemoveLanguage(index)}
                    className="ml-2 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </motion.div>

          {/* Achievements */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-2"
          >
            <Label htmlFor="achievements" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Conquistas e Certificações (opcional)
            </Label>
            <Textarea
              id="achievements"
              placeholder="Prêmios, certificações, publicações, cursos de especialização..."
              rows={3}
              value={formData.achievements}
              onChange={(e) => updateFormData({ achievements: e.target.value })}
              className="border-gray-300 focus:border-blue-500"
            />
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex justify-end pt-6"
          >
            <Button
              onClick={validateAndNext}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
            >
              Próximo Passo
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}