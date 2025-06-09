import { sendEmail, sendVerificationEmail as sendVerificationEmailService } from '../services/email';

export { sendEmail };

export const sendVerificationEmail = async (email: string, token: string) => {
  return sendVerificationEmailService(email, token);
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.CLIENT_URL}/redefinir-senha?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Redefinir senha - CN Vidas',
    text: `Para redefinir sua senha, clique no link: ${resetUrl}`,
    html: `<p>Você solicitou a redefinição de senha. Clique no link abaixo:</p>
     <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
     <p>Se você não solicitou esta mudança, ignore este email.</p>`
  });
};