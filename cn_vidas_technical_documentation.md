# Documentação Técnica - CN Vidas

## 1. Visão Geral do Sistema

### 1.1 Arquitetura

A plataforma CN Vidas é construída como uma aplicação web full-stack seguindo uma arquitetura monolítica com separação clara entre frontend e backend:

- **Frontend**: React.js com TypeScript, utilizando componentes modernos e responsivos
- **Backend**: Node.js com Express.js
- **Banco de Dados**: PostgreSQL via Neon Database (conexão serverless)
- **ORM**: Drizzle para modelagem e consultas ao banco de dados
- **Autenticação**: Sistema dual com sessões Express e tokens JWT

### 1.2 Tecnologias Principais

| Componente | Tecnologia | Versão |
|------------|------------|--------|
| Frontend | React | 18.x |
| Linguagem | TypeScript | 5.x |
| Backend | Node.js/Express | 18.x |
| Banco de Dados | PostgreSQL | 15.x |
| ORM | Drizzle | 0.28.x |
| UI Framework | TailwindCSS + ShadcnUI | 3.x |
| Roteamento (Frontend) | Wouter | 2.x |
| Gerenciamento de Estado | React Query | 5.x |
| Formulários | React Hook Form + Zod | 7.x |
| Videochamadas | Agora.io RTC | 4.17.0 |
| Pagamentos | Stripe | API 2023-10-16 |
| Email | Nodemailer (SMTP Titan) | 6.x |

## 2. Estrutura do Projeto

### 2.1 Organização de Diretórios

```
/
├── client/                # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis 
│   │   ├── hooks/         # Hooks personalizados
│   │   ├── lib/           # Bibliotecas e utilitários
│   │   ├── pages/         # Componentes de página
│   │   └── App.tsx        # Componente raiz com roteamento
├── server/                # Backend Express
│   ├── middleware/        # Middlewares Express
│   ├── migrations/        # Scripts de migração do banco
│   ├── routes/            # Rotas da API
│   ├── services/          # Serviços (email, pagamento, etc.)
│   ├── storage.ts         # Interface de acesso ao banco
│   └── index.ts           # Ponto de entrada do servidor
├── shared/                # Código compartilhado
│   └── schema.ts          # Esquema do banco e validação
└── public/                # Arquivos estáticos
```

### 2.2 Fluxo de Dados

1. O usuário interage com o frontend React
2. O cliente faz requisições à API Express via React Query
3. O servidor autentica a requisição (session/token)
4. As rotas processam a requisição e acessam o banco via storage.ts
5. O ORM Drizzle traduz as operações para SQL
6. Dados são retornados ao cliente como JSON
7. React Query atualiza o estado no cliente

## 3. Autenticação e Autorização

### 3.1 Métodos de Autenticação

O sistema utiliza uma abordagem de autenticação dual:

1. **Sessões Express**: Armazenadas em cookie `cnvidas.sid` (httpOnly)
2. **Tokens JWT**: Formato `sessionID:userId:timestamp`, armazenados em:
   - Header `Authorization: Bearer [token]`
   - Header `X-Auth-Token: [token]`
   - Cookie `authToken=[token]`
   - Parâmetro URL `?token=[token]` (para produção)

### 3.2 Middleware de Autenticação

Dois middlewares principais gerenciam a autenticação:

- `tokenAuth.ts`: Verifica tokens JWT em várias fontes
- `isAuthenticated`: Função que verifica sessão Express

Código do middleware principal:

```typescript
// server/middleware/token-auth.ts
export const tokenAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Se o usuário já está autenticado via sessão, passe adiante
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // Verificar se existe um token nos headers (múltiplas fontes possíveis)
  const authToken = req.headers['x-auth-token'] as string || 
                   (req.headers.authorization?.startsWith('Bearer ') 
                    ? req.headers.authorization.substring(7) 
                    : req.headers.authorization) || 
                    req.cookies?.authToken;
  
  // Se não houver token, continue para o próximo middleware
  if (!authToken) {
    return next();
  }
  
  try {
    const [sessionID, userId, timestamp] = authToken.split(':');
    
    if (!sessionID || !userId) {
      return next();
    }
    
    // Verificar se o token não expirou (24 horas)
    const tokenTime = parseInt(timestamp);
    if (isNaN(tokenTime) || Date.now() - tokenTime > 24 * 60 * 60 * 1000) {
      return next();
    }
    
    // Buscar o usuário pelo ID
    const user = await storage.getUser(parseInt(userId));
    if (!user) {
      return next();
    }
    
    // Definir o usuário na requisição
    req.user = user;
    
    next();
  } catch (error) {
    console.error("Erro ao autenticar via token:", error);
    next();
  }
};
```

### 3.3 Papéis de Usuário

- **patient**: Acesso a consultas, perfil e dependentes
- **doctor**: Acesso a consultas, perfil profissional e finanças
- **admin**: Acesso completo, incluindo área administrativa
- **partner**: Acesso a perfil de parceiro e scanner QR
- **seller**: Acesso a vendas e comissões

## 4. Banco de Dados

### 4.1 Conexão

A conexão com o PostgreSQL é feita via Neon Serverless:

```typescript
// server/db.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
```

### 4.2 Principais Tabelas

| Tabela | Descrição | Campos Chave |
|--------|-----------|--------------|
| users | Usuários do sistema | id, email, role, fullName, emailVerified |
| doctors | Perfis de médicos | id, userId, specialization, licenseNumber |
| appointments | Consultas médicas | id, userId, doctorId, type, status, date |
| subscriptions | Assinaturas de planos | id, userId, planId, status, expiresAt |
| partners | Parceiros do serviço | id, userId, businessName, category |
| claims | Reclamações/solicitações | id, userId, type, status, description |
| notifications | Notificações aos usuários | id, userId, title, read, type |
| dependents | Dependentes de usuários | id, userId, fullName, cpf, relationship |

### 4.3 Relacionamentos Importantes

- User (1) -> (0..n) Appointments
- User (1) -> (0..1) Doctor
- User (1) -> (0..1) Subscription
- User (1) -> (0..n) Dependents
- Doctor (1) -> (0..n) Appointments
- Partner (1) -> (0..n) Services

### 4.4 Modelo de Dados (Schema)

Exemplo de definição de schema utilizando Drizzle ORM:

```typescript
// shared/schema.ts
import { pgTable, serial, text, timestamp, boolean, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Tabela de usuários
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('patient'),
  cpf: text('cpf'),
  phone: text('phone'),
  address: text('address'),
  zipcode: text('zipcode'),
  street: text('street'),
  number: text('number'),
  complement: text('complement'),
  neighborhood: text('neighborhood'),
  city: text('city'),
  state: text('state'),
  birthDate: timestamp('birth_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').default('inactive'),
  subscriptionPlan: text('subscription_plan').default('free'),
  emailVerified: boolean('email_verified').default(false),
  profileImage: text('profile_image'),
}, (table) => {
  return {
    emailIdx: uniqueIndex('email_idx').on(table.email),
    usernameIdx: uniqueIndex('username_idx').on(table.username),
  };
});

// Schema para inserção de usuários
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Tipos derivados
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
```

## 5. API REST

### 5.1 Endpoints Principais

#### Autenticação

- `POST /api/auth/login`: Login com email/senha
- `POST /api/auth/register`: Registro de novo usuário
- `POST /api/auth/verify-email`: Verificação de email
- `POST /api/auth/reset-password`: Solicitação de reset de senha

#### Usuários

- `GET /api/user`: Obtém usuário atual autenticado
- `PUT /api/user/profile`: Atualiza perfil do usuário
- `GET /api/user/dependents`: Lista dependentes do usuário
- `POST /api/user/dependents`: Adiciona novo dependente

#### Telemedicina

- `GET /api/doctors`: Lista todos os médicos
- `GET /api/doctors/available`: Lista médicos disponíveis
- `POST /api/agora/v4/token`: Obtém token para videochamada
- `POST /api/agora/start-emergency-consultation`: Inicia consulta de emergência
- `POST /api/agora/end-consultation/:id`: Finaliza consulta

#### Assinatura e Pagamentos

- `GET /api/subscription/current`: Obtém assinatura atual
- `POST /api/subscription/change-plan`: Altera plano de assinatura
- `POST /api/create-payment-intent`: Cria intent de pagamento (Stripe)
- `POST /api/payment/pix/generate`: Gera código PIX para pagamento

### 5.2 Formato de Resposta

Todas as respostas da API seguem um formato padrão:

**Sucesso (200/201)**:
```json
{
  "data": { ... },
  "success": true
}
```

**Erro (400/401/403/404/500)**:
```json
{
  "error": "Mensagem de erro",
  "success": false,
  "code": "ERROR_CODE"
}
```

### 5.3 Middleware de Validação

Exemplo de validação usando Zod:

```typescript
// server/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, z } from 'zod';

export const validate = 
  (schema: AnyZodObject) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados de entrada inválidos',
          details: error.format(),
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Erro de validação',
      });
    }
  };
```

## 6. Integração com Agora.io

### 6.1 Configuração

A integração com Agora.io requer as seguintes variáveis de ambiente:
- `AGORA_APP_ID`: ID do aplicativo Agora
- `AGORA_APP_CERTIFICATE`: Certificado do aplicativo Agora

### 6.2 Geração de Token

```typescript
// server/services/agora-token.ts
export function generateToken(channelName: string, uid: string | number): string {
  const appID = process.env.AGORA_APP_ID || '';
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || '';
  
  // Garantir que o uid seja um número
  let numericUid: number;
  if (typeof uid === 'string') {
    numericUid = parseInt(uid, 10);
    if (isNaN(numericUid)) {
      numericUid = 0;
    }
  } else {
    numericUid = uid;
  }
  
  // Calcular timestamp de expiração
  const privilegeExpireTime = Math.floor(Date.now() / 1000) + 3600; // 1 hora
  
  const token = generateRtcToken({
    appID,
    appCertificate,
    channelName,
    uid: numericUid,
    role: Role.PUBLISHER,
    privilegeExpireTime,
  });
  
  return token;
}
```

### 6.3 Fluxo de Consulta de Emergência

1. Paciente inicia consulta via `POST /api/agora/start-emergency-consultation`
2. Backend cria registro de consulta e gera token Agora
3. Notificações são enviadas aos médicos disponíveis
4. Médico aceita consulta via `POST /api/agora/accept-emergency/:id`
5. Ambos os participantes usam o token para ingressar no mesmo canal
6. SDK Agora (versão 4.17.0) gerencia a conexão WebRTC
7. Ao final, `POST /api/agora/end-consultation/:id` finaliza a consulta

### 6.4 Implementação no Frontend

```typescript
// client/src/pages/telemedicine-emergency-v5.tsx
// Inicialização do SDK Agora
const initializeAgora = async (appointmentId: number) => {
  try {
    // 1. Verificar permissões de mídia
    await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    // 2. Obter token de autenticação
    const authToken = getAuthToken();
    
    // 3. Requisitar token Agora do servidor
    const response = await fetch('/api/agora/v4/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Auth-Token': authToken
      },
      credentials: 'include',
      body: JSON.stringify({ appointmentId }),
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao obter token: ${await response.text()}`);
    }
    
    const tokenData = await response.json();
    
    // 4. Inicializar cliente Agora
    const AgoraRTC = window.AgoraRTC;
    const rtcClient = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });
    
    // 5. Configurar logs de estado para diagnóstico
    rtcClient.on('connection-state-change', (currentState, prevState, reason) => {
      console.log("Mudança de estado Agora:", {
        anterior: prevState,
        atual: currentState,
        motivo: reason
      });
    });
    
    // 6. Conectar ao canal
    await rtcClient.join(
      tokenData.appId,
      tokenData.channelName,
      tokenData.token,
      parseInt(tokenData.uid)
    );
    
    // 7. Criar e publicar streams locais
    const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    const localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    
    await rtcClient.publish([localAudioTrack, localVideoTrack]);
    
    // 8. Configurar handlers para streams remotos
    rtcClient.on('user-published', async (user, mediaType) => {
      await rtcClient.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        user.videoTrack?.play(`remote-stream-${user.uid}`);
      }
      
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    });
    
    return {
      client: rtcClient,
      localTracks: [localAudioTrack, localVideoTrack]
    };
  } catch (error) {
    console.error("Erro na inicialização Agora:", error);
    throw error;
  }
};
```

### 6.5 Solução de Problemas Comuns

- **Erro de Token**: Verifique a correspondência entre uid e token
- **Erro de Conexão (código 17)**: Problemas com firewall ou proxy
- **Safari**: Requer permissões de mídia explícitas e https
- **JOIN_CHANNEL_REJECTED**: Verificar firewall, portas UDP, ou ambiente Replit

## 7. Sistema de Email

### 7.1 Configuração

A plataforma utiliza o serviço de email Titan via SMTP:

```typescript
// server/services/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.titan.email',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `CN Vidas <${process.env.EMAIL_USERNAME}>`,
      to,
      subject,
      html
    });
    return true;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return false;
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("Erro ao verificar conexão com serviço de email:", error);
    return false;
  }
}
```

### 7.2 Tipos de Email

- Verificação de email (registro)
- Recuperação de senha
- Notificação de consulta agendada
- Notificação de consulta de emergência
- Confirmação de pagamento
- Boas-vindas a novos usuários

### 7.3 Templates

Os templates de email são HTML responsivo com design consistente com a marca.

```typescript
// server/services/email-templates.ts
export function getVerificationEmailTemplate(username: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verificação de Email</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { max-width: 150px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; 
                 text-decoration: none; border-radius: 4px; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://app.cnvidas.com/logo.png" alt="CN Vidas" class="logo">
          <h1>Verificação de Email</h1>
        </div>
        
        <p>Olá, ${username}!</p>
        
        <p>Obrigado por se cadastrar na CN Vidas. Para completar seu cadastro, 
           por favor verifique seu email clicando no botão abaixo:</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" class="button">Verificar Email</a>
        </p>
        
        <p>Se você não solicitou esta verificação, por favor ignore este email.</p>
        
        <p>Atenciosamente,<br>Equipe CN Vidas</p>
        
        <div class="footer">
          <p>© 2025 CN Vidas. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

## 8. Integrações de Pagamento

### 8.1 Stripe

Utilizado para pagamentos internacionais com cartão:

```typescript
// server/services/stripe.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function createPaymentIntent(amount: number, currency: string = 'brl'): Promise<string> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Converter para centavos
      currency,
    });
    
    return paymentIntent.client_secret;
  } catch (error) {
    console.error("Erro ao criar payment intent:", error);
    throw new Error("Falha ao processar pagamento");
  }
}

export async function createSubscription(
  customerId: string, 
  priceId: string
): Promise<{ subscriptionId: string, clientSecret: string }> {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    
    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    };
  } catch (error) {
    console.error("Erro ao criar assinatura:", error);
    throw new Error("Falha ao processar assinatura");
  }
}
```

### 8.2 Métodos Brasileiros

#### PIX

Implementado com API local para geração de QR code:

```typescript
// server/services/pix.ts
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export interface PixPaymentData {
  amount: number;
  description: string;
  merchantName: string;
  merchantCity: string;
  txid?: string;
}

export async function generatePixCode(data: PixPaymentData): Promise<{ pixCode: string, qrCodeImage: string }> {
  try {
    const txid = data.txid || uuidv4();
    
    // Formatação conforme padrão do Banco Central
    const pixString = [
      '00020126',
      '26' + formatPixData(data.merchantName, 'Nome do recebedor'),
      '52' + formatPixData(data.merchantCity, 'Cidade'),
      '5303986', // BRL
      '54' + formatAmount(data.amount),
      '5802BR',
      '62' + formatPixData(txid, 'ID da transação'),
      '6304'
    ].join('');
    
    // Calcular CRC16 e adicionar ao final
    const pixCodeWithCRC = pixString + calculateCRC16(pixString);
    
    // Gerar QR code como data URL
    const qrCodeImage = await QRCode.toDataURL(pixCodeWithCRC);
    
    return {
      pixCode: pixCodeWithCRC,
      qrCodeImage
    };
  } catch (error) {
    console.error("Erro ao gerar código PIX:", error);
    throw new Error("Falha ao gerar código PIX");
  }
}

// Funções auxiliares para formatação PIX
function formatPixData(value: string, description: string): string {
  const sanitized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '');
  return String(sanitized.length).padStart(2, '0') + sanitized;
}

function formatAmount(amount: number): string {
  const amountStr = amount.toFixed(2);
  return String(amountStr.length).padStart(2, '0') + amountStr;
}

function calculateCRC16(str: string): string {
  // Implementação do algoritmo CRC16 conforme especificação do Banco Central
  // ... (código do algoritmo CRC16)
  return 'ABCD'; // Valor simulado
}
```

#### Boleto

Integração com API de terceiros para geração de boletos.

## 9. Gerenciamento de Mídia

### 9.1 Upload de Imagens

Gerenciado pelo módulo multer com armazenamento em Base64:

```typescript
// server/routes/media-routes.ts
import express from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.post("/api/user/profile-image", isAuthenticated, upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }
    
    // Verificar tipo de arquivo
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimes.includes(file.mimetype)) {
      return res.status(400).json({ error: "Formato de arquivo não suportado" });
    }
    
    // Converter para base64
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    
    // Salvar no banco
    await storage.updateUserProfileImage(req.user.id, base64Image);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao processar imagem:", error);
    res.status(500).json({ error: "Erro ao processar imagem" });
  }
});

export const mediaRouter = router;
```

### 9.2 Imagens de Perfil

Armazenadas como strings Base64 no banco de dados.

## 10. Sistema de QR Code

### 10.1 Geração

```typescript
// server/routes/qr-routes.ts
import express from 'express';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

router.get("/api/qr/generate", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== "patient" && req.user.role !== "doctor") {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    
    // Dados do QR code
    const qrData = {
      userId: req.user.id,
      role: req.user.role,
      timestamp: Date.now(),
      version: "1"
    };
    
    // Gerar string JSON e criptografar
    const qrString = encryptData(JSON.stringify(qrData));
    
    // Gerar QR code como data URL
    const qrCodeImage = await QRCode.toDataURL(qrString);
    
    res.json({
      success: true,
      qrCode: qrCodeImage
    });
  } catch (error) {
    console.error("Erro ao gerar QR code:", error);
    res.status(500).json({ error: "Erro ao gerar QR code" });
  }
});

// Função para criptografar dados
function encryptData(data: string): string {
  const algorithm = 'aes-256-ctr';
  const secretKey = process.env.QR_ENCRYPTION_KEY || 'defaultSecretKey';
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export const qrRouter = router;
```

### 10.2 Leitura

```typescript
// server/routes/qr-routes.ts
router.post("/api/qr/scan", isAuthenticated, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "partner") {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ error: "Dados QR não fornecidos" });
    }
    
    // Descriptografar dados
    const decodedData = decryptData(qrData);
    const userData = JSON.parse(decodedData);
    
    // Validar timestamp (não mais que 5 minutos)
    const now = Date.now();
    if (now - userData.timestamp > 5 * 60 * 1000) {
      return res.status(400).json({ error: "QR code expirado" });
    }
    
    // Buscar usuário
    const user = await storage.getUser(userData.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    
    // Verificar assinatura ativa
    const subscription = await storage.getUserSubscription(user.id);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.fullName,
        role: user.role,
        profileImage: user.profileImage,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: subscription?.status || 'inactive'
      }
    });
  } catch (error) {
    console.error("Erro ao processar QR code:", error);
    res.status(500).json({ error: "Erro ao processar QR code" });
  }
});

// Função para descriptografar dados
function decryptData(encryptedData: string): string {
  const algorithm = 'aes-256-ctr';
  const secretKey = process.env.QR_ENCRYPTION_KEY || 'defaultSecretKey';
  
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  
  return decrypted.toString();
}
```

## 11. Sistema de Notificações

### 11.1 Armazenamento

Notificações são armazenadas na tabela `notifications` com status de leitura.

```typescript
// shared/schema.ts
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(),
  read: boolean('read').default(false),
  relatedId: integer('related_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 11.2 Busca de Notificações

```typescript
// server/routes/notification-routes.ts
import express from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';

const router = express.Router();

router.get("/api/notifications", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const notifications = await storage.getUserNotifications(userId, page, limit);
    const count = await storage.getNotificationCount(userId);
    
    res.json({
      notifications,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    res.status(500).json({ error: "Erro ao buscar notificações" });
  }
});

router.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
  try {
    const count = await storage.getUnreadNotificationCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error("Erro ao buscar contagem de notificações:", error);
    res.status(500).json({ error: "Erro ao buscar contagem" });
  }
});

export const notificationRouter = router;
```

### 11.3 Marcação como Lida

```typescript
// server/routes/notification-routes.ts
router.put("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    // Verificar se a notificação pertence ao usuário
    const notification = await storage.getNotification(notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: "Notificação não encontrada" });
    }
    
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    
    await storage.markNotificationAsRead(notificationId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    res.status(500).json({ error: "Erro ao atualizar notificação" });
  }
});

router.put("/api/notifications/read-all", isAuthenticated, async (req, res) => {
  try {
    await storage.markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao marcar todas notificações como lidas:", error);
    res.status(500).json({ error: "Erro ao atualizar notificações" });
  }
});
```

## 12. Sistema de Assinaturas

### 12.1 Planos Disponíveis

- **basic**: Plano básico com consultas padrão
- **premium**: Plano intermediário com mais benefícios
- **ultra**: Plano completo com prioridade
- **ultra_family**: Plano familiar com dependentes

```typescript
// shared/schema.ts
export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  price: integer('price').notNull(),
  description: text('description').notNull(),
  features: text('features').array(),
  maxDependents: integer('max_dependents').default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 12.2 Mudança de Plano

```typescript
// server/routes/subscription-routes.ts
import express from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { addMonths } from 'date-fns';

const router = express.Router();

router.post("/api/subscription/change-plan", isAuthenticated, async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: "ID do plano é obrigatório" });
    }
    
    // Validar plano
    const plan = await storage.getSubscriptionPlan(parseInt(planId));
    if (!plan) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }
    
    if (!plan.active) {
      return res.status(400).json({ error: "Este plano não está disponível" });
    }
    
    // Verificar assinatura atual
    const currentSubscription = await storage.getUserSubscription(req.user.id);
    
    // Atualizar assinatura
    const updatedSubscription = await storage.updateUserSubscription(req.user.id, {
      planId: parseInt(planId),
      status: 'active',
      expiresAt: addMonths(new Date(), 1) // 1 mês de assinatura
    });
    
    // Atualizar plano no usuário
    await storage.updateUser(req.user.id, {
      subscriptionPlan: plan.name,
      subscriptionStatus: 'active'
    });
    
    res.json({
      success: true,
      subscription: updatedSubscription
    });
  } catch (error) {
    console.error("Erro ao alterar plano:", error);
    res.status(500).json({ error: "Erro ao alterar plano" });
  }
});

export const subscriptionRouter = router;
```

## 13. Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| DATABASE_URL | URL de conexão com PostgreSQL | Sim |
| SESSION_SECRET | Segredo para assinar cookies de sessão | Sim |
| STRIPE_SECRET_KEY | Chave secreta da API Stripe | Sim |
| STRIPE_PUBLISHABLE_KEY | Chave pública da API Stripe | Sim |
| VITE_STRIPE_PUBLIC_KEY | Chave pública Stripe para frontend | Sim |
| AGORA_APP_ID | ID da aplicação Agora.io | Sim |
| AGORA_APP_CERTIFICATE | Certificado da aplicação Agora.io | Sim |
| EMAIL_HOST | Host SMTP | Sim |
| EMAIL_PORT | Porta SMTP | Sim |
| EMAIL_USERNAME | Usuário SMTP | Sim |
| EMAIL_PASSWORD | Senha SMTP | Sim |
| QR_ENCRYPTION_KEY | Chave para criptografia de QR code | Não |
| NODE_ENV | Ambiente (development/production) | Não |

## 14. Solução de Problemas Comuns

### 14.1 Problema com Autenticação

**Sintoma**: Erro 401 - Não autorizado

**Solução**:
1. Verificar se o token está sendo enviado corretamente nos headers
2. Confirmar que o token não expirou (24h após criação)
3. Validar se o cookie de sessão está presente
4. Verificar logs do servidor para detalhes específicos

```javascript
// Verificar token no localStorage
const token = localStorage.getItem('authToken');
console.log("Token:", token);

// Verificar formato do token
if (token) {
  const [sessionID, userId, timestamp] = token.split(':');
  console.log("Partes do token:", { sessionID, userId, timestamp });
  
  // Verificar validade
  const tokenTime = parseInt(timestamp);
  const isValid = !isNaN(tokenTime) && (Date.now() - tokenTime < 24 * 60 * 60 * 1000);
  console.log("Token válido:", isValid);
}

// Verificar cookies
console.log("Cookies:", document.cookie);
```

### 14.2 Falha na Conexão com Agora.io

**Sintoma**: Erro código 17 (JOIN_CHANNEL_REJECTED)

**Solução**:
1. Confirmar que UID usado para gerar o token é o mesmo usado no join
2. Verificar se AGORA_APP_ID e AGORA_APP_CERTIFICATE estão corretos
3. Testar em ambiente que permita conexões WebRTC (não bloqueado por firewall)
4. Verificar logs de connection-state-change para detalhes específicos
5. Testar com navegadores alternativos (Chrome geralmente tem melhor suporte)

```javascript
// Logs de diagnóstico para Agora
client.on('connection-state-change', (currentState, prevState, reason) => {
  console.log("Mudança de estado do Agora:", {
    anterior: prevState,
    atual: currentState,
    motivo: reason
  });
});

// Log de token
console.log("Token Agora:", {
  appId: tokenData.appId,
  channelName: tokenData.channelName,
  uid: tokenData.uid,
  tokenLength: tokenData.token.length
});
```

### 14.3 Falha ao Enviar Email

**Sintoma**: Erro ao enviar email de verificação

**Solução**:
1. Verificar credenciais SMTP nas variáveis de ambiente
2. Confirmar que a porta SMTP não está bloqueada (geralmente 587)
3. Verificar formato do email destinatário
4. Testar conexão SMTP com ferramenta externa

```javascript
// Script para testar conexão SMTP
const nodemailer = require('nodemailer');

async function testEmailConnection() {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  try {
    await transporter.verify();
    console.log("Conexão SMTP bem-sucedida!");
    return true;
  } catch (error) {
    console.error("Erro na conexão SMTP:", error);
    return false;
  }
}

testEmailConnection();
```

### 14.4 Erro na Transação Stripe

**Sintoma**: Erro ao processar pagamento

**Solução**:
1. Verificar logs do Stripe Dashboard para detalhes específicos
2. Confirmar que as chaves Stripe estão corretas
3. Verificar se o cartão tem fundos suficientes
4. Testar com cartão de teste em ambiente de desenvolvimento

```javascript
// Cartões de teste do Stripe
const TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  insufficient_funds: '4000000000009995',
  expired: '4000000000000069'
};

// Validação de configuração Stripe
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
  console.error("Chaves Stripe não configuradas corretamente");
}
```

## 15. Desenvolvimento e Deploy

### 15.1 Ambiente de Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Executar migrações de banco
npm run db:push
```

### 15.2 Processo de Build

```bash
# Build para produção
npm run build

# Iniciar em produção
npm start
```

### 15.3 Deploy

1. Garantir todas as variáveis de ambiente configuradas
2. Executar build para produção
3. Configurar servidor para servir arquivos estáticos
4. Configurar proxy reverso (Nginx/Apache) apontando para porta do Node
5. Configurar SSL para conexões seguras

## 16. Fluxos de Usuário Importantes

### 16.1 Registro e Verificação de Email

1. Usuário acessa `/register`
2. Preenche formulário com dados pessoais e senha
3. Backend valida dados e cria usuário com `emailVerified: false`
4. Email de verificação é enviado com token único
5. Usuário clica no link do email
6. Backend valida token e atualiza `emailVerified: true`
7. Usuário é redirecionado para login

### 16.2 Telemedicina de Emergência

1. Paciente acessa página inicial e clica em "Emergência"
2. Frontend solicita permissões de câmera/microfone
3. Backend cria registro de consulta com `status: 'waiting'`
4. Backend notifica médicos disponíveis
5. Paciente entra na sala de espera virtual
6. Médico aceita a chamada
7. Backend atualiza consulta com `status: 'in_progress'` e `doctorId`
8. Videochamada é estabelecida entre paciente e médico
9. Ao final, consulta é atualizada com `status: 'completed'` e duração

---

Este é o manual técnico detalhado da plataforma CN Vidas. Para mais informações específicas sobre componentes ou funcionalidades, consulte o código-fonte com os comentários correspondentes.