import React, { useState, useEffect } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { getClaims } from "@/lib/api";
import useSubscriptionError from "@/hooks/use-subscription-error";
import PlanUpgradeBanner from "@/components/subscription/plan-upgrade-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import Breadcrumb from "@/components/ui/breadcrumb";
import { UpgradePlanMessage } from "@/components/ui/upgrade-plan-message";
import type { Claim } from '@/shared/types';
import type { ClaimsResponse } from '@/lib/api';

interface StatusConfig {
  icon: React.ReactNode;
  text: string;
  color: string;
}

// Função utilitária para converter datas string em Date
function parseClaimDates(claim: any): Claim {
  return {
    ...claim,
    occurrenceDate: claim.occurrenceDate ? new Date(claim.occurrenceDate) : null,
    createdAt: claim.createdAt ? new Date(claim.createdAt) : null,
    updatedAt: claim.updatedAt ? new Date(claim.updatedAt) : null,
    reviewedAt: claim.reviewedAt ? new Date(claim.reviewedAt) : null,
  };
}

const Claims: React.FC = () => {
  const { user } = useAuth();
  const { subscriptionError, handleApiError } = useSubscriptionError();
  const [showUpgradeMessage, setShowUpgradeMessage] = useState<boolean>(false);
  
  const { data, error, isError }: UseQueryResult<ClaimsResponse, Error> = useQuery({
    queryKey: ["/api/claims"],
    queryFn: getClaims,
    retry: false,
  });
  const claims: Claim[] =
    data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)
      ? (data as ClaimsResponse).data.map(parseClaimDates)
      : [];
  
  useEffect(() => {
    if (
      isError &&
      error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as any).response?.data?.requiresUpgrade
    ) {
      setShowUpgradeMessage(true);
    }
  }, [isError, error]);
  
  useEffect(() => {
    if (error) {
      handleApiError(error);
    }
  }, [error, handleApiError]);
  
  const pendingClaims: Claim[] = claims.filter((c) => c.status === "pending");
  const approvedClaims: Claim[] = claims.filter((c) => c.status === "approved");
  const rejectedClaims: Claim[] = claims.filter((c) => c.status === "rejected");
  
  const statusConfig: Record<string, StatusConfig> = {
    pending: {
      icon: <AlertCircle className="h-10 w-10 text-yellow-500" />,
      text: "Em análise",
      color: "bg-yellow-100 text-yellow-800"
    },
    approved: {
      icon: <CheckCircle className="h-10 w-10 text-green-500" />,
      text: "Aprovado",
      color: "bg-green-100 text-green-800"
    },
    rejected: {
      icon: <XCircle className="h-10 w-10 text-red-500" />,
      text: "Rejeitado",
      color: "bg-red-100 text-red-800"
    }
  };
  
  const getStatusIcon = (status: string): React.ReactNode => {
    return statusConfig[status]?.icon || <FileText className="h-10 w-10 text-gray-500" />;
  };
  
  const getStatusText = (status: string): string => {
    return statusConfig[status]?.text || status;
  };
  
  const getStatusColor = (status: string): string => {
    return statusConfig[status]?.color || "bg-gray-100 text-gray-800";
  };
  
  const formatCurrency = (value: number | null): string => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };
  
  const renderClaimCard = (claim: Claim): React.ReactNode => {
    return (
      <Card key={claim.id} className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{claim.type}</CardTitle>
              <CardDescription>Sinistro #{claim.id}</CardDescription>
            </div>
            <span className={`px-2 py-1 inline-flex text-xs leading-4 font-medium rounded-full ${getStatusColor(claim.status)}`}>
              {getStatusText(claim.status)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="mr-2 h-4 w-4" />
              Ocorrência: {format(new Date(claim.occurrenceDate), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="mr-2 h-4 w-4" />
              {claim.createdAt ? (
                <>Enviado em: {format(new Date(claim.createdAt), "dd/MM/yyyy", { locale: ptBR })}</>
              ) : (
                <span>Data de envio não disponível</span>
              )}
            </div>
            
            {claim.amountRequested !== null && claim.amountRequested !== undefined && (
              <div className="flex items-center text-sm text-gray-600">
                <span className="material-icons text-gray-500 mr-2 text-sm">attach_money</span>
                Valor solicitado: {formatCurrency(claim.amountRequested)}
              </div>
            )}
            
            {claim.amountApproved !== null && claim.amountApproved !== undefined && (
              <div className="flex items-center text-sm text-gray-600">
                <span className="material-icons text-green-500 mr-2 text-sm">paid</span>
                Valor aprovado: {formatCurrency(claim.amountApproved)}
              </div>
            )}
            
            <div className="mt-2">
              <p className="text-sm text-gray-700 font-medium">Descrição:</p>
              <p className="text-sm text-gray-600">{claim.description.substring(0, 150)}...</p>
            </div>
            
            <div className="flex mt-4 pt-4 border-t border-gray-200">
              <Link href={`/claims/${claim.id}`}>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Detalhes
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <DashboardLayout title="Sinistros">
      {/* Mostrar mensagem de upgrade em modal quando necessário */}
      {showUpgradeMessage && (
        <UpgradePlanMessage 
          feature="claims" 
          onClose={() => setShowUpgradeMessage(false)} 
        />
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Exibir banner de upgrade se houver erro de assinatura */}
        {subscriptionError && (
          <PlanUpgradeBanner 
            title={subscriptionError.message}
            description="Faça upgrade do seu plano para acessar o gerenciamento de sinistros"
            requiredPlan={subscriptionError.requiredPlan || "basic"}
            currentPlan={subscriptionError.currentPlan}
            className="mb-6 mt-4"
          />
        )}
        
        {/* Header section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Meus Sinistros</h1>
              <p className="text-gray-600 mt-1">
                Gerencie e acompanhe o status dos seus sinistros
              </p>
            </div>
            <Link href="/claims/new">
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Novo Sinistro
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <AlertCircle className="h-10 w-10 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Em análise</p>
                <h3 className="text-2xl font-bold">{pendingClaims.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Aprovados</p>
                <h3 className="text-2xl font-bold">{approvedClaims.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <XCircle className="h-10 w-10 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Rejeitados</p>
                <h3 className="text-2xl font-bold">{rejectedClaims.length}</h3>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* All claims with tabs */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Todos os Sinistros</h2>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="all">Todos ({claims.length})</TabsTrigger>
              <TabsTrigger value="pending">Em análise ({pendingClaims.length})</TabsTrigger>
              <TabsTrigger value="approved">Aprovados ({approvedClaims.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados ({rejectedClaims.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              {claims.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {claims.map((claim: Claim) => renderClaimCard(claim))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-gray-500">Você não tem sinistros registrados.</p>
                    <Link href="/claims/new">
                      <Button className="mt-4">
                        <FileText className="mr-2 h-4 w-4" />
                        Criar Novo Sinistro
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="pending">
              {pendingClaims.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingClaims.map((claim: Claim) => renderClaimCard(claim))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-gray-500">Você não tem sinistros em análise.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="approved">
              {approvedClaims.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedClaims.map((claim: Claim) => renderClaimCard(claim))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-gray-500">Você não tem sinistros aprovados.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="rejected">
              {rejectedClaims.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rejectedClaims.map((claim: Claim) => renderClaimCard(claim))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-gray-500">Você não tem sinistros rejeitados.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Information about claims */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sobre Sinistros</CardTitle>
            <CardDescription>
              Entenda o processo de envio e análise de sinistros no CN Vidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p>
                O processo de sinistro permite que você solicite reembolsos ou indenizações 
                conforme seu plano CN Vidas. Siga as orientações abaixo para um processo mais ágil:
              </p>
              
              <h3>Como enviar um sinistro</h3>
              <ol>
                <li>Clique em "Novo Sinistro" e selecione o tipo apropriado</li>
                <li>Preencha todos os detalhes solicitados com precisão</li>
                <li>Anexe os documentos necessários (laudos, receitas, comprovantes)</li>
                <li>Confirme as informações e envie a solicitação</li>
              </ol>
              
              <h3>Documentos necessários</h3>
              <ul>
                <li>Laudos médicos com CID e assinatura do médico</li>
                <li>Receitas e prescrições médicas</li>
                <li>Notas fiscais de despesas médicas</li>
                <li>Exames e resultados relevantes</li>
                <li>Boletim de ocorrência (em caso de acidentes)</li>
              </ul>
              
              <h3>Prazos</h3>
              <p>
                A análise de sinistros leva em média até 10 dias úteis, dependendo da complexidade 
                e da completude da documentação enviada. Você receberá notificações sobre o andamento 
                do seu processo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Claims;
