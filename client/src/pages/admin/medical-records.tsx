import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, User, Calendar, Clock, Eye, AlertCircle, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/layouts/dashboard-layout';
import { MedicalRecordViewer } from '@/components/medical-records/medical-record-viewer';

interface MedicalRecord {
  id: number;
  patientId: number;
  recordNumber: string;
  createdAt: string;
  isActive: boolean;
  patient: {
    id: number;
    fullName: string;
    username: string;
    email: string;
    cpf?: string;
    birthDate?: string;
    phone?: string;
  };
}

export default function AdminMedicalRecordsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();

  // Buscar prontuários
  const { data: records = [], isLoading, refetch } = useQuery<MedicalRecord[]>({
    queryKey: ['/api/medical-records/search', searchQuery],
    queryFn: async () => {
      if (searchQuery.trim().length < 2) return [];
      
      try {
        const response = await apiRequest('GET', `/api/medical-records/search?q=${encodeURIComponent(searchQuery)}`);
        return await response.json();
      } catch (error) {
        console.error('Erro ao buscar prontuários:', error);
        toast({
          title: 'Erro ao buscar prontuários',
          description: 'Não foi possível realizar a busca. Tente novamente.',
          variant: 'destructive',
        });
        return [];
      }
    },
    enabled: searchQuery.trim().length >= 2,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      refetch();
    }
  };

  const handleViewRecord = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setIsViewerOpen(true);
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'Não informado';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <DashboardLayout title="Prontuários Médicos - Administração">
      <div className="space-y-6">
        {/* Cabeçalho com aviso de conformidade */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900">Conformidade Legal - CFM</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800">
              Os prontuários médicos são documentos sigilosos e imutáveis, conforme Resolução CFM nº 1.638/2002.
              Todos os acessos são registrados e auditados. O uso indevido pode resultar em sanções legais.
            </p>
          </CardContent>
        </Card>

        {/* Busca de prontuários */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar Prontuários</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nome, usuário ou número do prontuário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={searchQuery.trim().length < 2}>
                Buscar
              </Button>
            </form>
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres para buscar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Resultados da busca */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Buscando prontuários...</p>
              </div>
            </CardContent>
          </Card>
        ) : records.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Resultados da busca ({records.length} {records.length === 1 ? 'prontuário' : 'prontuários'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {records.map((record) => {
                    const age = calculateAge(record.patient.birthDate);
                    return (
                      <Card key={record.id} className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleViewRecord(record)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">{record.patient.fullName}</span>
                                {age && (
                                  <Badge variant="secondary">{age} anos</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>Prontuário: {record.recordNumber}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>CPF: {formatCPF(record.patient.cpf)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  Criado em {format(new Date(record.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : searchQuery.trim().length >= 2 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhum prontuário encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tente buscar com outros termos
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Modal de visualização do prontuário */}
        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Prontuário Médico</DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <MedicalRecordViewer
                patientId={selectedRecord.patientId}
                onClose={() => setIsViewerOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}