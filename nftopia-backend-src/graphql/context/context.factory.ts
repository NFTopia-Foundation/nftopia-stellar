import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GraphqlAuthMiddleware } from '../middleware/auth.middleware';
import type { GraphqlContext } from './context.interface';

@Injectable()
export class GraphqlContextFactory {
  constructor(private readonly authMiddleware: GraphqlAuthMiddleware) {}

  async create(req: Request, res: Response): Promise<GraphqlContext> {
    const user = await this.authMiddleware.resolveUser(req);

    return {
      req,
      res,
      user,
    };
  }
}
