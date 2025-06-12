const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do cliente
const clientPath = path.join(__dirname, 'client');
app.use(express.static(clientPath));

// Rotas de API
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  const { email, password } = req.body;
  
  if (email === 'dr@lucascanova.com' && password === 'qweasdzxc123') {
    res.json({
      id: 32,
      email: 'dr@lucascanova.com',
      username: 'CRMRS4642',
      fullName: 'Lucas Dickel Canova',
      role: 'doctor',
      subscriptionPlan: 'free',
      subscriptionStatus: 'active',
      token: 'test-token-' + Date.now(),
      message: 'Login realizado com sucesso'
    });
  } else {
    res.status(401).json({ error: 'Email ou senha incorretos' });
  }
});

app.get('/api/auth/test', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date() });
});

app.get('/api/auth/user', (req, res) => {
  // Simulação de usuário logado
  res.json({
    id: 32,
    email: 'dr@lucascanova.com',
    username: 'CRMRS4642',
    fullName: 'Lucas Dickel Canova',
    role: 'doctor',
    emailVerified: true,
    subscriptionPlan: 'free',
    subscriptionStatus: 'active'
  });
});

// Catch-all para o React Router
app.get('*', (req, res) => {
  const indexPath = path.join(clientPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>CNVidas</title>
        </head>
        <body>
          <h1>CNVidas API</h1>
          <p>Servidor rodando na porta ${PORT}</p>
          <p>Para fazer login, use:</p>
          <ul>
            <li>Email: dr@lucascanova.com</li>
            <li>Senha: qweasdzxc123</li>
          </ul>
          <p>API endpoints:</p>
          <ul>
            <li>POST /api/auth/login</li>
            <li>GET /api/auth/test</li>
            <li>GET /api/auth/user</li>
          </ul>
        </body>
        </html>
      `);
    }
  });
});

// IMPORTANTE: Usar listen simples sem especificar host
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║       SERVIDOR CNVIDAS FUNCIONANDO!       ║
╠═══════════════════════════════════════════╣
║  🌐 URL: http://localhost:${PORT}           ║
║  📧 Login: dr@lucascanova.com             ║
║  🔑 Senha: qweasdzxc123                   ║
╚═══════════════════════════════════════════╝
  `);
});

server.on('error', (err) => {
  console.error('ERRO AO INICIAR SERVIDOR:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`Porta ${PORT} já está em uso!`);
  }
});