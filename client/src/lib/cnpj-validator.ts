/**
 * Valida um CNPJ
 * @param cnpj - CNPJ a ser validado (pode estar formatado ou não)
 * @returns true se o CNPJ é válido, false caso contrário
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  // Verifica se o CNPJ tem 14 dígitos
  if (cleanCNPJ.length !== 14) {
    return false;
  }

  // Verifica se todos os dígitos são iguais (ex: 00000000000000)
  if (/^(\d)\1+$/.test(cleanCNPJ)) {
    return false;
  }

  // Validação dos dígitos verificadores
  let sum = 0;
  let position = 5;

  // Primeiro dígito verificador
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * position;
    position = position === 2 ? 9 : position - 1;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  if (result !== parseInt(cleanCNPJ.charAt(12))) {
    return false;
  }

  // Segundo dígito verificador
  sum = 0;
  position = 6;

  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * position;
    position = position === 2 ? 9 : position - 1;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return result === parseInt(cleanCNPJ.charAt(13));
}

/**
 * Formata um CNPJ no padrão XX.XXX.XXX/XXXX-XX
 * @param cnpj - CNPJ a ser formatado (apenas números)
 * @returns CNPJ formatado
 */
export function formatCNPJ(cnpj: string): string {
  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) {
    return cnpj;
  }
  
  return cleanCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Remove a formatação de um CNPJ
 * @param cnpj - CNPJ formatado
 * @returns CNPJ sem formatação (apenas números)
 */
export function unformatCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}