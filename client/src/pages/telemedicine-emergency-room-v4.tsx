import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import TelemedicineEmergencyV4 from "./telemedicine-emergency-v4";
import { BookOpen, Info, AlertCircle, Phone } from "lucide-react";

interface User {
  id: number;
  fullName: string;
  role: "patient" | "doctor" | "admin" | "partner";
}

const TelemedicineEmergencyRoomV4 = () => {
  const [_, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>("/emergency-room-v4/:id");
  const [problemType, setProblemType] = useState("");
  const [complaint, setComplaint] = useState("");
  const [startConsultation, setStartConsultation] = useState(false);
  
  // Se já tem ID na rota, vai direto para a videochamada
  const emergencyId = match ? params.id : null;

  // Obtém dados do usuário
  const { data: user, isLoading: isLoadingUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Se houver um ID de emergência na URL, mostrar a sala de videochamada
  if (emergencyId || startConsultation) {
    return (
      <TelemedicineEmergencyV4 
        patientMode={user?.role === "patient"}
        doctorMode={user?.role === "doctor"}
        appointmentId={emergencyId || undefined}
      />
    );
  }

  // Loading state
  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  // Verificar se o usuário é um paciente ou médico
  const isPatient = user?.role === "patient";
  const isDoctor = user?.role === "doctor";

  // Médicos vêem a lista de chamadas de emergência disponíveis
  if (isDoctor) {
    return (
      <div className="container py-10 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Emergências Médicas - Nova Plataforma (v4)</CardTitle>
            <CardDescription>
              Nova plataforma de consultas de emergência com maior estabilidade e desempenho
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center p-4 bg-amber-50 text-amber-800 rounded-md mb-6">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">
                Esta é uma versão de teste da nova plataforma de telemedicina. 
                Por favor, reporte qualquer problema encontrado à equipe de suporte.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-muted/30 p-6 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Consultas de Emergência Disponíveis</h3>
                
                <div className="text-center py-10">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma consulta de emergência aguardando atendimento no momento
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    As consultas aparecerão aqui quando pacientes solicitarem atendimento
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 p-6 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Saiba Mais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      <BookOpen className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">Nova Tecnologia</h4>
                      <p className="text-sm text-muted-foreground">
                        Estamos utilizando o Agora.io para videochamadas, com melhor qualidade e estabilidade.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      <Info className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">Atendimentos de Emergência</h4>
                      <p className="text-sm text-muted-foreground">
                        Pacientes na nova plataforma terão o mesmo padrão de atendimento e regras de pagamento.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pacientes vêem o formulário para iniciar uma consulta de emergência
  return (
    <div className="container py-10 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Emergência Médica - Nova Plataforma (v4)</CardTitle>
          <CardDescription>
            Inicie uma consulta de emergência com um médico disponível
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center p-4 bg-amber-50 text-amber-800 rounded-md mb-6">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <p className="text-sm">
              Esta é uma versão de teste da nova plataforma de telemedicina. 
              Por favor, reporte qualquer problema encontrado à equipe de suporte.
            </p>
          </div>

          <Tabs defaultValue="emergency">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="emergency">Iniciar Consulta de Emergência</TabsTrigger>
            </TabsList>
            <TabsContent value="emergency" className="py-4">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="problemType">Tipo de Problema</Label>
                  <RadioGroup 
                    id="problemType" 
                    className="mt-3"
                    value={problemType}
                    onValueChange={setProblemType}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Clínico Geral" id="clinico" />
                      <Label htmlFor="clinico">Clínico Geral</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Cardiologia" id="cardio" />
                      <Label htmlFor="cardio">Cardiologia</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Dermatologia" id="derma" />
                      <Label htmlFor="derma">Dermatologia</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Neurologia" id="neuro" />
                      <Label htmlFor="neuro">Neurologia</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Ortopedia" id="orto" />
                      <Label htmlFor="orto">Ortopedia</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Outro" id="outro" />
                      <Label htmlFor="outro">Outro</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="complaint">Descreva seu problema ou sintomas</Label>
                  <Textarea
                    id="complaint"
                    className="mt-2"
                    placeholder="Por favor, descreva seus sintomas ou o motivo da consulta em detalhes"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-md">
                  <h3 className="text-blue-700 font-medium mb-2">Importante</h3>
                  <p className="text-sm text-blue-700">
                    Após iniciar a consulta, você será conectado a um médico disponível conforme a
                    especialidade selecionada. Em casos graves, busque atendimento presencial imediato.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar
          </Button>
          <Button
            disabled={!problemType || !complaint}
            onClick={() => setStartConsultation(true)}
          >
            Iniciar Consulta de Emergência
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TelemedicineEmergencyRoomV4;