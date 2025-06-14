import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Diretório onde estão os documentos legais
const LEGAL_DOCS_DIR = path.join(process.cwd(), 'legal-docs');

// Lista de documentos disponíveis
const AVAILABLE_DOCUMENTS = {
  'terms-of-use.md': 'Termos de Uso',
  'privacy-policy.md': 'Política de Privacidade',
  'adhesion-contract.md': 'Contrato de Adesão',
  'cancellation-policy.md': 'Política de Cancelamento',
  'partner-contract.md': 'Contrato de Parceria',
  'user-manual.md': 'Manual do Usuário'
};

// Rota para listar documentos disponíveis
router.get('/', (req: Request, res: Response) => {
  const documents = Object.entries(AVAILABLE_DOCUMENTS).map(([filename, title]) => ({
    filename,
    title,
    url: `/api/legal-documents/${filename}`
  }));
  
  res.json({ documents });
});

// Rota para servir um documento específico
router.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  
  // Verificar se o documento está na lista de documentos permitidos
  if (!AVAILABLE_DOCUMENTS.hasOwnProperty(filename)) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }
  
  const filePath = path.join(LEGAL_DOCS_DIR, filename);
  
  // Verificar se o arquivo existe
  if (!fs.existsSync(filePath)) {
    console.error(`Documento legal não encontrado: ${filePath}`);
    return res.status(404).json({ error: 'Documento não encontrado no servidor' });
  }
  
  try {
    // Ler o conteúdo do arquivo
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Definir o tipo de conteúdo apropriado
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 dia
    
    // Enviar o conteúdo
    res.send(content);
  } catch (error) {
    console.error(`Erro ao ler documento legal: ${filename}`, error);
    res.status(500).json({ error: 'Erro ao carregar documento' });
  }
});

// Rota para obter um documento específico em formato JSON
router.get('/:filename/json', (req: Request, res: Response) => {
  const { filename } = req.params;
  
  // Verificar se o documento está na lista de documentos permitidos
  if (!AVAILABLE_DOCUMENTS.hasOwnProperty(filename)) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }
  
  const filePath = path.join(LEGAL_DOCS_DIR, filename);
  
  // Verificar se o arquivo existe
  if (!fs.existsSync(filePath)) {
    console.error(`Documento legal não encontrado: ${filePath}`);
    return res.status(404).json({ error: 'Documento não encontrado no servidor' });
  }
  
  try {
    // Ler o conteúdo do arquivo
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Retornar em formato JSON
    res.json({
      filename,
      title: AVAILABLE_DOCUMENTS[filename as keyof typeof AVAILABLE_DOCUMENTS],
      content,
      lastModified: fs.statSync(filePath).mtime
    });
  } catch (error) {
    console.error(`Erro ao ler documento legal: ${filename}`, error);
    res.status(500).json({ error: 'Erro ao carregar documento' });
  }
});

export default router;