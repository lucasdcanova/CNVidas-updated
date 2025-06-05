import { Request } from 'express';
import { User } from '@shared/types';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

// As interfaces AuthenticatedRequest e AuthRequest foram removidas pois a propriedade user
// já está definida globalmente na interface Express.Request através do arquivo express.d.ts 

export interface AuthenticatedRequest extends Request {
  user?: User;
} 