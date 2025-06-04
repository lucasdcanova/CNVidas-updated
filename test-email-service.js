require('dotenv').config();
const nodemailer = require('nodemailer');

// Exibir as variáveis de ambiente para diagnóstico (sem exibir a senha)
console.log('Configurações de email:');
console.log('- EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('- EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('- EMAIL_USERNAME:', process.env.EMAIL_USERNAME);
console.log('- EMAIL_PASSWORD está definida:', !!process.env.EMAIL_PASSWORD);

// Criar um transporte de teste para verificar as credenciais
async function testEmailConfig() {
  // Criar transporte com log detalhado
  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    },
    debug: true, // Ativar logs detalhados
    logger: true, // Exibir logs de conexão
    tls: {
      rejectUnauthorized: false // Aceita certificados auto-assinados
    }
  });

  try {
    // Verificar conexão
    console.log('Verificando conexão com servidor de email...');
    const verification = await transporter.verify();
    console.log('Conexão verificada com sucesso:', verification);
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return false;
  }
}

// Executar teste
testEmailConfig()
  .then(success => {
    console.log('Teste concluído. Resultado:', success ? 'SUCESSO' : 'FALHA');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Erro inesperado:', err);
    process.exit(1);
  });