import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Keypair } from 'stellar-sdk';

/**
 * Canonical message format for bid authorization: prevents replay and binds amount to auction.
 * Frontend must sign this exact string (e.g. with Freighter/xBull signing a message).
 */
export function buildBidMessage(auctionId: string, amount: string, timestamp: string): string {
  return `bid:${auctionId}:${amount}:${timestamp}`;
}

export interface SignedBidPayload {
  amount: string;
  signature: string; // base64-encoded Ed25519 signature of the bid message
  publicKey: string; // G...
  timestamp?: string; // ISO or epoch ms; used in message; if omitted, no timestamp in message
}

@Injectable()
export class StellarSignatureGuard implements CanActivate {
  /** Max age of timestamp (ms); if payload includes timestamp, it must be within this window. */
  private static readonly MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as SignedBidPayload;
    const auctionId = (request.params as { auctionId?: string }).auctionId;

    if (!auctionId || !body?.amount || !body?.signature || !body?.publicKey) {
      throw new UnauthorizedException(
        'Missing bid signature data: amount, signature, and publicKey are required',
      );
    }

    const message = body.timestamp
      ? buildBidMessage(auctionId, body.amount, body.timestamp)
      : buildBidMessage(auctionId, body.amount, '');

    if (body.timestamp) {
      const ts = Number(body.timestamp);
      if (Number.isNaN(ts) || Date.now() - ts > StellarSignatureGuard.MAX_AGE_MS) {
        throw new UnauthorizedException('Bid signature timestamp expired or invalid');
      }
    }

    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(body.signature, 'base64');
    } catch {
      throw new UnauthorizedException('Invalid signature encoding');
    }

    try {
      const keypair = Keypair.fromPublicKey(body.publicKey);
      const messageBuffer = Buffer.from(message, 'utf8');
      const valid = keypair.verify(messageBuffer, signatureBuffer);
      if (!valid) {
        throw new UnauthorizedException('Invalid Stellar signature for bid');
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Stellar signature verification failed');
    }

    (request as Request & { signedBidPublicKey: string }).signedBidPublicKey = body.publicKey;
    return true;
  }
}
