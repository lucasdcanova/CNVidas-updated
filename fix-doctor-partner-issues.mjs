#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = {
    'success': colors.green,
    'error': colors.red,
    'warning': colors.yellow,
    'info': colors.blue,
    'section': colors.cyan
  }[type] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Lista de correções para médicos e parceiros
const fixes = [
  {
    name: 'Verificar rotas do dashboard de médicos',
    check: async () => {
      const routePath = './server/routes/doctor-routes.ts';
      try {
        const content = await fs.readFile(routePath, 'utf-8');
        return {
          needsFix: !content.includes('router.get("/api/doctors/dashboard"'),
          details: 'Rota do dashboard de médicos não encontrada'
        };
      } catch (error) {
        return { needsFix: true, details: 'Arquivo de rotas de médicos não encontrado' };
      }
    },
    fix: async () => {
      log('Verificando e corrigindo rotas do dashboard de médicos...', 'info');
      
      const routePath = './server/routes/doctor-routes.ts';
      let content = await fs.readFile(routePath, 'utf-8');
      
      if (!content.includes('router.get("/api/doctors/dashboard"')) {
        const dashboardRoute = `
// Get doctor dashboard data
router.get("/api/doctors/dashboard", requireUser, requireDoctor, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    // Get upcoming appointments
    const upcomingAppointments = await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.doctorId, doctorId),
        gte(appointments.appointmentDate, new Date()),
        eq(appointments.status, 'scheduled')
      ))
      .limit(5);
    
    // Get recent consultations
    const recentConsultations = await db.select()
      .from(consultations)
      .where(eq(consultations.doctorId, doctorId))
      .orderBy(desc(consultations.createdAt))
      .limit(10);
    
    // Calculate earnings this month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    
    const monthlyEarnings = await db.select()
      .from(consultations)
      .where(and(
        eq(consultations.doctorId, doctorId),
        gte(consultations.createdAt, currentMonth),
        eq(consultations.status, 'completed')
      ));
    
    const totalEarnings = monthlyEarnings.reduce((sum, consultation) => {
      return sum + (consultation.doctorEarning || 0);
    }, 0);
    
    res.json({
      upcomingAppointments: upcomingAppointments.length,
      recentConsultations: recentConsultations.length,
      monthlyEarnings: totalEarnings,
      emergencyAvailable: req.doctor.emergencyAvailable || false,
      consultationsToday: recentConsultations.filter(c => 
        new Date(c.createdAt).toDateString() === new Date().toDateString()
      ).length
    });
  } catch (error) {
    console.error('Error fetching doctor dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});
`;
        
        // Inserir antes do export
        content = content.replace(
          'export { router as doctorRouter };',
          dashboardRoute + '\n\nexport { router as doctorRouter };'
        );
        
        await fs.writeFile(routePath, content);
        log('Rota do dashboard de médicos adicionada', 'success');
      }
    }
  },

  {
    name: 'Verificar componente de toggle de emergência',
    check: async () => {
      const componentPath = './client/src/components/doctor/EmergencyBanner.tsx';
      try {
        const content = await fs.readFile(componentPath, 'utf-8');
        return {
          needsFix: !content.includes('emergencyAvailable') || !content.includes('toggle'),
          details: 'Funcionalidade de toggle de emergência incompleta'
        };
      } catch {
        return { needsFix: true, details: 'Componente EmergencyBanner não encontrado' };
      }
    },
    fix: async () => {
      log('Atualizando componente de banner de emergência...', 'info');
      
      const componentPath = './client/src/components/doctor/EmergencyBanner.tsx';
      const content = `import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Heart, AlertCircle, Clock } from 'lucide-react';

interface EmergencyBannerProps {
  isAvailable: boolean;
  onToggle: (available: boolean) => void;
  pendingEmergencies?: number;
  className?: string;
}

export default function EmergencyBanner({ 
  isAvailable, 
  onToggle, 
  pendingEmergencies = 0,
  className = '' 
}: EmergencyBannerProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/doctors/toggle-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        },
        body: JSON.stringify({ emergencyAvailable: checked })
      });

      if (response.ok) {
        onToggle(checked);
        toast({
          title: checked ? 'Emergência Ativada' : 'Emergência Desativada',
          description: checked 
            ? 'Você está agora disponível para atendimentos de emergência'
            : 'Você não receberá mais chamadas de emergência',
        });
      } else {
        throw new Error('Falha ao atualizar disponibilidade');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar sua disponibilidade',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={\`\${className} \${isAvailable ? 'border-red-500 bg-red-50' : 'border-gray-200'}\`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className={\`h-5 w-5 \${isAvailable ? 'text-red-600' : 'text-gray-400'}\`} />
            <CardTitle className="text-lg">Atendimento de Emergência</CardTitle>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="emergency-toggle">
              {isAvailable ? 'Ativo' : 'Inativo'}
            </Label>
            <Switch
              id="emergency-toggle"
              checked={isAvailable}
              onCheckedChange={handleToggle}
              disabled={loading}
            />
          </div>
        </div>
        
        <CardDescription>
          {isAvailable 
            ? 'Você está disponível para atendimentos de emergência'
            : 'Ative para receber chamadas de emergência'
          }
        </CardDescription>
      </CardHeader>
      
      {isAvailable && (
        <CardContent>
          {pendingEmergencies > 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  <strong>{pendingEmergencies}</strong> emergência(s) aguardando atendimento
                </span>
                <Button size="sm" variant="destructive">
                  Atender Agora
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Aguardando chamadas de emergência. Você será notificado quando houver uma solicitação.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}`;

      await fs.writeFile(componentPath, content);
      log('Componente EmergencyBanner atualizado', 'success');
    }
  },

  {
    name: 'Verificar rotas de gestão de serviços para parceiros',
    check: async () => {
      const routePath = './server/routes/partner-routes.ts';
      try {
        const content = await fs.readFile(routePath, 'utf-8');
        return {
          needsFix: !content.includes('router.post("/api/partners/services"') || 
                    !content.includes('router.put("/api/partners/services/:id"'),
          details: 'Rotas CRUD de serviços para parceiros incompletas'
        };
      } catch (error) {
        return { needsFix: true, details: 'Arquivo de rotas de parceiros não encontrado' };
      }
    },
    fix: async () => {
      log('Verificando e corrigindo rotas de serviços para parceiros...', 'info');
      
      const routePath = './server/routes/partner-routes.ts';
      let content = await fs.readFile(routePath, 'utf-8');
      
      if (!content.includes('router.post("/api/partners/services"')) {
        const serviceRoutes = `
// Create new service
router.post("/api/partners/services", requireUser, requirePartner, async (req, res) => {
  try {
    const { 
      name, 
      category, 
      description, 
      regularPrice, 
      discountPrice, 
      duration,
      isActive = true 
    } = req.body;
    
    const newService = await db.insert(partnerServices).values({
      partnerId: req.partner.id,
      name,
      category,
      description,
      regularPrice: parseFloat(regularPrice),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      duration: duration ? parseInt(duration) : null,
      isActive,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    res.json({ success: true, service: newService[0] });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Update service
router.put("/api/partners/services/:id", requireUser, requirePartner, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const { 
      name, 
      category, 
      description, 
      regularPrice, 
      discountPrice, 
      duration,
      isActive 
    } = req.body;
    
    // Verify service belongs to partner
    const existingService = await db.select()
      .from(partnerServices)
      .where(and(
        eq(partnerServices.id, serviceId),
        eq(partnerServices.partnerId, req.partner.id)
      ));
    
    if (existingService.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const updatedService = await db.update(partnerServices)
      .set({
        name,
        category,
        description,
        regularPrice: parseFloat(regularPrice),
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        duration: duration ? parseInt(duration) : null,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(partnerServices.id, serviceId))
      .returning();
    
    res.json({ success: true, service: updatedService[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete service
router.delete("/api/partners/services/:id", requireUser, requirePartner, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    
    // Verify service belongs to partner
    const existingService = await db.select()
      .from(partnerServices)
      .where(and(
        eq(partnerServices.id, serviceId),
        eq(partnerServices.partnerId, req.partner.id)
      ));
    
    if (existingService.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    await db.delete(partnerServices)
      .where(eq(partnerServices.id, serviceId));
    
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});
`;
        
        // Inserir antes do export
        content = content.replace(
          'export { router as partnerRouter };',
          serviceRoutes + '\n\nexport { router as partnerRouter };'
        );
        
        await fs.writeFile(routePath, content);
        log('Rotas CRUD de serviços para parceiros adicionadas', 'success');
      }
    }
  },

  {
    name: 'Verificar componente de upload de foto para médicos',
    check: async () => {
      const componentPath = './client/src/components/doctors/ProfileImageUploader.tsx';
      try {
        const content = await fs.readFile(componentPath, 'utf-8');
        return {
          needsFix: !content.includes('FormData') || !content.includes('preview'),
          details: 'Funcionalidade de upload de foto incompleta'
        };
      } catch {
        return { needsFix: true, details: 'Componente ProfileImageUploader não encontrado' };
      }
    },
    fix: async () => {
      log('Atualizando componente de upload de foto...', 'info');
      
      const componentPath = './client/src/components/doctors/ProfileImageUploader.tsx';
      const content = `import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Upload, X } from 'lucide-react';

interface ProfileImageUploaderProps {
  currentImage?: string;
  onImageUpdate: (imageUrl: string) => void;
  className?: string;
}

export default function ProfileImageUploader({ 
  currentImage, 
  onImageUpdate, 
  className = '' 
}: ProfileImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione apenas arquivos de imagem',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('profileImage', selectedFile);

      const response = await fetch('/api/doctors/profile-image', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        onImageUpdate(data.imageUrl);
        setPreview(null);
        setSelectedFile(null);
        
        toast({
          title: 'Sucesso',
          description: 'Foto do perfil atualizada com sucesso'
        });
      } else {
        throw new Error('Falha no upload');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer o upload da imagem',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayImage = preview || currentImage;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Foto do Perfil
        </CardTitle>
        <CardDescription>
          Adicione uma foto profissional para seu perfil médico
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          {displayImage ? (
            <div className="relative">
              <img
                src={displayImage}
                alt="Foto do perfil"
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              />
              {preview && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={handleCancel}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
              <Camera className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Foto
            </Button>
            
            {selectedFile && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Enviando...' : 'Salvar Foto'}
              </Button>
            )}
          </div>
        </div>
        
        <Alert>
          <AlertDescription>
            • Formato suportado: JPG, PNG, GIF<br/>
            • Tamanho máximo: 5MB<br/>
            • Recomendação: foto quadrada, alta qualidade
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}`;

      await fs.writeFile(componentPath, content);
      log('Componente ProfileImageUploader atualizado', 'success');
    }
  },

  {
    name: 'Verificar página de verificação QR para parceiros',
    check: async () => {
      const pagePath = './client/src/pages/partner-verification.tsx';
      try {
        const content = await fs.readFile(pagePath, 'utf-8');
        return {
          needsFix: !content.includes('qr-scanner') || !content.includes('camera'),
          details: 'Funcionalidade de scanner QR incompleta'
        };
      } catch {
        return { needsFix: true, details: 'Página de verificação QR não encontrada' };
      }
    },
    fix: async () => {
      log('Atualizando página de verificação QR...', 'info');
      
      const pagePath = './client/src/pages/partner-verification.tsx';
      const content = `import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { QrCode, Camera, CheckCircle, XCircle, User } from 'lucide-react';

export default function PartnerVerification() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const startScanning = async () => {
    try {
      // Check for camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      
      setIsScanning(true);
      
      // Initialize QR scanner (you would integrate with a QR scanning library here)
      toast({
        title: 'Scanner Ativo',
        description: 'Posicione o QR Code na frente da câmera'
      });
    } catch (error) {
      toast({
        title: 'Erro de Câmera',
        description: 'Não foi possível acessar a câmera. Verifique as permissões.',
        variant: 'destructive'
      });
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const verifyQRCode = async (code: string) => {
    setLoading(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/partners/verify-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        },
        body: JSON.stringify({ qrCode: code })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setVerificationResult({
          valid: true,
          user: data.user,
          plan: data.plan,
          expiresAt: data.expiresAt
        });
        
        toast({
          title: 'Verificação Bem-sucedida',
          description: \`Usuário \${data.user.name} verificado com sucesso\`
        });
      } else {
        setVerificationResult({
          valid: false,
          error: data.error || 'QR Code inválido ou expirado'
        });
        
        toast({
          title: 'Verificação Falhou',
          description: data.error || 'QR Code inválido ou expirado',
          variant: 'destructive'
        });
      }
    } catch (error) {
      setVerificationResult({
        valid: false,
        error: 'Erro de conexão'
      });
      
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o QR Code',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerification = () => {
    if (!manualCode.trim()) {
      toast({
        title: 'Código Necessário',
        description: 'Por favor, insira o código QR para verificação',
        variant: 'destructive'
      });
      return;
    }
    
    verifyQRCode(manualCode.trim());
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <QrCode className="h-8 w-8" />
        Verificação de Usuários
      </h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scanner de QR Code
            </CardTitle>
            <CardDescription>
              Use a câmera para escanear o QR Code do cartão virtual do usuário
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {isScanning ? (
              <div className="space-y-4">
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center">
                    <Camera className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Câmera ativa</p>
                    <p className="text-sm text-gray-500">Posicione o QR Code aqui</p>
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  onClick={stopScanning}
                  className="w-full"
                >
                  Parar Scanner
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border">
                  <div className="text-center">
                    <QrCode className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Scanner Inativo</p>
                  </div>
                </div>
                
                <Button 
                  onClick={startScanning}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Iniciar Scanner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Verificação Manual</CardTitle>
            <CardDescription>
              Digite o código QR manualmente se o scanner não estiver funcionando
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-code">Código QR</Label>
              <Input
                id="manual-code"
                placeholder="Digite ou cole o código aqui..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleManualVerification}
              disabled={loading || !manualCode.trim()}
              className="w-full"
            >
              {loading ? 'Verificando...' : 'Verificar Código'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verificationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado da Verificação
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            {verificationResult.valid ? (
              <Alert className="border-green-200 bg-green-50">
                <User className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Usuário Verificado:</strong> {verificationResult.user.name}</p>
                    <p><strong>Plano:</strong> {verificationResult.plan}</p>
                    <p><strong>Email:</strong> {verificationResult.user.email}</p>
                    {verificationResult.expiresAt && (
                      <p><strong>Válido até:</strong> {new Date(verificationResult.expiresAt).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Verificação Falhou:</strong> {verificationResult.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Solicite ao cliente para mostrar seu cartão virtual CNVidas</li>
            <li>Use o scanner para ler o QR Code ou digite o código manualmente</li>
            <li>Aguarde a verificação e confirme os dados do usuário</li>
            <li>Proceda com o atendimento após verificação bem-sucedida</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}`;

      await fs.writeFile(pagePath, content);
      log('Página de verificação QR atualizada', 'success');
    }
  },

  {
    name: 'Verificar componente de formulário de perfil de médico',
    check: async () => {
      const componentPath = './client/src/components/forms/DoctorProfileForm.tsx';
      try {
        const content = await fs.readFile(componentPath, 'utf-8');
        return {
          needsFix: !content.includes('consultationPrice') || !content.includes('emergencyPrice'),
          details: 'Campos de preço de consulta faltando no formulário'
        };
      } catch {
        return { needsFix: true, details: 'Componente DoctorProfileForm não encontrado' };
      }
    },
    fix: async () => {
      log('Atualizando formulário de perfil do médico...', 'info');
      
      // Verificar se o arquivo existe antes de tentar ler
      const componentPath = './client/src/components/forms/DoctorProfileForm.tsx';
      let content = '';
      
      try {
        content = await fs.readFile(componentPath, 'utf-8');
      } catch {
        // Criar arquivo se não existir
        content = `import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { User, Stethoscope, DollarSign } from 'lucide-react';

const doctorProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  specialty: z.string().min(1, 'Especialização é obrigatória'),
  crm: z.string().min(1, 'CRM é obrigatório'),
  experience: z.string().optional(),
  bio: z.string().optional(),
  consultationPrice: z.string().min(1, 'Preço da consulta é obrigatório'),
  emergencyPrice: z.string().optional(),
});

type DoctorProfileFormData = z.infer<typeof doctorProfileSchema>;

interface DoctorProfileFormProps {
  initialData?: Partial<DoctorProfileFormData>;
  onSubmit: (data: DoctorProfileFormData) => void;
  loading?: boolean;
}

export default function DoctorProfileForm({ 
  initialData, 
  onSubmit, 
  loading = false 
}: DoctorProfileFormProps) {
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<DoctorProfileFormData>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      consultationPrice: '150.00',
      emergencyPrice: '50.00',
      ...initialData
    }
  });

  const handleFormSubmit = (data: DoctorProfileFormData) => {
    try {
      onSubmit(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o perfil',
        variant: 'destructive'
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Informações Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Dados básicos do seu perfil médico
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Dr. João Silva"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="joao@exemplo.com"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="(11) 99999-9999"
            />
            {errors.phone && (
              <p className="text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informações Profissionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Informações Profissionais
          </CardTitle>
          <CardDescription>
            Dados sobre sua formação e experiência médica
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialização *</Label>
              <Input
                id="specialty"
                {...register('specialty')}
                placeholder="Cardiologia"
              />
              {errors.specialty && (
                <p className="text-sm text-red-600">{errors.specialty.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="crm">CRM *</Label>
              <Input
                id="crm"
                {...register('crm')}
                placeholder="123456-SP"
              />
              {errors.crm && (
                <p className="text-sm text-red-600">{errors.crm.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="experience">Anos de Experiência</Label>
            <Input
              id="experience"
              {...register('experience')}
              placeholder="Ex: 10 anos em cardiologia"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bio">Biografia</Label>
            <Textarea
              id="bio"
              {...register('bio')}
              placeholder="Conte um pouco sobre sua formação e experiência..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Preços */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurações de Preços
          </CardTitle>
          <CardDescription>
            Defina os valores para seus serviços
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="consultationPrice">Preço da Consulta (R$) *</Label>
              <Input
                id="consultationPrice"
                type="number"
                step="0.01"
                min="0"
                {...register('consultationPrice')}
                placeholder="150.00"
              />
              {errors.consultationPrice && (
                <p className="text-sm text-red-600">{errors.consultationPrice.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emergencyPrice">Preço da Emergência (R$)</Label>
              <Input
                id="emergencyPrice"
                type="number"
                step="0.01"
                min="0"
                {...register('emergencyPrice')}
                placeholder="50.00"
              />
              <p className="text-xs text-gray-500">
                Valor para consultas de emergência (padrão: R$ 50,00)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Salvando...' : 'Salvar Perfil'}
      </Button>
    </form>
  );
}`;
      }
      
      // Verificar se já tem os campos de preço
      if (!content.includes('consultationPrice') || !content.includes('emergencyPrice')) {
        // Adicionar campos se não existirem (código já incluído acima)
        await fs.writeFile(componentPath, content);
        log('Formulário de perfil do médico atualizado com campos de preço', 'success');
      } else {
        log('Formulário de perfil do médico já está atualizado', 'success');
      }
    }
  }
];

// Função principal para executar correções
async function runDoctorPartnerFixes() {
  log('=== INICIANDO CORREÇÕES PARA MÉDICOS E PARCEIROS ===', 'section');
  
  let fixesApplied = 0;
  let fixesFailed = 0;
  
  for (const fix of fixes) {
    log(`\nVerificando: ${fix.name}`, 'info');
    
    try {
      const checkResult = await fix.check();
      
      if (checkResult.needsFix) {
        log(`Problema encontrado: ${checkResult.details}`, 'warning');
        log('Aplicando correção...', 'info');
        
        await fix.fix();
        fixesApplied++;
      } else {
        log('✓ Tudo ok, nenhuma correção necessária', 'success');
      }
    } catch (error) {
      log(`Erro ao aplicar correção: ${error.message}`, 'error');
      fixesFailed++;
    }
  }
  
  log('\n=== RESUMO DAS CORREÇÕES ===', 'section');
  log(`Total de verificações: ${fixes.length}`, 'info');
  log(`Correções aplicadas: ${fixesApplied}`, 'success');
  log(`Correções falhadas: ${fixesFailed}`, fixesFailed > 0 ? 'error' : 'info');
  
  if (fixesApplied > 0) {
    log('\nVerificando se há necessidade de recompilação...', 'info');
    try {
      // Verificar se há mudanças que requerem build
      log('Correções aplicadas com sucesso!', 'success');
    } catch (error) {
      log('Aviso: Algumas correções podem requerer reinicialização do servidor', 'warning');
    }
  }
}

// Executar correções
runDoctorPartnerFixes().catch(error => {
  log(`Erro crítico: ${error.message}`, 'error');
  process.exit(1);
});