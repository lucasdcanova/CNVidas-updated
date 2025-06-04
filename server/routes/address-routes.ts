import express from 'express';
import axios from 'axios';

const router = express.Router();

// API para consulta de endereço por CEP
router.get("/cep", async (req, res) => {
  try {
    const cep = req.query.cep as string;
    if (!cep) {
      return res.status(400).json({ message: "O parâmetro 'cep' é obrigatório" });
    }
    
    // Remove caracteres não numéricos do CEP
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return res.status(400).json({ message: "CEP inválido. Deve conter 8 dígitos." });
    }
    
    try {
      console.log(`Consultando CEP: ${cleanCep}`);
      
      // Faz uma requisição para a API ViaCEP
      const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = response.data;
      
      console.log(`Resposta da API ViaCEP:`, data);
      
      // Verifica se a API retornou erro
      if (data.erro) {
        return res.status(404).json({ message: "CEP não encontrado" });
      }
      
      // Formata os dados para o padrão do nosso sistema
      const addressData = {
        zipcode: data.cep.replace(/\D/g, ''),
        street: data.logradouro,
        complement: data.complemento,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf
      };
      
      return res.json(addressData);
    } catch (apiError) {
      console.error("Erro ao consultar API de CEP:", apiError);
      return res.status(503).json({ message: "Não foi possível consultar o serviço de CEP" });
    }
  } catch (error) {
    console.error("Erro na busca de endereço por CEP:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;