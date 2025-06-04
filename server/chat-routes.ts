import { Router, Request, Response } from "express";
import OpenAI from "openai";

// Criar instância da OpenAI com a chave da API do ambiente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Interface para as mensagens recebidas do cliente
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Interface para o corpo da requisição
interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

// Criar o router para as rotas de chat
export const chatRouter = Router();

// Contexto do sistema para instruir o modelo da OpenAI
const systemContext = `
Você é um assistente de suporte da CN Vidas, uma plataforma de saúde digital que oferece telemedicina, gerenciamento de planos de saúde e outras funcionalidades.

Informações sobre a CN Vidas:
- Plataforma de saúde que conecta pacientes, médicos e parceiros de saúde
- Oferece serviços de telemedicina, gestão de sinistros e outros serviços de saúde
- Tem diversos planos de assinatura: Gratuito, Basic (R$89,90), Basic Familiar (R$149,90), Premium (R$129,90), Premium Familiar (R$199,90), Ultra (R$169,90) e Ultra Familiar (R$239,90)
- Os planos Basic incluem 2 consultas de emergência por mês
- Os planos Premium e Ultra incluem consultas de emergência ilimitadas
- Planos familiares permitem adicionar até 3 dependentes
- Possui um sistema de QR Code para identificação de usuários

Ao responder:
1. Seja amigável, prestativo e humano na sua comunicação
2. Evite respostas genéricas demais, tente ser específico sobre os serviços da CN Vidas
3. Se não souber a resposta exata, ofereça orientar o usuário a consultar a documentação ou entre em contato pelo telefone 0800 123 4567
4. Para perguntas sobre emergências médicas, oriente sempre a buscar atendimento médico imediato
5. Quando possível, forneça passos claros para resolver problemas
6. Evite linguagem técnica ou jargões médicos complexos
7. Assuma sempre que a pessoa tem o plano mais básico, a menos que ela informe o contrário
8. Nunca mencione que é uma IA ou que foi criado pela OpenAI
9. Se for algo que depende de informações específicas do usuário, peça os detalhes para poder ajudar melhor

Documentos legais disponíveis:
- Termos de Uso
- Política de Privacidade
- Manual do Usuário
- Contrato de Adesão
- Condições dos Planos
- Política de Cancelamento
`;

// Rota para processar mensagens do chat
chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body as ChatRequest;

    if (!message) {
      return res.status(400).json({ error: "Mensagem não fornecida" });
    }

    // Preparando o contexto da conversa para a API da OpenAI
    const conversationContext: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemContext },
      // Adicionando o histórico de conversas (limitado a últimas 10 mensagens para manter o contexto relevante)
      ...history.slice(-10).map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      })),
      // Adicionando a mensagem atual do usuário
      { role: "user", content: message }
    ];

    // Fazendo a chamada para a API da OpenAI
    // o modelo "gpt-4o" é o mais recente (lançado em maio de 2024)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // o modelo mais recente da OpenAI
      messages: conversationContext,
      temperature: 0.7,
      max_tokens: 800,
    });

    // Obtendo a resposta do modelo
    const assistantResponse = completion.choices[0].message.content;

    // Enviando a resposta para o cliente
    res.json({ response: assistantResponse });
  } catch (error: any) {
    console.error("Erro ao processar mensagem do chat:", error);
    
    // Fornecendo mensagem de erro apropriada
    const errorMessage = error.response?.data?.error?.message || error.message || "Erro desconhecido";
    
    res.status(500).json({ 
      error: "Falha ao processar mensagem", 
      details: errorMessage 
    });
  }
});

// Exportando o router
export default chatRouter;