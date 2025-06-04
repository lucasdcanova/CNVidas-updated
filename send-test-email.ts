// Script para enviar um email de teste usando TypeScript e ES modules
import 'dotenv/config';
import nodemailer from 'nodemailer';

// Verificar se todas as variáveis de ambiente necessárias estão definidas
if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
  console.error('Erro: Variáveis de ambiente de email não estão configuradas corretamente.');
  console.error('Por favor, defina EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME e EMAIL_PASSWORD');
  process.exit(1);
}

// Configurar o transporte de email com o Titan Email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // Aceita certificados auto-assinados (apenas para desenvolvimento)
  }
});

async function sendTestEmail() {
  const to = 'lucas.canova@icloud.com';
  
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    subject: 'Teste de Email - CN Vidas',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8e8e8; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e88e5;">CN Vidas</h1>
        </div>
        <div style="margin-bottom: 30px;">
          <p>Olá Lucas,</p>
          <p>Este é um email de teste para verificar se o serviço de email da CN Vidas está funcionando corretamente.</p>
          <p>Se você recebeu este email, significa que a configuração de email está funcionando!</p>
          <p>Data e hora do teste: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; font-size: 12px; color: #757575;">
          <p>Atenciosamente,<br>Equipe CN Vidas</p>
        </div>
      </div>
    `
  };

  try {
    console.log('Tentando enviar email para:', to);
    console.log('Usando configurações:');
    console.log('- HOST:', process.env.EMAIL_HOST);
    console.log('- PORT:', process.env.EMAIL_PORT);
    console.log('- USERNAME:', process.env.EMAIL_USERNAME);
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso!');
    console.log('ID da mensagem:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
}

// Executa a função principal
sendTestEmail()
  .then(() => {
    console.log('Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Falha ao executar o script:', error);
    process.exit(1);
  });