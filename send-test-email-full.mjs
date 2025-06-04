import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Carregar variáveis de ambiente
dotenv.config();

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
    rejectUnauthorized: false // Aceita certificados auto-assinados
  }
};

// Verificar se todas as variáveis de ambiente necessárias estão definidas
console.log('Configurações de email:');
console.log('- EMAIL_HOST:', emailConfig.host);
console.log('- EMAIL_PORT:', emailConfig.port);
console.log('- EMAIL_USERNAME:', emailConfig.auth.user);
console.log('- EMAIL_PASSWORD está definida:', !!emailConfig.auth.pass);

async function sendTestEmail() {
  // Criar o transportador de email
  const transporter = nodemailer.createTransport(emailConfig);
  
  // Email de destino para o teste
  const to = 'lucas.canova@icloud.com';
  
  // Opções do email
  const mailOptions = {
    from: `"CN Vidas" <${emailConfig.auth.user}>`,
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
    console.log('Enviando email para:', to);
    
    // Enviar o email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email enviado com sucesso!');
    console.log('ID da mensagem:', info.messageId);
    console.log('Resposta do servidor:', info.response);
    
    return info;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
}

// Executar a função principal
sendTestEmail()
  .then(() => {
    console.log('Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Falha ao executar o script:', error);
    process.exit(1);
  });