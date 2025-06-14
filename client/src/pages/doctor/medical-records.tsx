import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, User, Calendar, Clock, Eye, AlertCircle, Shield, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/layouts/dashboard-layout';
import { MedicalRecordViewer } from '@/components/medical-records/medical-record-viewer';

interface Patient {
  id: number;
  fullName: string;
  username: string;
  email: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  city?: string;
  state?: string;
  lastAppointmentDate?: string;
  totalAppointments?: number;
}

export default function DoctorMedicalRecordsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();
  
  // Log para debug quando a página carrega
  useEffect(() => {
    console.log('[Medical Records] Página carregada');
  }, []);

  // Buscar pacientes do médico
  const { data: patients = [], isLoading, refetch } = useQuery<Patient[]>({
    queryKey: ['/api/medical-records/doctor/patients'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/medical-records/doctor/patients');
        const data = await response.json();
        console.log('[Medical Records] Pacientes recebidos:', data);
        return data;
      } catch (error) {
        console.error('Erro ao buscar pacientes:', error);
        toast({
          title: 'Erro ao buscar pacientes',
          description: 'Não foi possível carregar a lista de pacientes.',
          variant: 'destructive',
        });
        return [];
      }
    },
    // Desabilitar cache para garantir dados atualizados
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Filtrar pacientes baseado na busca
  const filteredPatients = patients.filter(patient => {
    const search = searchQuery.toLowerCase().trim();
    if (!search) return true;
    
    return (
      patient.fullName.toLowerCase().includes(search) ||
      patient.username.toLowerCase().includes(search) ||
      patient.email.toLowerCase().includes(search) ||
      (patient.cpf && patient.cpf.includes(search))
    );
  });

  const handleViewRecord = (patient: Patient) => {
    setSelectedPatient(patient);
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
    <DashboardLayout title="Prontuários dos Pacientes">
      <div className="space-y-6">
        {/* Cabeçalho com informações */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">Acesso aos Prontuários</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              Você tem acesso apenas aos prontuários de pacientes que já atendeu ou possui consultas agendadas.
              Todos os acessos são registrados para fins de auditoria e conformidade legal.
            </p>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Total de Pacientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{patients.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Busca de pacientes */}
        <Card>
          <CardHeader>
            <CardTitle>Meus Pacientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, usuário, email ou CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Carregando pacientes...</p>
                </div>
              </div>
            ) : filteredPatients.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {filteredPatients.map((patient) => {
                    const age = calculateAge(patient.birthDate);
                    return (
                      <Card key={patient.id} className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleViewRecord(patient)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">{patient.fullName}</span>
                                {age && (
                                  <Badge variant="secondary">{age} anos</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>CPF: {formatCPF(patient.cpf)}</span>
                                </div>
                                {patient.phone && (
                                  <div className="flex items-center gap-1">
                                    <span>Tel: {patient.phone}</span>
                                  </div>
                                )}
                              </div>
                              {patient.lastAppointmentDate && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Última consulta: {format(new Date(patient.lastAppointmentDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Prontuário
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {searchQuery ? 'Nenhum paciente encontrado' : 'Você ainda não tem pacientes'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'Tente buscar com outros termos' : 'Os pacientes aparecerão aqui após suas consultas'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de visualização do prontuário */}
        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Prontuário Médico</DialogTitle>
            </DialogHeader>
            {selectedPatient && (
              <MedicalRecordViewer
                patientId={selectedPatient.id}
                onClose={() => setIsViewerOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}