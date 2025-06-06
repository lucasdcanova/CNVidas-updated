import { AppError } from './app-error';
import { z } from "zod";

// Schema para validação de IDs
export const idSchema = z.union([z.string(), z.number()]);

// Função base para conversão segura de string ou number para number
export const toNumberOrThrow = (value: unknown): number => {
  if (value === null || value === undefined) {
    throw new AppError('Valor não pode ser nulo', 400);
  }
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new AppError('Valor inválido', 400);
    }
    return parsed;
  }
  throw new AppError('Valor inválido', 400);
};

// Função específica para conversão de IDs de usuário
export const toUserId = (id: unknown): number => {
  return toNumberOrThrow(id);
};

// Função para conversão de números com validação
export const toNumber = (value: unknown): number => {
  return toNumberOrThrow(value);
};

// Função para conversão de números opcionais
export const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return toNumberOrThrow(value);
  } catch {
    return null;
  }
};

// Função para conversão direta de ID
export const convertIdToNumber = (id: unknown): number => {
  return toNumberOrThrow(id);
};

// Função para conversão de ID com valor padrão
export const convertIdToNumberWithDefault = (id: unknown, defaultValue: number): number => {
  if (id === null || id === undefined) {
    return defaultValue;
  }
  try {
    return toNumberOrThrow(id);
  } catch {
    return defaultValue;
  }
};

// Função para validação de ID usando Zod
export const validateId = (id: unknown): number => {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    throw new AppError('ID inválido', 400);
  }
  return toNumberOrThrow(result.data);
}; 