import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

async function sendTestEmail() {
  // Configurações do email
  const emailConfig = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false // Aceita certificados auto-assinados (apenas para teste)
    }
  };

  // Verificar configurações
  console.log('Configurações de email:');
  console.log('- EMAIL_HOST:', emailConfig.host);
  console.log('- EMAIL_PORT:', emailConfig.port);
  console.log('- EMAIL_USERNAME:', emailConfig.auth.user);
  console.log('- EMAIL_PASSWORD está definida:', !!emailConfig.auth.pass);

  try {
    // Criar transportador
    const transporter = nodemailer.createTransport(emailConfig);

    // Verificar conexão
    const verification = await transporter.verify();
    console.log('Conexão com servidor de email verificada: ', verification);

    // Token simulado de verificação
    const token = 'test-verification-token-' + Date.now();
    const verificationLink = `https://homologacao.cnvidas.com.br/verificar-email?token=${token}`;

    // Conteúdo do email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificação de Email de Teste - CN Vidas</title>
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
              <h1 style="color: #0d47a1; font-size: 24px; margin: 10px 0 20px;">Teste de Verificação de Email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 20px 30px; color: #555555; line-height: 1.6;">
              <p>Olá Lucas,</p>
              <p>Este é um <strong>email de teste</strong> para verificar o funcionamento do sistema de verificação de email da CN Vidas.</p>
              <p>A configuração de email foi atualizada e agora estamos testando se os emails são enviados corretamente.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 30px 30px 30px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" bgcolor="#1e88e5" style="border-radius: 50px;">
                    <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 15px 35px; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: bold;">
                      ✓ Verificar Email (Teste)
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
              <p><strong>Observação:</strong> Este é apenas um teste e o link não realizará nenhuma ação no sistema.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; color: #777777; font-size: 13px; background-color: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; text-align: center;">
              <p>Atenciosamente,<br>Equipe CN Vidas</p>
              <p>Este é um email de teste enviado em: ${new Date().toLocaleString('pt-BR')}</p>
              <div style="margin-top: 20px; color: #999999; font-size: 12px;">
                <p>© 2025 CN Vidas. Todos os direitos reservados.</p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Enviar email
    const info = await transporter.sendMail({
      from: `"CN Vidas" <${emailConfig.auth.user}>`,
      to: 'lucas.canova@icloud.com',
      subject: 'Teste de Verificação de Email - CN Vidas',
      html: html,
      text: 'Este é um email de teste do sistema de verificação de email da CN Vidas.'
    });

    console.log('Email enviado com sucesso!');
    console.log('ID da mensagem:', info.messageId);
    console.log('Resposta do servidor:', info.response);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return false;
  }
}

// Executar a função
sendTestEmail()
  .then(success => {
    console.log('Teste concluído. Resultado:', success ? 'SUCESSO' : 'FALHA');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Erro inesperado:', err);
    process.exit(1);
  });