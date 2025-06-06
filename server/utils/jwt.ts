import { verify } from 'jsonwebtoken';
import { AppError } from './app-error';
import { validateId } from './id-converter';

interface DecodedToken {
  id: string | number;
  [key: string]: any;
}

export async function verifyToken(token: string): Promise<DecodedToken> {
  try {
    const decoded = verify(token, process.env.JWT_SECRET || 'default-secret') as DecodedToken;
    return {
      ...decoded,
      id: validateId(decoded.id)
    };
  } catch (error) {
    throw new AppError('Token inválido', 401);
  }
} 