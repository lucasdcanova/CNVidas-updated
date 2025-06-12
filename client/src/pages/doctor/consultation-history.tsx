import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Clock, DollarSign, FileText, Search, User, 
  Video, Users, Filter, Download, Eye, ChevronLeft, 
  ChevronRight, Activity, TrendingUp, AlertCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ConsultationRecord {
  id: number;
  date: string;
  patientName: string;
  patientAge?: number;
  patientEmail?: string;
  patientPhone?: string;
  type: 'telemedicine' | 'in_person';
  status: 'completed' | 'cancelled' | 'no_show';
  duration: number; // em minutos
  amount: number; // valor recebido
  paymentStatus: 'paid' | 'pending' | 'refunded';
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  isEmergency: boolean;
  recordUrl?: string;
}

interface ConsultationStats {
  totalConsultations: number;
  totalEarnings: number;
  averageDuration: number;
  completionRate: number;
  emergencyCount: number;
  telemedicineCount: number;
}

export default function ConsultationHistory() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'telemedicine' | 'in_person'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'cancelled' | 'no_show'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationRecord | null>(null);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  
  const itemsPerPage = 10;

  // Buscar histórico de consultas
  const { data: consultationsData, isLoading } = useQuery({
    queryKey: ['/api/doctors/consultations/history', selectedMonth],
    queryFn: async ({ signal }) => {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const response = await fetch(
        `/api/doctors/consultations/history?startDate=${startDate}&endDate=${endDate}`, 
        { 
          signal,
          credentials: 'include'
        }
      );
      
      if (!response.ok) throw new Error('Falha ao buscar histórico');
      return response.json();
    }
  });

  const consultations: ConsultationRecord[] = consultationsData?.consultations || [];
  const stats: ConsultationStats = consultationsData?.stats || {
    totalConsultations: 0,
    totalEarnings: 0,
    averageDuration: 0,
    completionRate: 0,
    emergencyCount: 0,
    telemedicineCount: 0
  };

  // Filtrar consultas
  const filteredConsultations = consultations.filter(consultation => {
    const matchesSearch = consultation.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         consultation.patientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         consultation.patientPhone?.includes(searchTerm);
    
    const matchesType = filterType === 'all' || consultation.type === filterType;
    const matchesStatus = filterStatus === 'all' || consultation.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Paginação
  const totalPages = Math.ceil(filteredConsultations.length / itemsPerPage);
  const paginatedConsultations = filteredConsultations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Visualizar prontuário
  const handleViewRecord = (consultation: ConsultationRecord) => {
    setSelectedConsultation(consultation);
    setShowRecordDialog(true);
  };

  // Exportar relatório
  const handleExportReport = async () => {
    try {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const response = await apiRequest(
        'GET', 
        `/api/doctors/consultations/export?startDate=${startDate}&endDate=${endDate}&format=pdf`
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consultas_${format(selectedMonth, 'yyyy-MM')}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: 'Relatório exportado',
          description: 'O relatório foi baixado com sucesso',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o relatório',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'no_show':
        return <Badge variant="secondary">Não compareceu</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Pago</Badge>;
      case 'pending':
        return <Badge variant="outline">Pendente</Badge>;
      case 'refunded':
        return <Badge variant="secondary">Reembolsado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Histórico de Consultas">
      <div className="space-y-6">
        {/* Header com estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Consultas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConsultations}</div>
              <p className="text-xs text-muted-foreground">
                {stats.emergencyCount} emergências
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.totalEarnings.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-xs text-muted-foreground">
                No mês selecionado
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duração Média</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageDuration} min</div>
              <p className="text-xs text-muted-foreground">
                Por consulta
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.telemedicineCount} por telemedicina
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e busca */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Consultas Realizadas</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                  disabled={format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de consulta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="telemedicine">Telemedicina</SelectItem>
                  <SelectItem value="in_person">Presencial</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="no_show">Não compareceu</SelectItem>
                </SelectContent>
              </Select>
              
              <Button onClick={handleExportReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>

            {/* Tabela de consultas */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Carregando histórico...
                      </TableCell>
                    </TableRow>
                  ) : paginatedConsultations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Nenhuma consulta encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedConsultations.map((consultation) => (
                      <TableRow key={consultation.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(new Date(consultation.date), 'dd/MM/yyyy')}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(consultation.date), 'HH:mm')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{consultation.patientName}</span>
                            {consultation.patientAge && (
                              <span className="text-sm text-muted-foreground">
                                {consultation.patientAge} anos
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {consultation.type === 'telemedicine' ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                            <span className="text-sm">
                              {consultation.type === 'telemedicine' ? 'Telemedicina' : 'Presencial'}
                            </span>
                            {consultation.isEmergency && (
                              <Badge variant="destructive" className="text-xs">
                                Emergência
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{consultation.duration} min</TableCell>
                        <TableCell>R$ {consultation.amount.toFixed(2).replace('.', ',')}</TableCell>
                        <TableCell>{getStatusBadge(consultation.status)}</TableCell>
                        <TableCell>{getPaymentBadge(consultation.paymentStatus)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewRecord(consultation)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a{' '}
                  {Math.min(currentPage * itemsPerPage, filteredConsultations.length)} de{' '}
                  {filteredConsultations.length} consultas
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog do prontuário */}
        <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Prontuário da Consulta</DialogTitle>
              <DialogDescription>
                Informações detalhadas da consulta realizada
              </DialogDescription>
            </DialogHeader>
            
            {selectedConsultation && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Paciente</Label>
                    <p className="font-medium">{selectedConsultation.patientName}</p>
                  </div>
                  <div>
                    <Label>Data/Hora</Label>
                    <p className="font-medium">
                      {format(new Date(selectedConsultation.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="font-medium">{selectedConsultation.patientEmail || 'Não informado'}</p>
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <p className="font-medium">{selectedConsultation.patientPhone || 'Não informado'}</p>
                  </div>
                </div>

                <Separator />

                <Tabs defaultValue="notes" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="notes">Anotações</TabsTrigger>
                    <TabsTrigger value="diagnosis">Diagnóstico</TabsTrigger>
                    <TabsTrigger value="prescription">Prescrição</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="notes" className="space-y-4">
                    <div>
                      <Label>Notas da Consulta</Label>
                      <Textarea
                        value={selectedConsultation.notes || 'Sem anotações'}
                        readOnly
                        className="min-h-[200px] mt-2"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="diagnosis" className="space-y-4">
                    <div>
                      <Label>Diagnóstico</Label>
                      <Textarea
                        value={selectedConsultation.diagnosis || 'Sem diagnóstico registrado'}
                        readOnly
                        className="min-h-[200px] mt-2"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="prescription" className="space-y-4">
                    <div>
                      <Label>Prescrição</Label>
                      <Textarea
                        value={selectedConsultation.prescription || 'Sem prescrição registrada'}
                        readOnly
                        className="min-h-[200px] mt-2"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Duração</Label>
                    <p className="font-medium">{selectedConsultation.duration} minutos</p>
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <p className="font-medium">R$ {selectedConsultation.amount.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div>
                    <Label>Status do Pagamento</Label>
                    <div className="mt-1">{getPaymentBadge(selectedConsultation.paymentStatus)}</div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}