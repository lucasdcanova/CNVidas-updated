const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor funcionando!\n');
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Servidor HTTP básico rodando em http://127.0.0.1:3000');
});

// Manter processo vivo
process.stdin.resume();