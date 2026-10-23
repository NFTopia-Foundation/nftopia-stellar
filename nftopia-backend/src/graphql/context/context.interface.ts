import type { Request, Response } from 'express';
import type { GraphqlLoaders } from '../loaders';

export type GraphqlUser = {
  userId: string;
  username?: string;
  email?: string;
  walletAddress?: string;
  tokenType?: string;
  role?: string;
};

export interface GraphqlContext {
  // Absent for a GraphQL-WS subscription connection — it has no underlying
  // HTTP request/response, only connectionParams (see
  // GraphqlContextFactory.createForSubscription).
  req?: Request;
  res?: Response;
  user?: GraphqlUser;
  loaders: GraphqlLoaders;
}
