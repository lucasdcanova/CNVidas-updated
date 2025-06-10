import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
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
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isAvailable: checked })
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
    <Card className={`${className} ${isAvailable ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className={`h-5 w-5 ${isAvailable ? 'text-red-600' : 'text-gray-400'}`} />
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
}