const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// API routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Validação simples para teste
  if (email === 'dr@lucascanova.com' && password === 'qweasdzxc123') {
    res.json({
      id: 32,
      email: 'dr@lucascanova.com',
      fullName: 'Lucas Dickel Canova',
      role: 'doctor',
      token: 'test-token-123',
      message: 'Login realizado com sucesso'
    });
  } else {
    res.status(401).json({ error: 'Email ou senha incorretos' });
  }
});

app.get('/api/auth/test', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date() });
});

// Servir o cliente React para todas as outras rotas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`
============================================
✅ Servidor de emergência CNVidas rodando!
============================================
🌐 URL: http://localhost:${PORT}
📧 Login: dr@lucascanova.com
🔑 Senha: qweasdzxc123
============================================
  `);
});

server.on('error', (err) => {
  console.error('Erro ao iniciar servidor:', err);
});