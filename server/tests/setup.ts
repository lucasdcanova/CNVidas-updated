import { config } from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
config();

// Configurações globais para os testes
beforeAll(() => {
  // Configurações que devem ser executadas antes de todos os testes
});

afterAll(() => {
  // Limpeza após todos os testes
});

// Configurações para cada teste
beforeEach(() => {
  // Configurações que devem ser executadas antes de cada teste
});

afterEach(() => {
  // Limpeza após cada teste
}); 