import 'dotenv/config'; // Garantir que as variáveis de ambiente sejam carregadas primeiro
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from 'http';
import setupRoutes from './routes';
import { setupVite, serveStatic, log } from "./vite";
import { setupSubscriptionPlans } from "./migrations/plans-setup";
import { ensureJsonResponse } from "./middleware/json-response";
import { errorHandler } from "./middleware/error-handler";
import { verifyEmailConnection } from "./services/email";
import path from "path";
import { storage } from "./storage";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { setupAuth } from "./auth";
import { pool } from "./db";
import connectPg from "connect-pg-simple";

(async () => {
  const app = express();
  const server = createServer(app);

  // Configurações básicas
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }));

  // Configuração de sessão
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({
    pool,
    createTableIfMissing: true
  });

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'cn-vidas-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
  }));

  // Configuração do Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configurar autenticação
  setupAuth(app);

  // Middleware para garantir respostas JSON
  app.use(ensureJsonResponse);

  // Configurar todas as rotas
  await setupRoutes(app);

  // Middleware de tratamento de erros (deve ser o último)
  app.use(errorHandler);

  // Configuração do Vite em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    await setupVite(app);
  } else {
    app.use(serveStatic);
  }

  // Verificar conexão com email
  verifyEmailConnection().catch(console.error);

  // Configurar planos de assinatura
  setupSubscriptionPlans().catch(console.error);

  // Iniciar servidor
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    log(`Servidor rodando na porta ${PORT}`, 'server');
  });
})();