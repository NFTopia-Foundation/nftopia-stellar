import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';

/**
 * Guard that enforces Stellar wallet signature verification on protected routes.
 *
 * Reads `publicKey` and `signature` from the request body and verifies that the
 * signature is a valid Ed25519 signature over the canonical bid payload:
 *   `bid:{auctionId}:{amount}`
 *
 * The route param `auctionId` must be present (as `:auctionId` or `:id`) for
 * the canonical message to be built correctly.
 */
@Injectable()
export class StellarSignatureGuard implements CanActivate {
  constructor(private readonly stellarStrategy: StellarSignatureStrategy) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { params?: Record<string, string> }>();

    const body = req.body as Record<string, unknown>;

    const publicKey =
      typeof body?.publicKey === 'string' ? body.publicKey : undefined;
    const signature =
      typeof body?.signature === 'string' ? body.signature : undefined;
    const amount = typeof body?.amount === 'string' ? body.amount : undefined;

    if (!publicKey || !signature || !amount) {
      throw new UnauthorizedException(
        'Missing publicKey, signature, or amount in request body',
      );
    }

    const auctionId = req.params?.auctionId ?? req.params?.id ?? '';

    const message = `bid:${auctionId}:${amount}`;

    const valid = this.stellarStrategy.verifySignedMessage(
      publicKey,
      message,
      signature,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid Stellar wallet signature');
    }

    return true;
  }
}
