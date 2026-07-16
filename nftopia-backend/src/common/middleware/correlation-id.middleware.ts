import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      (req.id as string) ||
      crypto.randomUUID();

    // Ensure it is set on the request object for pino-http and downstream usage
    req['correlationId'] = correlationId;
    req.headers['x-correlation-id'] = correlationId;

    // Set on the response header
    if (!res.headersSent && !res.getHeader('x-correlation-id')) {
      res.setHeader('x-correlation-id', correlationId);
    }

    next();
  }
}
