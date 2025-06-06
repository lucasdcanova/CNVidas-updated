import { UserId } from '../types';
import { AppError } from './app-error';

export const toUserId = (id: string | number): UserId => {
  if (typeof id === 'string') {
    const parsed = parseInt(id, 10) as number;
    if (isNaN(parsed)) {
      throw new AppError('ID inválido', 400);
    }
    return parsed;
  }
  return id;
}; 