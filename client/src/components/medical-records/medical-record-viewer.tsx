import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  User, Calendar, Phone, Mail, MapPin, FileText, 
  AlertCircle, Clock, Stethoscope, Pill, Activity,
  FileDown, History, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface MedicalRecord {
  id: number;
  patientId: number;
  recordNumber: string;
  createdAt: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  medications?: string;
  allergies?: string;
  familyHistory?: string;
  socialHistory?: string;
  vitalSigns?: any;
  physicalExamination?: string;
  bloodType?: string;
  emergencyContact?: any;
  isActive: boolean;
}

interface Patient {
  id: number;
  fullName: string;
  username: string;
  email: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
}

interface MedicalRecordEntry {
  id: number;
  recordId: number;
  appointmentId?: number;
  authorId: number;
  entryType: string;
  content: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  vitalSigns?: any;
  attachments?: any;
  createdAt: string;
  signedAt?: string;
  signature?: string;
  cid10?: string;
  procedures?: any;
  prescriptions?: any;
  author?: {
    fullName: string;
    role: string;
  };
}

interface AccessHistory {
  id: number;
  recordId: number;
  userId: number;
  accessType: string;
  accessReason?: string;
  accessedAt: string;
  ipAddress?: string;
  user?: {
    fullName: string;
    role: string;
  };
}

interface MedicalRecordViewerProps {
  patientId: number;
  onClose?: () => void;
}

export function MedicalRecordViewer({ patientId, onClose }: MedicalRecordViewerProps) {
  const [activeTab, setActiveTab] = useState('info');
  const { toast } = useToast();
  const { user } = useAuth();

  // Buscar prontuário e dados do paciente
  const { data: recordData, isLoading: isLoadingRecord } = useQuery({
    queryKey: ['/api/medical-records/patient', patientId],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/medical-records/patient/${patientId}`);
        return await response.json();
      } catch (error) {
        toast({
          title: 'Erro ao carregar prontuário',
          description: 'Não foi possível carregar os dados do prontuário.',
          variant: 'destructive',
        });
        throw error;
      }
    },
  });

  const record: MedicalRecord | undefined = recordData?.record;
  const patient: Patient | undefined = recordData?.patient;

  // Buscar entradas do prontuário
  const { data: entries = [], isLoading: isLoadingEntries } = useQuery<MedicalRecordEntry[]>({
    queryKey: ['/api/medical-records/entries', record?.id],
    queryFn: async () => {
      if (!record?.id) return [];
      
      try {
        const response = await apiRequest('GET', `/api/medical-records/${record.id}/entries`);
        return await response.json();
      } catch (error) {
        console.error('Erro ao buscar entradas:', error);
        return [];
      }
    },
    enabled: !!record?.id,
  });

  // Buscar histórico de acesso (apenas admin)
  const { data: accessHistory = [] } = useQuery<AccessHistory[]>({
    queryKey: ['/api/medical-records/access-history', record?.id],
    queryFn: async () => {
      if (!record?.id) return [];
      
      try {
        const response = await apiRequest('GET', `/api/medical-records/${record.id}/access-history`);
        return await response.json();
      } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
      }
    },
    enabled: !!record?.id && user?.role === 'admin',
  });

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

  const getEntryTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: any }> = {
      consultation: { label: 'Consulta', variant: 'default' },
      exam: { label: 'Exame', variant: 'secondary' },
      prescription: { label: 'Prescrição', variant: 'outline' },
      procedure: { label: 'Procedimento', variant: 'secondary' },
      evolution: { label: 'Evolução', variant: 'default' },
    };
    
    return types[type] || { label: type, variant: 'outline' };
  };

  if (isLoadingRecord) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando prontuário...</p>
        </div>
      </div>
    );
  }

  if (!record || !patient) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Prontuário não encontrado</p>
      </div>
    );
  }

  const age = calculateAge(patient.birthDate);

  return (
    <div className="space-y-4">
      {/* Cabeçalho do paciente */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{patient.fullName}</h2>
                  <p className="text-sm text-muted-foreground">
                    Prontuário: {record.recordNumber}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {patient.birthDate ? 
                        `${format(new Date(patient.birthDate), 'dd/MM/yyyy')} (${age} anos)` : 
                        'Data de nascimento não informada'
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>CPF: {formatCPF(patient.cpf)}</span>
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{patient.email}</span>
                  </div>
                  {patient.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {patient.address}
                        {patient.city && `, ${patient.city}`}
                        {patient.state && ` - ${patient.state}`}
                      </span>
                    </div>
                  )}
                  {record.bloodType && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      <span>Tipo sanguíneo: {record.bloodType}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="entries">Evoluções</TabsTrigger>
          <TabsTrigger value="history">Histórico Médico</TabsTrigger>
          {user?.role === 'admin' && (
            <TabsTrigger value="access">Acessos</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            {/* Informações básicas */}
            <div className="space-y-4">
              {record.chiefComplaint && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Queixa Principal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{record.chiefComplaint}</p>
                  </CardContent>
                </Card>
              )}

              {record.allergies && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Alergias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{record.allergies}</p>
                  </CardContent>
                </Card>
              )}

              {record.medications && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      Medicações em Uso
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{record.medications}</p>
                  </CardContent>
                </Card>
              )}

              {record.emergencyContact && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contato de Emergência</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <p><strong>Nome:</strong> {record.emergencyContact.name || 'Não informado'}</p>
                      <p><strong>Telefone:</strong> {record.emergencyContact.phone || 'Não informado'}</p>
                      <p><strong>Parentesco:</strong> {record.emergencyContact.relationship || 'Não informado'}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            {isLoadingEntries ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : entries.length > 0 ? (
              <div className="space-y-4">
                {entries.map((entry) => {
                  const entryType = getEntryTypeBadge(entry.entryType);
                  
                  return (
                    <Card key={entry.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={entryType.variant}>{entryType.label}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(entry.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Por: Dr(a). {entry.author?.fullName || 'Não identificado'}
                            </p>
                          </div>
                          {entry.signedAt && (
                            <Badge variant="outline" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Assinado
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {entry.content && (
                            <div>
                              <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                            </div>
                          )}
                          
                          {(entry.subjective || entry.objective || entry.assessment || entry.plan) && (
                            <>
                              <Separator />
                              <div className="space-y-2">
                                {entry.subjective && (
                                  <div>
                                    <p className="font-medium text-sm">Subjetivo:</p>
                                    <p className="text-sm text-muted-foreground">{entry.subjective}</p>
                                  </div>
                                )}
                                {entry.objective && (
                                  <div>
                                    <p className="font-medium text-sm">Objetivo:</p>
                                    <p className="text-sm text-muted-foreground">{entry.objective}</p>
                                  </div>
                                )}
                                {entry.assessment && (
                                  <div>
                                    <p className="font-medium text-sm">Avaliação:</p>
                                    <p className="text-sm text-muted-foreground">{entry.assessment}</p>
                                  </div>
                                )}
                                {entry.plan && (
                                  <div>
                                    <p className="font-medium text-sm">Plano:</p>
                                    <p className="text-sm text-muted-foreground">{entry.plan}</p>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          
                          {entry.cid10 && (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">CID-10: {entry.cid10}</Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhuma evolução registrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As evoluções aparecerão aqui após as consultas
                </p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {record.historyOfPresentIllness && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">História da Doença Atual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{record.historyOfPresentIllness}</p>
                  </CardContent>
                </Card>
              )}

              {record.pastMedicalHistory && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">História Médica Pregressa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{record.pastMedicalHistory}</p>
                  </CardContent>
                </Card>
              )}

              {record.familyHistory && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">História Familiar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{record.familyHistory}</p>
                  </CardContent>
                </Card>
              )}

              {record.socialHistory && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">História Social</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{record.socialHistory}</p>
                  </CardContent>
                </Card>
              )}

              {record.physicalExamination && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Exame Físico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{record.physicalExamination}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {user?.role === 'admin' && (
          <TabsContent value="access" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              {accessHistory.length > 0 ? (
                <div className="space-y-2">
                  {accessHistory.map((access) => (
                    <Card key={access.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <History className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{access.user?.fullName}</span>
                              <Badge variant="outline">{access.accessType}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(access.accessedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                            </p>
                            {access.accessReason && (
                              <p className="text-sm text-muted-foreground">
                                Motivo: {access.accessReason}
                              </p>
                            )}
                          </div>
                          {access.ipAddress && (
                            <span className="text-xs text-muted-foreground">
                              IP: {access.ipAddress}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhum acesso registrado</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}