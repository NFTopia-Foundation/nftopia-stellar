import { Injectable } from '@nestjs/common';
import { Keypair, StrKey } from 'stellar-sdk';

@Injectable()
export class StellarSignatureStrategy {
  isValidPublicKey(publicKey: string): boolean {
    return StrKey.isValidEd25519PublicKey(publicKey);
  }

  verifySignedMessage(
    publicKey: string,
    message: string,
    signatureBase64: string,
  ): boolean {
    if (!this.isValidPublicKey(publicKey)) {
      return false;
    }

    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const payload = Buffer.from(message, 'utf8');
      const signature = Buffer.from(signatureBase64, 'base64');
      return keypair.verify(payload, signature);
    } catch {
      return false;
    }
  }
}
