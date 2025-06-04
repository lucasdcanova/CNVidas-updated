/**
 * Utilitários para normalização de dados
 */

/**
 * Normaliza campos opcionais para null em vez de undefined
 * @param obj Objeto a ser normalizado
 * @param fields Lista de campos opcionais
 * @returns Objeto com campos normalizados
 */
export function normalizeNull<T extends object>(obj: T, fields: (keyof T)[]): T {
  const copy = { ...obj };
  for (const field of fields) {
    if (copy[field] === undefined || copy[field] === null) {
      (copy as any)[field] = null;
    }
  }
  return copy;
}

/**
 * Converte snake_case para camelCase
 * @param str String em snake_case
 * @returns String em camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converte camelCase para snake_case
 * @param str String em camelCase
 * @returns String em snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Normaliza um objeto convertendo todas as chaves de snake_case para camelCase
 * @param obj Objeto com chaves em snake_case
 * @returns Objeto com chaves em camelCase
 */
export function normalizeObjectKeys<T extends object>(obj: T): T {
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    result[camelKey] = value;
  }
  
  return result as T;
}

/**
 * Normaliza um objeto convertendo todas as chaves de camelCase para snake_case
 * @param obj Objeto com chaves em camelCase
 * @returns Objeto com chaves em snake_case
 */
export function denormalizeObjectKeys<T extends object>(obj: T): T {
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    result[snakeKey] = value;
  }
  
  return result as T;
} 