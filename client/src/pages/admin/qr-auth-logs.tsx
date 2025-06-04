import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/layouts/admin-layout';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface QrAuthLog {
  id: number;
  qrTokenId: number | null;
  scannerUserId: number;
  tokenUserId: number;
  scannedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  scannerName: string;
  tokenUserName: string;
}

const QrAuthLogsPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;

  const { data: logs, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/admin/qr-auth-logs'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/qr-auth-logs');
      const data = await response.json();
      return data as QrAuthLog[];
    }
  });

  // Filtrar logs com base na busca
  const filteredLogs = logs ? logs.filter(log => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      log.scannerName.toLowerCase().includes(query) ||
      log.tokenUserName.toLowerCase().includes(query) ||
      log.ipAddress?.toLowerCase().includes(query) ||
      format(new Date(log.scannedAt), 'dd/MM/yyyy HH:mm').includes(query)
    );
  }) : [];

  // Calcular paginação
  const totalPages = Math.ceil((filteredLogs?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs?.slice(startIndex, startIndex + itemsPerPage);

  // Alternar página
  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Logs de Autenticação QR | Administração | CN Vidas</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 animate-fade-in">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Logs de Autenticação QR
            </h1>
            <p className="text-gray-500 mt-1">
              Visualize os registros de autenticação por QR Code realizados no sistema
            </p>
          </div>
          
          <Button 
            variant="outline" 
            className="mt-4 md:mt-0 btn-modern"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
        
        <Card className="mb-6 card-transition">
          <CardHeader className="pb-3">
            <CardTitle className="animate-slide-left">Registros de Escaneamento de QR Codes</CardTitle>
            <CardDescription className="animate-slide-left delay-100">
              Lista de escaneamentos de QR Codes realizados por administradores e parceiros
            </CardDescription>
            
            <div className="relative mt-2 animate-slide-left delay-200">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, IP ou data..."
                className="pl-8 transition-all duration-300 hover:shadow-sm focus:shadow-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10 animate-fade-in">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Carregando logs...</span>
              </div>
            ) : isError ? (
              <div className="flex justify-center items-center py-10 text-red-500 animate-fade-in">
                Erro ao carregar os logs de autenticação
              </div>
            ) : logs?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground animate-fade-in">
                Nenhum registro de autenticação QR encontrado
              </div>
            ) : (
              <>
                <div className="stagger-list-active">
                  <Table>
                    <TableCaption>Lista de autenticações por QR Code</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Escaneado por</TableHead>
                        <TableHead>QR Code de</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs?.map((log, index) => (
                        <TableRow key={log.id} className="table-row-animate stagger-list-item" style={{ transitionDelay: `${index * 30}ms` }}>
                          <TableCell className="font-medium">
                            {format(new Date(log.scannedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{log.scannerName}</TableCell>
                          <TableCell>{log.tokenUserName}</TableCell>
                          <TableCell>{log.ipAddress || '-'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.success ? "success" : "destructive"}
                              className="transition-all duration-300 hover:shadow-sm"
                            >
                              {log.success ? 'Sucesso' : 'Falha'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {totalPages > 1 && (
                    <Pagination className="mt-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => goToPage(Math.max(1, currentPage - 1))}
                            className={`transition-all duration-300 ${currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-gray-50 hover:shadow-sm"}`}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink 
                                isActive={currentPage === pageNum}
                                onClick={() => goToPage(pageNum)}
                                className="transition-all duration-300 hover:shadow-sm"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        {totalPages > 5 && (
                          <>
                            <PaginationItem>
                              <PaginationEllipsis className="transition-all duration-300" />
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationLink 
                                onClick={() => goToPage(totalPages)}
                                isActive={currentPage === totalPages}
                                className="transition-all duration-300 hover:shadow-sm"
                              >
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          </>
                        )}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                            className={`transition-all duration-300 ${currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-gray-50 hover:shadow-sm"}`}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default QrAuthLogsPage;