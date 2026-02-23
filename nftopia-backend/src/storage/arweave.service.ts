import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import Arweave from 'arweave';
import type { JWKInterface } from 'arweave/node/lib/wallet';
import { getStorageConfig } from './storage.config';
import type { ArweaveUploadResult, UploadedFile } from './storage.types';
import { toArweaveGatewayUrl, toArweaveUri } from './utils/uri.utils';

@Injectable()
export class ArweaveService {
  private arweaveClient: Arweave | null = null;
  private walletJwk: JWKInterface | null = null;

  constructor(private readonly configService: ConfigService) {}

  async upload(file: UploadedFile): Promise<ArweaveUploadResult> {
    const client = this.getArweaveClient();
    const wallet = await this.getWalletJwk();
    const arweaveConfig = getStorageConfig(this.configService).arweave;

    const transaction = await client.createTransaction(
      { data: file.buffer },
      wallet,
    );
    transaction.addTag('Content-Type', file.mimetype);
    transaction.addTag('App-Name', 'NFTopia');
    transaction.addTag('File-Name', file.originalname);

    await client.transactions.sign(transaction, wallet);

    const uploader = await client.transactions.getUploader(transaction);
    while (!uploader.isComplete) {
      await uploader.uploadChunk();
    }

    return {
      id: transaction.id,
      uri: toArweaveUri(transaction.id),
      gatewayUrl: toArweaveGatewayUrl(transaction.id, arweaveConfig.gatewayUrl),
    };
  }

  private getArweaveClient(): Arweave {
    if (this.arweaveClient) {
      return this.arweaveClient;
    }

    const arweaveConfig = getStorageConfig(this.configService).arweave;
    this.arweaveClient = Arweave.init({
      host: arweaveConfig.host,
      port: arweaveConfig.port,
      protocol: arweaveConfig.protocol,
    });

    return this.arweaveClient;
  }

  private async getWalletJwk(): Promise<JWKInterface> {
    if (this.walletJwk) {
      return this.walletJwk;
    }

    const arweaveConfig = getStorageConfig(this.configService).arweave;
    let walletJson = arweaveConfig.walletJwk;

    if (!walletJson && arweaveConfig.walletPath) {
      walletJson = await readFile(resolve(arweaveConfig.walletPath), 'utf8');
    }

    if (!walletJson) {
      throw new Error(
        'Arweave wallet not configured. Set ARWEAVE_WALLET_JWK or ARWEAVE_WALLET_PATH.',
      );
    }

    try {
      this.walletJwk = JSON.parse(walletJson) as JWKInterface;
    } catch {
      throw new Error('Invalid Arweave wallet JSON payload');
    }

    return this.walletJwk;
  }
}
