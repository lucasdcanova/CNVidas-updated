import { Request } from 'express';

export function getCookieOptions(req: Request) {
  const isLocalhost = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1');
  const isProduction = process.env.NODE_ENV === 'production';
  
  const options: any = {
    httpOnly: true,
    secure: isProduction && !isLocalhost, // Apenas usar secure em produção não-localhost
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  };
  
  // Adicionar domínio apenas se configurado e não for localhost
  if (process.env.COOKIE_DOMAIN && !isLocalhost) {
    options.domain = process.env.COOKIE_DOMAIN;
  }
  
  console.log('Cookie options:', {
    host: req.headers.host,
    isLocalhost,
    isProduction,
    secure: options.secure,
    domain: options.domain
  });
  
  return options;
}