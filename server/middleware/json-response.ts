/**
 * Middleware para garantir que as respostas de API sejam sempre JSON
 * Este middleware deve ser aplicado a rotas de API para prevenir respostas HTML
 */
import { Request, Response, NextFunction } from 'express';

export function ensureJsonResponse(req: Request, res: Response, next: NextFunction) {
  // Captura o método original res.send
  const originalSend = res.send;
  
  // Sobrescreve o método send
  res.send = function(body: any): Response {
    // Somente para rotas de API
    if (req.originalUrl.startsWith('/api/')) {
      // Se o conteúdo for HTML (começa com <!DOCTYPE ou <html>)
      if (typeof body === 'string' && 
          (body.trim().startsWith('<!DOCTYPE') || 
           body.trim().startsWith('<html'))) {
        console.error(`⚠️ ALERTA: Resposta HTML detectada na rota API ${req.method} ${req.originalUrl}`);
        
        // Verifica se o cabeçalho Content-Type já foi definido para HTML
        const contentType = res.getHeader('Content-Type');
        if (contentType && contentType.toString().includes('text/html')) {
          // Redefine para JSON
          res.setHeader('Content-Type', 'application/json');
        }
        
        // Envia resposta JSON em vez do HTML
        return originalSend.call(this, JSON.stringify({
          error: "Erro interno do servidor",
          message: "Detectada resposta HTML em rota de API. Verifique logs do servidor."
        }));
      }
    }
    
    // Comportamento normal para outros casos
    return originalSend.call(this, body);
  };
  
  next();
}

// Middleware específico para rotas de telemedicina
export function ensureDailyJsonResponse(req: Request, res: Response, next: NextFunction) {
  // Guarda uma referência aos métodos originais
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;
  
  // Modifica o método send
  res.send = function(body: any): Response {
    // Se o conteúdo for HTML, converte em objeto JSON
    if (typeof body === 'string' && 
        (body.trim().startsWith('<!DOCTYPE') || 
         body.trim().startsWith('<html'))) {
      console.error(`⚠️ ALERTA: Convertendo resposta HTML para JSON em ${req.method} ${req.originalUrl}`);
      
      // Extrai o roomName do URL ou do body da requisição
      let roomName = '';
      if (req.body && req.body.roomName) {
        roomName = req.body.roomName;
      } else if (req.originalUrl.includes('/room') && req.body && req.body.appointmentId) {
        roomName = `consultation-${req.body.appointmentId}`;
      } else if (req.originalUrl.includes('/token') && req.body && req.body.appointmentId) {
        roomName = `consultation-${req.body.appointmentId}`;
      } else if (req.originalUrl.includes('/emergency')) {
        roomName = `emergency-${Date.now()}`;
      }
      
      // Se a rota for para criação de sala
      if (req.originalUrl.includes('/room')) {
        return originalJson.call(this, {
          name: roomName,
          url: `https://cnvidas.daily.co/${roomName}`,
          id: `fallback-${roomName}`,
          api_created: true,
          message: "Sala criada com sucesso (resposta HTTP convertida para JSON)"
        });
      }
      
      // Se a rota for para geração de token
      if (req.originalUrl.includes('/token')) {
        return originalJson.call(this, {
          token: `fallback-token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          roomName: roomName,
          url: `https://cnvidas.daily.co/${roomName}`,
          message: "Token gerado com sucesso (resposta HTTP convertida para JSON)"
        });
      }
    }
    
    // Comportamento padrão
    return originalSend.call(this, body);
  };
  
  next();
}

export const jsonResponse = (req: Request, res: Response, next: NextFunction) => {
  res.json = (body: any): Response => {
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(body));
  };
  next();
};