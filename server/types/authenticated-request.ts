import { Request } from 'express';
import { User } from '@shared/schema';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

export interface AuthenticatedRequest extends Request<ParamsDictionary, any, any, ParsedQs> {
  user?: User;
}

export interface AuthRequest extends Request<ParamsDictionary, any, any, ParsedQs> {
  user: User;
} 