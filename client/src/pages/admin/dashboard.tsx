import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, User, Briefcase, Stethoscope, Activity, Clock, Calendar, AlertTriangle } from "lucide-react";
import AdminLayout from "@/components/layouts/admin-layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { Claim, User, Appointment } from '@/shared/types';

interface AdminStats {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalPartners: number;
  totalAppointments: number;
  pendingClaims: number;
}

interface RecentUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  createdAt: string | Date;
}

interface RecentAppointment extends Appointment {
  serviceName?: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
}

interface StatsCard {
  title: string;
  icon: React.ReactNode;
  value: number;
  bg: string;
}

const AdminDashboard: React.FC = () => {
  // Estatísticas de usuários
  const { data: stats = {
    totalUsers: 0,
    totalPatients: 0,
    totalDoctors: 0,
    totalPartners: 0,
    totalAppointments: 0,
    pendingClaims: 0
  } as AdminStats, isLoading: isStatsLoading } = useQuery<AdminStats, Error>({
    queryKey: ["/api/admin/stats"],
    retry: false
  });
  
  // Últimos usuários registrados
  const { data: recentUsers = [], isLoading: isRecentUsersLoading } = useQuery<RecentUser[], Error>({
    queryKey: ["/api/admin/recent-users"],
    retry: false
  });

  // Últimas consultas agendadas
  const { data: recentAppointments = [], isLoading: isRecentAppointmentsLoading } = useQuery<RecentAppointment[], Error>({
    queryKey: ["/api/admin/recent-appointments"],
    retry: false
  });

  // Claims pendentes
  const { data: pendingClaims = [], isLoading: isPendingClaimsLoading } = useQuery<Claim[], Error>({
    queryKey: ["/api/admin/pending-claims"],
    retry: false
  });

  // Placeholder cards para estatísticas
  const statsCards: StatsCard[] = [
    { title: "Total de Usuários", icon: <Users className="h-8 w-8 text-blue-500" />, value: stats.totalUsers, bg: "bg-blue-50" },
    { title: "Pacientes", icon: <User className="h-8 w-8 text-green-500" />, value: stats.totalPatients, bg: "bg-green-50" },
    { title: "Médicos", icon: <Stethoscope className="h-8 w-8 text-purple-500" />, value: stats.totalDoctors, bg: "bg-purple-50" },
    { title: "Parceiros", icon: <Briefcase className="h-8 w-8 text-orange-500" />, value: stats.totalPartners, bg: "bg-orange-50" },
  ];

  const renderUserRole = (role: string): string => {
    switch (role) {
      case 'patient': return 'Paciente';
      case 'doctor': return 'Médico';
      case 'partner': return 'Parceiro';
      default: return 'Admin';
    }
  };

  return (
    <AdminLayout title="Dashboard">
      <div className="grid gap-6">
        {/* Estatísticas principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((card, index) => (
            <Card key={index}>
              <CardContent className={`p-6 ${card.bg} rounded-md`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    {isStatsLoading ? (
                      <Skeleton className="h-9 w-16 mt-1" />
                    ) : (
                      <p className="text-3xl font-bold mt-1">{card.value}</p>
                    )}
                  </div>
                  <div>{card.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs para diferentes visualizações */}
        <Tabs defaultValue="users">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="users">Usuários Recentes</TabsTrigger>
            <TabsTrigger value="appointments">Consultas Recentes</TabsTrigger>
            <TabsTrigger value="claims">Sinistros Pendentes</TabsTrigger>
          </TabsList>

          {/* Tab de usuários recentes */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" /> Usuários Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isRecentUsersLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentUsers?.length > 0 ? (
                      recentUsers.map((user) => (
                        <div key={user.id} className="flex items-center p-3 border rounded-md">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 mr-3">
                            <User size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{user.fullName}</p>
                            <p className="text-sm text-gray-500">{user.email} • {renderUserRole(user.role)}</p>
                          </div>
                          <div className="text-sm text-gray-500">
                            <Calendar size={14} className="inline mr-1" />
                            {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nenhum usuário recente encontrado.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de consultas recentes */}
          <TabsContent value="appointments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5" /> Consultas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isRecentAppointmentsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentAppointments?.length > 0 ? (
                      recentAppointments.map((appointment) => (
                        <div key={appointment.id} className="flex items-center p-3 border rounded-md">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mr-3">
                            <Clock size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{appointment.serviceName || 'Consulta Médica'}</p>
                            <p className="text-sm text-gray-500">Paciente: {appointment.patientName} • Médico: {appointment.doctorName}</p>
                          </div>
                          <div className="text-sm text-gray-500">
                            <Calendar size={14} className="inline mr-1" />
                            {new Date(appointment.scheduledAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nenhuma consulta recente encontrada.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de sinistros pendentes */}
          <TabsContent value="claims" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" /> Sinistros Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isPendingClaimsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingClaims?.length > 0 ? (
                      pendingClaims.map((claim: Claim) => (
                        <div key={claim.id} className="flex items-center p-3 border rounded-md">
                          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 mr-3">
                            <AlertTriangle size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">#{claim.id} - {claim.type}</p>
                            {/* Remover ou tornar opcional o patientName e amount */}
                            {/* <p className="text-sm text-gray-500">Paciente: {claim.patientName} • Valor: R$ {(claim.amount / 100).toFixed(2)}</p> */}
                          </div>
                          <div className="text-sm text-gray-500">
                            <Calendar size={14} className="inline mr-1" />
                            {claim.createdAt ? (
                              <>{new Date(claim.createdAt).toLocaleDateString('pt-BR')}</>
                            ) : (
                              <span>Data não disponível</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nenhum sinistro pendente encontrado.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;