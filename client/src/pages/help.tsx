import React, { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Send, Phone, Mail, FileText, HelpCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Tipos para as mensagens do chat
interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  agentName?: string;
  agentAvatar?: string;
  status?: "enviado" | "recebido" | "lido";
  isTyping?: boolean;
}

// Lista de possíveis nomes de agentes para o chatbot
const agentNames = [
  { name: "Ana Silva", avatar: "AS" },
  { name: "Rafael Oliveira", avatar: "RO" },
  { name: "Carla Mendes", avatar: "CM" },
  { name: "Thiago Santos", avatar: "TS" },
  { name: "Mariana Costa", avatar: "MC" },
  { name: "Bruno Almeida", avatar: "BA" },
  { name: "Juliana Ferreira", avatar: "JF" },
  { name: "Lucas Pereira", avatar: "LP" }
];

const HelpPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentAgent, setCurrentAgent] = useState(agentNames[0]);

  // Carregar conversas salvas ou iniciar uma nova conversa
  useEffect(() => {
    // Verificar se há uma conversa salva no localStorage
    const savedMessages = localStorage.getItem('chatMessages');
    const savedAgent = localStorage.getItem('chatAgent');
    
    if (savedMessages && savedAgent) {
      // Restaurar conversa salva
      setMessages(JSON.parse(savedMessages));
      setCurrentAgent(JSON.parse(savedAgent));
    } else {
      // Iniciar uma nova conversa com um agente aleatório
      const randomAgent = agentNames[Math.floor(Math.random() * agentNames.length)];
      setCurrentAgent(randomAgent);
      
      // Adicionar mensagem inicial de boas-vindas
      const welcomeMessage = {
        id: Date.now().toString(),
        content: `Olá ${user?.fullName || ""}! Meu nome é ${randomAgent.name} e estou aqui para ajudar. Como posso auxiliar você hoje com a CN Vidas?`,
        role: "assistant" as const,
        timestamp: new Date(),
        agentName: randomAgent.name,
        agentAvatar: randomAgent.avatar,
        status: "enviado" as const
      };
      
      setMessages([welcomeMessage]);
      
      // Salvar no localStorage
      localStorage.setItem('chatAgent', JSON.stringify(randomAgent));
      localStorage.setItem('chatMessages', JSON.stringify([welcomeMessage]));
      
      // Simular recebimento e leitura da mensagem inicial após alguns segundos
      setTimeout(() => {
        const updatedMessages = [
          { ...welcomeMessage, status: "recebido" as const }
        ];
        setMessages(updatedMessages);
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      }, 1000);
      
      setTimeout(() => {
        const updatedMessages = [
          { ...welcomeMessage, status: "lido" as const }
        ];
        setMessages(updatedMessages);
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      }, 2500);
    }
  }, []);

  // Rolagem automática para a última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Adiciona a mensagem do usuário ao histórico
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: "user",
      timestamp: new Date(),
      status: "enviado"
    };

    // Atualizar mensagens e salvar no localStorage
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
    
    setInputMessage("");
    setIsLoading(true);
    
    // Simular recebimento e leitura da mensagem do usuário
    setTimeout(() => {
      const updatedMessagesWithReceipt = updatedMessages.map(msg => 
        msg.id === userMessage.id ? {...msg, status: "recebido"} : msg
      );
      setMessages(updatedMessagesWithReceipt as Message[]);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessagesWithReceipt));
    }, 800);
    
    setTimeout(() => {
      const updatedMessagesWithRead = updatedMessages.map(msg => 
        msg.id === userMessage.id ? {...msg, status: "lido"} : msg
      );
      setMessages(updatedMessagesWithRead as Message[]);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessagesWithRead));
    }, 1800);

    try {
      // Simulando um tempo de digitação do agente antes de enviar para a API
      // Isso vai mostrar a animação de digitação
      const typingIndicatorId = Date.now().toString() + "-typing";
      const typingMessage: Message = {
        id: typingIndicatorId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
        agentName: currentAgent.name,
        agentAvatar: currentAgent.avatar,
        isTyping: true
      };
      
      // Atraso maior para começar a digitação (momento em que o agente "começou a digitar")
      // O agente levará mais tempo para "ler" a mensagem
      setTimeout(() => {
        setMessages(prev => [...prev, typingMessage]);
      }, 5000);
      
      // Enviando a mensagem para o backend após um tempo de "leitura"
      await new Promise(resolve => setTimeout(resolve, 3000)); // Tempo para "ler" a mensagem
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputMessage,
          history: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao obter resposta do chatbot");
      }

      const data = await response.json();
      
      // Formatando o conteúdo para substituir **texto** por <strong>texto</strong>
      const formattedContent = data.response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Esperamos um pouco mais depois de receber a resposta da API para simular
      // o tempo que a pessoa levaria para digitar a resposta
      // Tempo mínimo de 8 segundos ou baseado no tamanho da resposta (45ms por caractere)
      const typingTime = Math.max(8000, formattedContent.length * 45);
      
      setTimeout(() => {
        // Remove o indicador de digitação e adiciona a resposta real
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.id !== typingIndicatorId);
          const assistantMessage: Message = {
            id: Date.now().toString() + "-assistant",
            content: formattedContent,
            role: "assistant",
            timestamp: new Date(),
            agentName: currentAgent.name,
            agentAvatar: currentAgent.avatar,
            status: "enviado"
          };
          return [...filtered, assistantMessage];
        });
        setIsLoading(false);
        
        // Adicionar status "recebido" e "lido" com atraso
        const messageId = Date.now().toString() + "-assistant";
        setTimeout(() => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? {...msg, status: "recebido"} : msg
          ));
        }, 800);
        
        setTimeout(() => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? {...msg, status: "lido"} : msg
          ));
        }, 1800);
      }, typingTime);
      
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      toast({
        title: "Erro de comunicação",
        description: "Não foi possível obter resposta do assistente virtual. Tente novamente mais tarde.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Formatar data para exibição
  const formatTime = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }).format(date);
    } catch (e) {
      console.error('Erro ao formatar data:', e);
      return '00:00'; // Formato padrão em caso de erro
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 max-w-7xl">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">Fale Conosco</h1>
        <p className="text-gray-600 mb-3 md:mb-6 text-sm md:text-base">
          Tire suas dúvidas, consulte nossa documentação ou converse com nossa equipe
        </p>

        <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="mb-6 bg-slate-100 p-1 flex flex-wrap sm:flex-nowrap gap-1">
            <TabsTrigger value="chat" className="flex-1 flex items-center justify-center gap-1 text-xs sm:text-sm md:gap-2">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:block">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex-1 flex items-center justify-center gap-1 text-xs sm:text-sm md:gap-2">
              <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:block">FAQ</span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex-1 flex items-center justify-center gap-1 text-xs sm:text-sm md:gap-2">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:block">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex-1 flex items-center justify-center gap-1 text-xs sm:text-sm md:gap-2">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sm:block">Contato</span>
            </TabsTrigger>
          </TabsList>

          {/* Conteúdo da aba de Chat com Suporte */}
          <TabsContent value="chat" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="px-6 py-2 md:py-4 border-b">
                <CardTitle className="text-sm md:text-lg">Atendimento Virtual</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Converse com nossa equipe de suporte para resolver suas dúvidas
                </CardDescription>
              </CardHeader>
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-3/4 border-r">
                  <div className="h-[350px] md:h-[500px] flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} gap-3`}
                        >
                          {message.role === "assistant" && (
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarFallback className="bg-primary text-white">
                                {message.agentAvatar}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div 
                            className={`max-w-[80%] p-3 rounded-lg ${
                              message.role === "user" 
                                ? "bg-primary text-white rounded-tr-none" 
                                : "bg-gray-100 text-gray-800 rounded-tl-none"
                            }`}
                          >
                            {message.role === "assistant" && (
                              <div className="font-medium text-xs text-gray-500 mb-1">
                                {message.agentName} • {formatTime(message.timestamp)}
                              </div>
                            )}
                            <div className="whitespace-pre-wrap text-sm" 
                              dangerouslySetInnerHTML={{ __html: message.content }}>
                            </div>
                            {message.role === "user" && (
                              <div className="text-right font-medium text-xs text-primary-100 mt-1 flex items-center justify-end gap-1">
                                {formatTime(message.timestamp)}
                                {message.status === "enviado" && (
                                  <span title="Enviado">✓</span>
                                )}
                                {message.status === "recebido" && (
                                  <span title="Recebido">✓✓</span>
                                )}
                                {message.status === "lido" && (
                                  <span title="Lido" className="text-blue-400">✓✓</span>
                                )}
                              </div>
                            )}
                          </div>
                          {message.role === "user" && (
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              {user?.profileImage ? (
                                <AvatarImage src={user.profileImage} alt={user.fullName} />
                              ) : (
                                <AvatarFallback className="bg-primary/80 text-white">
                                  <User className="h-5 w-5" />
                                </AvatarFallback>
                              )}
                            </Avatar>
                          )}
                        </div>
                      ))}
                                      {messages.map((message) => (
                        message.isTyping && (
                          <div key={message.id} className="flex justify-start gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarFallback className="bg-primary text-white">
                                {currentAgent.avatar}
                              </AvatarFallback>
                            </Avatar>
                            <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-800 rounded-tl-none">
                              <div className="font-medium text-xs text-gray-500 mb-1">
                                {message.agentName} • {formatTime(message.timestamp)}
                              </div>
                              <div className="flex space-x-2 items-center py-2">
                                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                              </div>
                            </div>
                          </div>
                        )
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t bg-white">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Digite sua mensagem..."
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={isLoading}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleSendMessage} 
                          disabled={isLoading || !inputMessage.trim()}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block w-full md:w-1/4 p-4 bg-gray-50/80">
                  <h3 className="font-medium text-gray-800 mb-4">Você está conversando com:</h3>
                  <div className="flex items-center gap-3 mb-6">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-white">
                        {currentAgent.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{currentAgent.name}</div>
                      <div className="text-sm text-gray-500">Especialista em Suporte</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <h4 className="font-medium text-gray-700 mb-2">Tópicos populares:</h4>
                    <ul className="space-y-2 list-disc pl-5">
                      <li>Como utilizar a telemedicina</li>
                      <li>Dúvidas sobre assinatura</li>
                      <li>Abertura de sinistros</li>
                      <li>Dúvidas sobre cobertura</li>
                      <li>Configurações de conta</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Conteúdo da aba de FAQ */}
          <TabsContent value="faq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Perguntas Frequentes</CardTitle>
                <CardDescription>
                  Respostas para as dúvidas mais comuns sobre a CN Vidas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Como funciona a telemedicina da CN Vidas?</AccordionTrigger>
                    <AccordionContent>
                      <p>A telemedicina da CN Vidas permite que você consulte médicos de diversas especialidades por videochamada, sem sair de casa. Para usar:</p>
                      <ol className="list-decimal pl-5 mt-2 space-y-1">
                        <li>Acesse a seção "Telemedicina" no menu lateral</li>
                        <li>Escolha entre consulta agendada ou emergencial (dependendo do seu plano)</li>
                        <li>Selecione a especialidade médica desejada</li>
                        <li>Escolha o médico e o horário (para consultas agendadas)</li>
                        <li>No horário marcado, clique em "Iniciar consulta"</li>
                      </ol>
                      <p className="mt-2">Todas as consultas são seguras, criptografadas e seguem as regulamentações da área de saúde.</p>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Quais são os planos de assinatura disponíveis?</AccordionTrigger>
                    <AccordionContent>
                      <p>A CN Vidas oferece diversos planos para atender diferentes necessidades:</p>
                      <ul className="list-disc pl-5 mt-2 space-y-2">
                        <li>
                          <strong>Plano Gratuito:</strong> Acesso básico à plataforma sem custo.
                        </li>
                        <li>
                          <strong>Plano Basic (R$ 89,90):</strong> Inclui 2 consultas de emergência por mês, acesso a telemedicina e serviços básicos.
                        </li>
                        <li>
                          <strong>Plano Basic Familiar (R$ 149,90):</strong> Mesmos benefícios do Basic, com cobertura para até 3 dependentes.
                        </li>
                        <li>
                          <strong>Plano Premium (R$ 129,90):</strong> Consultas de emergência ilimitadas, prioridade no agendamento e serviços adicionais.
                        </li>
                        <li>
                          <strong>Plano Premium Familiar (R$ 199,90):</strong> Benefícios Premium com cobertura familiar para até 3 dependentes.
                        </li>
                        <li>
                          <strong>Plano Ultra (R$ 169,90):</strong> Todos os benefícios Premium mais serviços exclusivos e acesso prioritário.
                        </li>
                        <li>
                          <strong>Plano Ultra Familiar (R$ 239,90):</strong> Experiência Ultra completa com cobertura familiar.
                        </li>
                      </ul>
                      <p className="mt-2">Você pode gerenciar sua assinatura a qualquer momento na seção "Planos".</p>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Como abrir um sinistro e qual é o prazo de análise?</AccordionTrigger>
                    <AccordionContent>
                      <p>Para abrir um sinistro na CN Vidas:</p>
                      <ol className="list-decimal pl-5 mt-2 space-y-1">
                        <li>Acesse a seção "Sinistros" no menu lateral</li>
                        <li>Clique em "Novo Sinistro"</li>
                        <li>Preencha o formulário com os detalhes do ocorrido</li>
                        <li>Anexe documentos relevantes (laudos, receitas, notas fiscais)</li>
                        <li>Envie o sinistro para análise</li>
                      </ol>
                      <p className="mt-2">O prazo médio de análise é de 5 dias úteis, podendo variar de acordo com a complexidade do caso e documentação apresentada. Você pode acompanhar o status do seu sinistro a qualquer momento na plataforma.</p>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-4">
                    <AccordionTrigger>Como adicionar dependentes ao meu plano familiar?</AccordionTrigger>
                    <AccordionContent>
                      <p>Se você possui um plano familiar, pode adicionar até 3 dependentes:</p>
                      <ol className="list-decimal pl-5 mt-2 space-y-1">
                        <li>Acesse a seção "Dependentes" no menu lateral</li>
                        <li>Clique em "Adicionar Dependente"</li>
                        <li>Informe o nome completo, CPF e data de nascimento do dependente</li>
                        <li>Selecione o grau de parentesco</li>
                        <li>Confirme as informações e salve</li>
                      </ol>
                      <p className="mt-2">Seus dependentes terão acesso aos mesmos benefícios do seu plano familiar. Caso precise adicionar mais de 3 dependentes, entre em contato com nosso suporte para avaliar opções personalizadas.</p>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-5">
                    <AccordionTrigger>O que é o sistema de QR Code e como utilizá-lo?</AccordionTrigger>
                    <AccordionContent>
                      <p>O sistema de QR Code da CN Vidas facilita a identificação e acesso a serviços parceiros:</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>O QR Code é um código único gerado para cada usuário da plataforma</li>
                        <li>Médicos e pacientes podem gerar e apresentar seu QR Code</li>
                        <li>Parceiros e administradores podem escanear o QR Code para validar atendimentos</li>
                        <li>O código contém informações essenciais e seguras sobre seu plano</li>
                      </ul>
                      <p className="mt-2">Para acessar seu QR Code, clique em "Meu QR Code" no menu lateral. Você pode exibi-lo na tela ou salvá-lo para uso offline.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conteúdo da aba de Documentação */}
          <TabsContent value="docs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documentação e Termos</CardTitle>
                <CardDescription>
                  Todos os documentos, termos e políticas da CN Vidas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Termos de Uso</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-4">
                        Documento que estabelece as regras, direitos e responsabilidades para utilização da plataforma CN Vidas.
                      </p>
                      <Button variant="outline" className="w-full">Visualizar</Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Política de Privacidade</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-4">
                        Detalha como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais e informações médicas.
                      </p>
                      <Button variant="outline" className="w-full">Visualizar</Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Manual do Usuário</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-4">
                        Guia completo sobre todas as funcionalidades da plataforma, com tutoriais passo a passo.
                      </p>
                      <Button variant="outline" className="w-full">Visualizar</Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Contrato de Adesão</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-4">
                        Contrato que rege a relação entre a CN Vidas e seus assinantes, detalhando obrigações e direitos.
                      </p>
                      <Button variant="outline" className="w-full">Visualizar</Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Condições dos Planos</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-4">
                        Descrição detalhada de cada plano, coberturas, limites, carências e condições específicas.
                      </p>
                      <Button variant="outline" className="w-full">Visualizar</Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Política de Cancelamento</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-4">
                        Regras e condições para cancelamento de planos, reembolsos e período de fidelidade.
                      </p>
                      <Button variant="outline" className="w-full">Visualizar</Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conteúdo da aba de Contato Direto */}
          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contato Direto</CardTitle>
                <CardDescription>
                  Entre em contato com nossa equipe por outros canais de atendimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border border-gray-200">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Phone className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium text-lg mb-2">Telefone</h3>
                      <p className="text-gray-600 mb-4">Atendimento telefônico das 8h às 20h, de segunda a sábado.</p>
                      <div className="text-lg font-semibold text-primary">0800 123 4567</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-gray-200">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium text-lg mb-2">E-mail</h3>
                      <p className="text-gray-600 mb-4">Envie sua mensagem para nosso e-mail de atendimento.</p>
                      <div className="text-lg font-semibold text-primary">contato@cnvidas.com.br</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-gray-200">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium text-lg mb-2">WhatsApp</h3>
                      <p className="text-gray-600 mb-4">Atendimento rápido via WhatsApp, disponível 24/7.</p>
                      <div className="text-lg font-semibold text-primary">(51) 98765-4321</div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mt-8 border-t pt-8">
                  <h3 className="text-lg font-medium mb-4">Envie uma mensagem</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                      <Input placeholder="Seu nome completo" defaultValue={user?.fullName || ""} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                      <Input placeholder="seu.email@exemplo.com" defaultValue={user?.email || ""} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                    <Input placeholder="Informe o assunto da sua mensagem" />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                    <textarea 
                      className="w-full min-h-[150px] rounded-md border border-gray-300 p-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Descreva detalhadamente sua solicitação ou dúvida"
                    ></textarea>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90">
                    Enviar mensagem
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default HelpPage;