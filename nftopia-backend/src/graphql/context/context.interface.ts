import type { Request, Response } from 'express';

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
}
