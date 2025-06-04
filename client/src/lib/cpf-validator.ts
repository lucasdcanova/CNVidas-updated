/**
 * Funções para validação e formatação de CPF
 * Implementação baseada nas regras oficiais da Receita Federal do Brasil
 */

/**
 * Remove todos os caracteres não numéricos do CPF
 * @param cpf CPF com ou sem formatação
 * @returns CPF contendo apenas dígitos
 */
export function unformatCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Formata o CPF com pontos e traço (000.000.000-00)
 * @param cpf CPF sem formatação (apenas números)
 * @returns CPF formatado
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = unformatCPF(cpf);
  if (cleanCPF.length !== 11) return cpf;
  
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Verifica se um CPF é válido conforme as regras da Receita Federal
 * @param cpf CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF for válido, false caso contrário
 */
export function validateCPF(cpf: string): boolean {
  const cleanCPF = unformatCPF(cpf);
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    return false;
  }
  
  // Verifica se todos os dígitos são iguais, o que é inválido
  if (/^(\d)\1+$/.test(cleanCPF)) {
    return false;
  }
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cleanCPF.charAt(9))) {
    return false;
  }
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cleanCPF.charAt(10))) {
    return false;
  }
  
  return true;
}

/**
 * Lista de CPFs conhecidos inválidos que passariam na validação matemática
 * como 000.000.000-00, 111.111.111-11, etc.
 */
export const INVALID_CPFS = [
  '00000000000',
  '11111111111',
  '22222222222',
  '33333333333',
  '44444444444',
  '55555555555',
  '66666666666',
  '77777777777',
  '88888888888',
  '99999999999'
];