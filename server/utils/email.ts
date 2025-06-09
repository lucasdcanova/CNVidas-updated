import { sendEmail } from '../services/email';

export { sendEmail };

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verificar-email?token=${token}`;
  
  await sendEmail(
    email,
    'Verifique seu email - CN Vidas',
    `Por favor, clique no link para verificar seu email: ${verificationUrl}`,
    `<p>Por favor, clique no link abaixo para verificar seu email:</p>
     <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verificar Email</a>`
  );
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.CLIENT_URL}/redefinir-senha?token=${token}`;
  
  await sendEmail(
    email,
    'Redefinir senha - CN Vidas',
    `Para redefinir sua senha, clique no link: ${resetUrl}`,
    `<p>Você solicitou a redefinição de senha. Clique no link abaixo:</p>
     <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
     <p>Se você não solicitou esta mudança, ignore este email.</p>`
  );
};