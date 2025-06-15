// Email Templates com design moderno e profissional

const logoUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/assets/cnvidas-logo.png`;

// Template base para todos os emails
export function baseEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>CN Vidas</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
      <style type="text/css">
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; }
        
        /* Remove default styling */
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
        
        /* Mobile styles */
        @media screen and (max-width: 600px) {
          .mobile-hide { display: none !important; }
          .mobile-center { text-align: center !important; }
          .container { padding: 0 !important; width: 100% !important; }
          .content { padding: 20px !important; }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .dark-mode-bg { background-color: #1a1a1a !important; }
          .dark-mode-text { color: #ffffff !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; line-height: 1.6;">
      <!-- Preview Text -->
      <div style="display: none; font-size: 1px; color: #f4f7fa; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        CN Vidas - Sua saúde em primeiro lugar
      </div>
      
      <!-- Email Container -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden;">
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 40px 20px;">
                  <img src="${logoUrl}" alt="CN Vidas" width="200" height="auto" style="display: block; margin: 0 auto; max-width: 200px; height: auto;">
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td class="content" style="padding: 40px;">
                  ${content}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                    Atenciosamente,<br>
                    <strong style="color: #1e3a8a;">Equipe CN Vidas</strong>
                  </p>
                  
                  <div style="margin: 20px 0; padding: 20px 0; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 12px;">
                      Este email foi enviado por CN Vidas
                    </p>
                    <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 12px;">
                      © 2025 CN Vidas. Todos os direitos reservados.
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/termos" style="color: #2563eb; text-decoration: none;">Termos de Uso</a> 
                      <span style="color: #d1d5db;">|</span> 
                      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/privacidade" style="color: #2563eb; text-decoration: none;">Política de Privacidade</a>
                    </p>
                  </div>
                  
                  <!-- Social Media Links -->
                  <div style="margin-top: 20px;">
                    <a href="#" style="display: inline-block; margin: 0 5px;">
                      <img src="https://img.icons8.com/color/48/000000/facebook-new.png" alt="Facebook" width="32" height="32">
                    </a>
                    <a href="#" style="display: inline-block; margin: 0 5px;">
                      <img src="https://img.icons8.com/color/48/000000/instagram-new.png" alt="Instagram" width="32" height="32">
                    </a>
                    <a href="#" style="display: inline-block; margin: 0 5px;">
                      <img src="https://img.icons8.com/color/48/000000/linkedin.png" alt="LinkedIn" width="32" height="32">
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Template para email de verificação
export function verificationEmailTemplate(verificationLink: string): string {
  const content = `
    <h1 style="color: #1e3a8a; font-size: 28px; font-weight: 600; margin: 0 0 10px 0; text-align: center;">
      Bem-vindo à CN Vidas! 🎉
    </h1>
    
    <p style="color: #6b7280; font-size: 16px; text-align: center; margin: 0 0 30px 0;">
      Estamos felizes em tê-lo(a) conosco
    </p>
    
    <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 0 0 30px 0;">
      <p style="color: #374151; font-size: 16px; margin: 0;">
        Para garantir a segurança da sua conta e ter acesso completo a todos os nossos serviços, 
        precisamos verificar seu endereço de email.
      </p>
    </div>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%); border-radius: 8px;">
                <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                  Verificar Email Agora
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0;">
      Ou copie e cole este link no seu navegador:
    </p>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin: 0 0 30px 0; word-break: break-all;">
      <code style="color: #2563eb; font-size: 13px;">${verificationLink}</code>
    </div>
    
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin: 0 0 20px 0;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        <strong>⏰ Importante:</strong> Este link expira em 24 horas. Após esse período, você precisará solicitar um novo email de verificação.
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <h2 style="color: #1e3a8a; font-size: 20px; font-weight: 600; margin: 0 0 15px 0;">
      O que você pode fazer na CN Vidas?
    </h2>
    
    <div style="display: table; width: 100%; margin: 0 0 20px 0;">
      <div style="display: table-row;">
        <div style="display: table-cell; padding: 10px; vertical-align: top;">
          <div style="background-color: #dbeafe; border-radius: 8px; padding: 15px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 5px;">🏥</div>
            <strong style="color: #1e3a8a;">Consultas Online</strong>
            <p style="color: #374151; font-size: 13px; margin: 5px 0 0 0;">
              Agende consultas com médicos qualificados
            </p>
          </div>
        </div>
        <div style="display: table-cell; padding: 10px; vertical-align: top;">
          <div style="background-color: #dbeafe; border-radius: 8px; padding: 15px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 5px;">💊</div>
            <strong style="color: #1e3a8a;">Descontos em Farmácias</strong>
            <p style="color: #374151; font-size: 13px; margin: 5px 0 0 0;">
              Economize em medicamentos
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        Se você não criou uma conta na CN Vidas, por favor ignore este email.
      </p>
    </div>
  `;
  
  return baseEmailTemplate(content);
}

// Template para redefinição de senha
export function passwordResetEmailTemplate(resetLink: string): string {
  const content = `
    <h1 style="color: #1e3a8a; font-size: 28px; font-weight: 600; margin: 0 0 10px 0; text-align: center;">
      Redefinição de Senha 🔐
    </h1>
    
    <p style="color: #6b7280; font-size: 16px; text-align: center; margin: 0 0 30px 0;">
      Recebemos sua solicitação para redefinir a senha
    </p>
    
    <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 0 0 30px 0;">
      <p style="color: #374151; font-size: 16px; margin: 0;">
        Clique no botão abaixo para criar uma nova senha segura para sua conta CN Vidas.
      </p>
    </div>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%); border-radius: 8px;">
                <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                  Redefinir Minha Senha
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0;">
      Ou copie e cole este link no seu navegador:
    </p>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin: 0 0 30px 0; word-break: break-all;">
      <code style="color: #2563eb; font-size: 13px;">${resetLink}</code>
    </div>
    
    <div style="background-color: #fee2e2; border-radius: 8px; padding: 15px; margin: 0 0 20px 0;">
      <p style="color: #991b1b; font-size: 14px; margin: 0;">
        <strong>⚠️ Atenção:</strong> Este link expira em 1 hora por questões de segurança.
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <h2 style="color: #1e3a8a; font-size: 20px; font-weight: 600; margin: 0 0 15px 0;">
      Dicas para uma senha segura:
    </h2>
    
    <ul style="color: #374151; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>Use no mínimo 8 caracteres</li>
      <li>Combine letras maiúsculas e minúsculas</li>
      <li>Inclua números e símbolos especiais</li>
      <li>Evite informações pessoais óbvias</li>
      <li>Não reutilize senhas de outros sites</li>
    </ul>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0 0 0; text-align: center;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        <strong>Não solicitou esta alteração?</strong><br>
        Se você não solicitou a redefinição de senha, ignore este email.<br>
        Sua senha atual permanecerá inalterada.
      </p>
    </div>
  `;
  
  return baseEmailTemplate(content);
}

// Template para email de boas-vindas após verificação
export function welcomeEmailTemplate(userName: string): string {
  const content = `
    <h1 style="color: #1e3a8a; font-size: 28px; font-weight: 600; margin: 0 0 10px 0; text-align: center;">
      Parabéns, ${userName}! 🎊
    </h1>
    
    <p style="color: #6b7280; font-size: 16px; text-align: center; margin: 0 0 30px 0;">
      Sua conta foi verificada com sucesso
    </p>
    
    <div style="background-color: #dcfce7; border-radius: 12px; padding: 20px; margin: 0 0 30px 0; text-align: center;">
      <p style="color: #166534; font-size: 16px; margin: 0;">
        ✅ Email verificado com sucesso!<br>
        Agora você tem acesso completo à plataforma CN Vidas.
      </p>
    </div>
    
    <h2 style="color: #1e3a8a; font-size: 20px; font-weight: 600; margin: 30px 0 15px 0;">
      Próximos passos:
    </h2>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 15px 0;">
      <h3 style="color: #1e3a8a; font-size: 16px; margin: 0 0 10px 0;">
        1. Complete seu perfil
      </h3>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Adicione suas informações pessoais e foto de perfil para uma experiência personalizada.
      </p>
    </div>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 15px 0;">
      <h3 style="color: #1e3a8a; font-size: 16px; margin: 0 0 10px 0;">
        2. Escolha seu plano
      </h3>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Explore nossos planos e escolha o que melhor atende suas necessidades de saúde.
      </p>
    </div>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
      <h3 style="color: #1e3a8a; font-size: 16px; margin: 0 0 10px 0;">
        3. Agende sua primeira consulta
      </h3>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Conheça nossos profissionais e agende uma consulta quando precisar.
      </p>
    </div>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%); border-radius: 8px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                  Acessar Minha Conta
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <div style="text-align: center; margin-top: 30px;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Precisa de ajuda? Entre em contato conosco:<br>
        <a href="mailto:suporte@cnvidas.com.br" style="color: #2563eb; text-decoration: none;">suporte@cnvidas.com.br</a>
      </p>
    </div>
  `;
  
  return baseEmailTemplate(content);
}