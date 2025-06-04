import OpenAI from "openai";
import { db } from "./db";
import { users } from '../shared/schema';
import { isNotNull, ne, and } from "drizzle-orm";

// Inicialização do cliente OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Função para obter todos os vendedores do banco de dados
export async function getAllSellers(): Promise<string[]> {
  const sellerRecords = await db
    .select({ sellerName: users.sellerName })
    .from(users)
    .where(
      and(
        isNotNull(users.sellerName),
        ne(users.sellerName, '')
      )
    )
    .groupBy(users.sellerName);
  
  // Filtrar registros nulos e converter para array de strings
  return sellerRecords
    .filter(record => record.sellerName !== null)
    .map(record => record.sellerName as string);
}

// Função para checar se dois nomes são similares usando OpenAI
export async function areSimilarNames(name1: string, name2: string): Promise<boolean> {
  try {
    // O modelo gpt-4o foi lançado em 13 de maio de 2024
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um sistema especializado em comparar nomes de pessoas. Sua tarefa é determinar se dois nomes representam a mesma pessoa, mesmo com erros de digitação, falta de sobrenomes ou variações na escrita."
        },
        {
          role: "user",
          content: `Compare os seguintes nomes e determine se eles provavelmente se referem à mesma pessoa. Responda apenas com 'true' ou 'false':\n\nNome 1: "${name1}"\nNome 2: "${name2}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const result = response.choices[0].message.content?.toLowerCase().trim() || '';
    return result === 'true';
  } catch (error) {
    console.error("Erro ao comparar nomes com OpenAI:", error);
    
    // Fallback para comparação básica se a API do OpenAI falhar
    return fallbackNameComparison(name1, name2);
  }
}

// Fallback para comparação de nomes sem API
function fallbackNameComparison(name1: string, name2: string): boolean {
  // Normaliza os nomes: remove espaços extras, converte para minúsculas
  const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');
  
  const normalizedName1 = normalize(name1);
  const normalizedName2 = normalize(name2);
  
  // Se os nomes são idênticos após normalização
  if (normalizedName1 === normalizedName2) return true;
  
  // Divide os nomes em partes (nome, sobrenomes)
  const parts1 = normalizedName1.split(' ');
  const parts2 = normalizedName2.split(' ');
  
  // Compara primeiro nome
  if (parts1[0] !== parts2[0]) return false;
  
  // Verifica se um dos nomes está contido no outro
  if (normalizedName1.includes(normalizedName2) || normalizedName2.includes(normalizedName1)) return true;
  
  // Verifica correspondência de iniciais de sobrenomes
  if (parts1.length > 1 && parts2.length > 1) {
    // Conta quantos sobrenomes correspondem
    let matchingLastNames = 0;
    for (let i = 1; i < parts1.length; i++) {
      for (let j = 1; j < parts2.length; j++) {
        if (parts1[i] === parts2[j]) {
          matchingLastNames++;
          break;
        }
      }
    }
    
    // Se pelo menos um sobrenome corresponde, consideramos similar
    return matchingLastNames > 0;
  }
  
  return false;
}

// Função principal para encontrar correspondência de vendedor ou criar novo
export async function findOrCreateSeller(newSellerName: string): Promise<string> {
  // Obter todos os vendedores existentes
  const existingSellers = await getAllSellers();
  
  // Se não houver vendedores, simplesmente retorna o novo nome
  if (existingSellers.length === 0) {
    return newSellerName;
  }
  
  // Verifica correspondência exata primeiro (otimização)
  if (existingSellers.includes(newSellerName)) {
    return newSellerName;
  }
  
  // Verificar cada vendedor existente usando OpenAI para identificar similares
  for (const existingSeller of existingSellers) {
    const isSimilar = await areSimilarNames(newSellerName, existingSeller);
    if (isSimilar) {
      console.log(`Nome de vendedor "${newSellerName}" corresponde a "${existingSeller}" existente.`);
      return existingSeller; // Usa o nome do vendedor existente para consistência
    }
  }
  
  // Se não encontrou correspondência, retorna o novo nome
  return newSellerName;
}