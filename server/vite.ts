import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";
const __dirname = __dirname || process.cwd();

// Simple config for production - will be replaced by static serving
const viteConfig = {};

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: ['localhost', '127.0.0.1'],
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Só interceptar rotas que NÃO são da API
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    
    // Se for uma rota da API, não interceptar
    if (url.startsWith('/api/')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Em produção no Render, servir arquivos estáticos do cliente
  const clientPath = path.resolve(__dirname, "..", "client");
  const publicPath = path.resolve(__dirname, "public");
  
  console.log('🔍 Tentando servir arquivos estáticos de:', clientPath);
  console.log('🔍 Ou de:', publicPath);
  
  // Tentar servir do diretório public primeiro (build compilado)
  if (fs.existsSync(publicPath)) {
    console.log('✅ Usando diretório public compilado');
    app.use(express.static(publicPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(publicPath, "index.html"));
    });
  } 
  // Fallback para servir diretamente do cliente (desenvolvimento/produção sem build)
  else if (fs.existsSync(clientPath)) {
    console.log('✅ Usando diretório client diretamente');
    app.use(express.static(clientPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(clientPath, "index.html"));
    });
  }
  // Fallback final - retornar JSON indicando que é uma API
  else {
    console.log('⚠️ Nenhum diretório de arquivos estáticos encontrado, servindo apenas API');
    app.use("*", (req, res) => {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.status(200).json({ 
        message: 'CNVidas API está funcionando', 
        timestamp: new Date().toISOString(),
        availablePaths: ['/api/health', '/api/auth', '/api/users', '/api/subscription']
      });
    });
  }
}
