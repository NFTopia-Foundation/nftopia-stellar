import type { Request, Response } from 'express';
import type { DataLoaders } from '../loaders';

export type GraphqlUser = {
  userId: string;
  username?: string;
  email?: string;
  walletAddress?: string;
  tokenType?: string;
};

export interface GraphqlContext {
  req: Request;
  res: Response;
  user?: GraphqlUser;
  loaders: DataLoaders;
}
