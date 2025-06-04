import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw, HeadphonesIcon, MonitorSmartphone, ListChecks } from 'lucide-react';

type TroubleshootingDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Diálogo que exibe dicas e solução de problemas para videochamadas
 */
const TroubleshootingDialog: React.FC<TroubleshootingDialogProps> = ({
  isOpen,
  onOpenChange,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <WifiOff className="h-5 w-5 mr-2 text-red-500" />
            Problemas de conexão
          </DialogTitle>
          <DialogDescription>
            Verifique estas configurações para melhorar sua conexão
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Dicas para melhorar a conexão</h3>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-50 p-2 rounded-full">
                <WifiOff className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Verifique sua internet</h4>
                <p className="text-sm text-gray-500">Certifique-se de que sua conexão está estável e tente se aproximar do roteador.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-50 p-2 rounded-full">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Reinicie seu navegador</h4>
                <p className="text-sm text-gray-500">Feche e reabra seu navegador ou atualize a página.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-50 p-2 rounded-full">
                <HeadphonesIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Teste seu áudio e vídeo</h4>
                <p className="text-sm text-gray-500">Certifique-se de que seu microfone e câmera estão funcionando corretamente.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-50 p-2 rounded-full">
                <MonitorSmartphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Tente outro dispositivo</h4>
                <p className="text-sm text-gray-500">Se possível, tente acessar de um computador em vez de um celular, ou vice-versa.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-50 p-2 rounded-full">
                <ListChecks className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Permissões do navegador</h4>
                <p className="text-sm text-gray-500">Verifique se seu navegador tem permissão para acessar câmera e microfone.</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-md bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              Problemas de conexão são comuns e geralmente temporários. Se nenhuma das dicas funcionar, 
              tente novamente mais tarde ou entre em contato com nosso suporte.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TroubleshootingDialog;