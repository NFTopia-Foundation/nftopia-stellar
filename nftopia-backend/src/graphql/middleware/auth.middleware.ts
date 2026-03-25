import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { GraphqlUser } from '../context/context.interface';

@Injectable()
export class GraphqlAuthMiddleware {
  private readonly logger = new Logger(GraphqlAuthMiddleware.name);

  constructor(private readonly jwtService: JwtService) {}

  async resolveUser(req: Request): Promise<GraphqlUser | undefined> {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      return undefined;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        username?: string;
        email?: string;
        walletAddress?: string;
        type?: string;
      }>(token);

      return {
        userId: payload.sub,
        username: payload.username,
        email: payload.email,
        walletAddress: payload.walletAddress,
        tokenType: payload.type,
      };
    } catch (error) {
      const authError = error as Error;
      this.logger.debug(`Ignoring invalid GraphQL JWT: ${authError.message}`);
      return undefined;
    }
  }
}
