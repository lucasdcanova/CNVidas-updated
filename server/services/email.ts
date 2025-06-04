import nodemailer from 'nodemailer';

// Verificar se todas as variáveis de ambiente necessárias estão definidas
if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
  console.error('Erro: Variáveis de ambiente de email não estão configuradas corretamente.');
  console.error('Por favor, defina EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME e EMAIL_PASSWORD');
}

// Configurações de email
const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Aceita certificados auto-assinados (apenas para desenvolvimento)
  }
};

// Criar o transportador de email
const transporter = nodemailer.createTransport(emailConfig);

// Verificar a conexão com o servidor de email
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      console.error('Não foi possível verificar a conexão com o servidor de email: variáveis de ambiente incompletas');
      return false;
    }
    
    const verification = await transporter.verify();
    console.log('Configuração de email carregada. Serviço de email disponível.');
    return true;
  } catch (error) {
    console.error('Erro ao verificar conexão com servidor de email:', error);
    return false;
  }
}

// Interface para options do email
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Função para enviar email
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: `"CN Vidas" <${process.env.EMAIL_USERNAME}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso:', info.messageId);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return false;
  }
}

// Função para enviar email de verificação
export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verificar-email?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifique seu email - CN Vidas</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <tr>
          <td style="padding: 30px 30px 20px 30px; text-align: center; background-color: #0d47a1; border-top-left-radius: 8px; border-top-right-radius: 8px;">
            <div style="font-size: 28px; font-weight: bold; color: white; margin: 0 auto;">CN Vidas</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px 30px; text-align: center;">
            <h1 style="color: #0d47a1; font-size: 24px; margin: 10px 0 20px;">Verifique seu Email</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px 30px; color: #555555; line-height: 1.6;">
            <p>Olá,</p>
            <p>Obrigado por se cadastrar na <strong>CN Vidas</strong>. Estamos muito entusiasmados em tê-lo(a) como parte da nossa comunidade de saúde.</p>
            <p>Para garantir a segurança da sua conta e completar seu cadastro, por favor verifique seu email clicando no botão abaixo:</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 30px 30px 30px; text-align: center;">
            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" bgcolor="#1e88e5" style="border-radius: 50px;">
                  <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 15px 35px; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: bold;">
                    ✓ Verificar Email
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px 30px; color: #555555; line-height: 1.6;">
            <p>Se o botão acima não funcionar, você pode copiar e colar o link abaixo no seu navegador:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #4a6ee0;">${verificationLink}</p>
            <p><strong>Observação:</strong> Este link expirará em 24 horas por motivos de segurança.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 30px; color: #555555; line-height: 1.6; border-top: 1px solid #eeeeee;">
            <p><strong>Sobre a CN Vidas:</strong></p>
            <p>A CN Vidas é uma plataforma de saúde digital que conecta pacientes a profissionais de saúde de alta qualidade, oferecendo atendimento médico personalizado e acessível para todos.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px; color: #777777; font-size: 13px; background-color: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; text-align: center;">
            <p>Atenciosamente,<br>Equipe CN Vidas</p>
            <p>Se você não solicitou este email, por favor ignore-o.</p>
            <div style="margin-top: 20px; color: #999999; font-size: 12px;">
              <p>© 2025 CN Vidas. Todos os direitos reservados.</p>
              <p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/termos" style="color: #1e88e5; text-decoration: none;">Termos de Uso</a> | 
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/privacidade" style="color: #1e88e5; text-decoration: none;">Política de Privacidade</a>
              </p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Verifique seu email - CN Vidas',
    html
  });
}

// Função para enviar email de redefinição de senha
export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/redefinir-senha?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinição de Senha - CN Vidas</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <tr>
          <td style="padding: 30px 30px 20px 30px; text-align: center; background-color: #0d47a1; border-top-left-radius: 8px; border-top-right-radius: 8px;">
            <div style="font-size: 28px; font-weight: bold; color: white; margin: 0 auto;">CN Vidas</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px 30px; text-align: center;">
            <h1 style="color: #0d47a1; font-size: 24px; margin: 10px 0 20px;">Redefinição de Senha</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px 30px; color: #555555; line-height: 1.6;">
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta <strong>CN Vidas</strong>. Para criar uma nova senha segura, clique no botão abaixo:</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 30px 30px 30px; text-align: center;">
            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" bgcolor="#1e88e5" style="border-radius: 50px;">
                  <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 15px 35px; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: bold;">
                    🔒 Redefinir Minha Senha
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 20px 30px; color: #555555; line-height: 1.6;">
            <p>Se o botão acima não funcionar, você pode copiar e colar o link abaixo no seu navegador:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #4a6ee0;">${resetLink}</p>
            <p><strong>Importante:</strong> Este link expirará em 1 hora por motivos de segurança.</p>
            <p>Se você não solicitou esta redefinição de senha, ignore este email e sua senha permanecerá a mesma. É possível que outra pessoa tenha digitado seu endereço de email por engano.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 30px; color: #555555; line-height: 1.6; border-top: 1px solid #eeeeee;">
            <p><strong>Dicas de segurança:</strong></p>
            <ul style="padding-left: 20px; margin-top: 5px;">
              <li>Crie uma senha forte com pelo menos 8 caracteres</li>
              <li>Use uma combinação de letras, números e símbolos</li>
              <li>Não compartilhe sua senha com outras pessoas</li>
              <li>Não use a mesma senha em vários sites</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px; color: #777777; font-size: 13px; background-color: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; text-align: center;">
            <p>Atenciosamente,<br>Equipe CN Vidas</p>
            <div style="margin-top: 20px; color: #999999; font-size: 12px;">
              <p>© 2025 CN Vidas. Todos os direitos reservados.</p>
              <p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/termos" style="color: #1e88e5; text-decoration: none;">Termos de Uso</a> | 
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/privacidade" style="color: #1e88e5; text-decoration: none;">Política de Privacidade</a>
              </p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Redefinição de Senha - CN Vidas',
    html
  });
}