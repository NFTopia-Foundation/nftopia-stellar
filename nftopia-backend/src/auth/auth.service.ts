import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  TransactionBuilder,
  Networks,
  Account,
  Operation,
  Transaction,
  Keypair,
} from 'stellar-sdk';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  // In-memory store for nonces (or use DB/Cache in production)
  // Map<publicKey, nonce>
  private activeNonces = new Map<string, string>();

  generateChallenge(publicKey: string) {
    const nonce = crypto.randomBytes(16).toString('hex');
    this.activeNonces.set(publicKey, nonce);

    // Create a dummy account or use the user's public key with sequence 0
    // SEP-10 recommends using the server's signing key as source,
    // but for "simpler" flow as requested, we can use the user's key
    // or just a challenge transaction structure.
    // The issue says: "Manage Data op with a nonce".

    // We'll use the user's public key as the source account for the transaction check
    // In a real SEP-10, strict rules apply. Here we follow "SEP-0010 compliant or similar".

    // Creating a transaction that is invalid to submit (time bounds, etc) but valid to sign.
    // For simplicity, using a "0" sequence number if possible or just a dummy account.
    // However, stellar-sdk requires a sequence number.

    const sourceAccount = new Account(publicKey, '0');

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: Networks.TESTNET, // Or PUBLIC, should be configurable
      timebounds: {
        minTime: 0,
        maxTime: 0,
      },
    })
      .addOperation(
        Operation.manageData({
          name: 'auth',
          value: nonce,
          source: publicKey,
        }),
      )
      .setTimeout(0) // Make it invalid
      .build();

    return {
      transaction: transaction.toXDR(),
      networkPassphrase: Networks.TESTNET,
    };
  }

  validateStellarTransaction(
    transactionXdr: string,
  ): { publicKey: string } | null {
    let transaction: Transaction;
    try {
      transaction = new Transaction(transactionXdr, Networks.TESTNET);
    } catch (e) {
      console.error('Error parsing XDR', e);
      return null;
    }

    const sourceAccount = transaction.source;
    const ops = transaction.operations;

    // Basic validation: 1 operation, ManageData
    if (ops.length !== 1 || ops[0].type !== 'manageData') {
      return null;
    }

    const op = ops[0];
    if (op.name !== 'auth') {
      return null;
    }

    if (!op.value) {
      return null;
    }

    const nonce = op.value.toString();
    const serverNonce = this.activeNonces.get(sourceAccount);

    // Verify nonce matches what we expected for this user
    if (!serverNonce || serverNonce !== nonce) {
      console.error('Nonce mismatch');
      return null;
    }

    // Verify Signature
    // Verify that the transaction is signed by the sourceAccount (publicKey)
    // Utils.verifyTxSignedBy is available in newer SDKs, checking methods...

    // Wait, let's verify if verifyTxSignedBy exists or how to do it.
    // In stellar-sdk v10+: transaction.signatures, verify signature against hash.

    const hash = transaction.hash();
    const signature = transaction.signatures[0]; // Assume single signature for now

    if (!signature) {
      return null;
    }

    // Verify signature manually
    const keypair = Keypair.fromPublicKey(sourceAccount);
    if (keypair.verify(hash, signature.signature())) {
      // Clear nonce to prevent replay
      this.activeNonces.delete(sourceAccount);
      return { publicKey: sourceAccount };
    }

    return null;
  }

  login(user: { publicKey: string }) {
    const payload = { sub: user.publicKey, publicKey: user.publicKey };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
