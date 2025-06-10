import React, { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Send, Phone, Mail, FileText, HelpCircle, MessageSquare, X, Download } from "lucide-react";
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

// Tipos para documentos legais
interface LegalDocument {
  id: string;
  title: string;
  filename: string;
  description: string;
  lastUpdated?: string;
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

// Lista de documentos legais disponíveis
const legalDocuments: LegalDocument[] = [
  {
    id: "terms-of-use",
    title: "Termos de Uso",
    filename: "terms-of-use.md",
    description: "Documento que estabelece as regras, direitos e responsabilidades para utilização da plataforma CN Vidas."
  },
  {
    id: "privacy-policy",
    title: "Política de Privacidade",
    filename: "privacy-policy.md",
    description: "Detalha como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais e informações médicas."
  },
  {
    id: "user-manual",
    title: "Manual do Usuário",
    filename: "user-manual.md",
    description: "Guia completo sobre todas as funcionalidades da plataforma, com tutoriais passo a passo."
  },
  {
    id: "adhesion-contract",
    title: "Contrato de Adesão",
    filename: "adhesion-contract.md",
    description: "Contrato que rege a relação entre a CN Vidas e seus assinantes, detalhando obrigações e direitos."
  },
  {
    id: "plan-conditions",
    title: "Condições dos Planos",
    filename: "adhesion-contract.md", // Está no mesmo arquivo do contrato de adesão
    description: "Descrição detalhada de cada plano, coberturas, limites, carências e condições específicas."
  },
  {
    id: "cancellation-policy",
    title: "Política de Cancelamento",
    filename: "cancellation-policy.md",
    description: "Regras e condições para cancelamento de planos, reembolsos e período de fidelidade."
  }
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
  
  // Estados para documentos legais
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

  // Carregar conversas salvas ou iniciar uma nova conversa
  useEffect(() => {
    // Verificar se há uma conversa salva no localStorage
    const savedMessages = localStorage.getItem('chatMessages');
    const savedAgent = localStorage.getItem('chatAgent');
    
    if (savedMessages && savedAgent) {
      try {
        // Restaurar conversa salva e corrigir os timestamps
        const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp) // Converter string de volta para Date
        }));
        
        // Validar se todas as mensagens têm timestamps válidos
        const validMessages = parsedMessages.filter((msg: Message) => {
          const dateObj = new Date(msg.timestamp);
          return !isNaN(dateObj.getTime()) && isFinite(dateObj.getTime());
        });
        
        if (validMessages.length > 0) {
          setMessages(validMessages);
          setCurrentAgent(JSON.parse(savedAgent));
        } else {
          // Se não há mensagens válidas, limpar localStorage e iniciar nova conversa
          localStorage.removeItem('chatMessages');
          localStorage.removeItem('chatAgent');
          throw new Error('Dados corrompidos no localStorage');
        }
             } catch (error) {
         console.warn('Erro ao carregar mensagens do localStorage, iniciando nova conversa:', error);
         // Continuar para iniciar nova conversa
         localStorage.removeItem('chatMessages');
         localStorage.removeItem('chatAgent');
       }
    }
    
    // Se não há dados salvos válidos ou houve erro, iniciar nova conversa
    if (!messages.length) {
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

  // Função para formatar time/data
  const formatTime = (date: Date | string | number | undefined | null) => {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime()) || !isFinite(dateObj.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 1) return 'agora';
      if (minutes < 60) return `${minutes}min`;
      if (hours < 24) return `${hours}h`;
      if (days < 7) return `${days}d`;
      
      return dateObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return '';
    }
  };

  // Função para carregar documento legal
  const loadDocument = async (document: LegalDocument) => {
    setIsLoadingDocument(true);
    setSelectedDocument(document);
    
    try {
      const response = await fetch(`/api/legal-documents/${document.filename}`);
      if (!response.ok) {
        throw new Error('Documento não encontrado');
      }
      
      const content = await response.text();
      setDocumentContent(content);
      setIsDocumentModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar documento:', error);
      toast({
        title: "Erro ao carregar documento",
        description: "Não foi possível carregar o documento solicitado. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Função para converter markdown para HTML básico
  const markdownToHtml = (markdown: string) => {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-800 border-b border-gray-200 pb-1">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-900 border-b border-gray-300 pb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-6 text-gray-900 border-b border-gray-400 pb-3">$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>');
    
    // Lists - processar antes dos parágrafos
    const lines = html.split('\n');
    const processedLines = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Lista numerada
      if (trimmedLine.match(/^\d+\.\s/)) {
        if (!inList) {
          processedLines.push('<ol class="list-decimal ml-6 mb-4 space-y-2">');
          inList = 'ol';
        } else if (inList === 'ul') {
          processedLines.push('</ul>');
          processedLines.push('<ol class="list-decimal ml-6 mb-4 space-y-2">');
          inList = 'ol';
        }
        const content = trimmedLine.replace(/^\d+\.\s/, '');
        processedLines.push(`<li class="text-gray-700 leading-relaxed">${content}</li>`);
      }
      // Lista com bullets
      else if (trimmedLine.match(/^[-*]\s/)) {
        if (!inList) {
          processedLines.push('<ul class="list-disc ml-6 mb-4 space-y-2">');
          inList = 'ul';
        } else if (inList === 'ol') {
          processedLines.push('</ol>');
          processedLines.push('<ul class="list-disc ml-6 mb-4 space-y-2">');
          inList = 'ul';
        }
        const content = trimmedLine.replace(/^[-*]\s/, '');
        processedLines.push(`<li class="text-gray-700 leading-relaxed">${content}</li>`);
      }
      else {
        if (inList) {
          processedLines.push(inList === 'ol' ? '</ol>' : '</ul>');
          inList = false;
        }
        processedLines.push(line);
      }
    }
    
    if (inList) {
      processedLines.push(inList === 'ol' ? '</ol>' : '</ul>');
    }
    
    html = processedLines.join('\n');
    
    // Separar parágrafos por linhas duplas em branco
    html = html.replace(/\n\n+/g, '\n\n<p class="mb-4 text-gray-700 leading-relaxed">');
    
    // Adicionar tags de parágrafo no início se não começar com header
    if (!html.match(/^<[h1-6]/)) {
      html = '<p class="mb-4 text-gray-700 leading-relaxed">' + html;
    }
    
    // Fechar parágrafos antes de headers
    html = html.replace(/(<h[1-6][^>]*>)/g, '</p>$1');
    
    // Limpar parágrafos vazios e corrigir estrutura
    html = html.replace(/<p[^>]*><\/p>/g, '');
    html = html.replace(/(<\/p>)\s*(<p[^>]*>)/g, '$1\n$2');
    
    // Line breaks simples
    html = html.replace(/\n(?!<)/g, '<br/>');
    
    // Remover <br/> antes de tags de bloco
    html = html.replace(/<br\/>\s*(<[\/]?(?:h[1-6]|p|ol|ul|li)[^>]*>)/g, '$1');
    
    // Adicionar classes especiais para destacar seções importantes
    html = html.replace(/(IMPORTANTE|ATENÇÃO|AVISO|NOTA):/gi, '<span class="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold text-sm mb-2">$1</span>:');
    
    return html;
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
                  {legalDocuments.map((document) => (
                    <Card key={document.id} className="bg-white shadow-sm hover:shadow transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{document.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-gray-600 mb-4">
                          {document.description}
                        </p>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => loadDocument(document)}
                          disabled={isLoadingDocument}
                        >
                          {isLoadingDocument && selectedDocument?.id === document.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2"></div>
                              Carregando...
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              Visualizar
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Modal para exibir documentos */}
            <Dialog open={isDocumentModalOpen} onOpenChange={setIsDocumentModalOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white">
                <DialogHeader className="pb-4 border-b border-gray-200 bg-gray-50 -mx-6 -mt-6 px-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-xl font-bold text-gray-900">
                        {selectedDocument?.title}
                      </DialogTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Documento oficial da CN Vidas
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (documentContent) {
                            const blob = new Blob([documentContent], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${selectedDocument?.filename || 'documento'}.md`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            toast({
                              title: "Download iniciado",
                              description: "O documento foi baixado com sucesso.",
                            });
                          }
                        }}
                        className="text-xs"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (navigator.share && documentContent) {
                            navigator.share({
                              title: selectedDocument?.title,
                              text: selectedDocument?.description,
                              url: window.location.href
                            });
                          }
                        }}
                        className="text-xs"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Compartilhar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDocumentModalOpen(false)}
                        className="text-xs hover:bg-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                
                <ScrollArea className="h-[70vh] mt-4">
                  <div className="px-6 py-4">
                    {documentContent ? (
                      <div className="prose prose-sm max-w-none">
                        <div 
                          className="text-gray-800 leading-relaxed"
                          dangerouslySetInnerHTML={{ 
                            __html: markdownToHtml(documentContent) 
                          }} 
                        />
                        
                        {/* Footer do documento */}
                        <div className="mt-12 pt-8 border-t border-gray-200 bg-gray-50 -mx-6 px-6 py-4 rounded-lg">
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <div>
                              <p className="font-medium">CN Vidas - Plataforma de Saúde Digital</p>
                              <p>Documento gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="text-right">
                              <p>Para dúvidas: contato@cnvidas.com.br</p>
                              <p>Telefone: 0800 123 4567</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <div className="w-12 h-12 border-3 border-gray-300 border-t-primary rounded-full animate-spin mb-4"></div>
                        <p className="text-lg font-medium">Carregando documento...</p>
                        <p className="text-sm mt-2">Por favor, aguarde enquanto carregamos o conteúdo</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
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