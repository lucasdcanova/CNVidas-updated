// Script para enviar um email de teste
import 'dotenv/config';
import { sendEmail } from './server/services/email';

async function main() {
  try {
    await sendEmail(
      'lucas.canova@icloud.com',
      'Teste de Email - CN Vidas',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e8e8e8; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e88e5;">CN Vidas</h1>
        </div>
        <div style="margin-bottom: 30px;">
          <p>Olá Lucas,</p>
          <p>Este é um email de teste para verificar se o serviço de email da CN Vidas está funcionando corretamente.</p>
          <p>Se você recebeu este email, significa que a configuração de email está funcionando!</p>
        </div>
        <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; font-size: 12px; color: #757575;">
          <p>Atenciosamente,<br>Equipe CN Vidas</p>
        </div>
      </div>
      `
    );
    console.log('Email de teste enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
  }
}

main();