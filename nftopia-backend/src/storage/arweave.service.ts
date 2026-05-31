import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  private readonly logger = new Logger(ArweaveService.name);
  private arweaveClient: Arweave | null = null;
  private walletJwk: JWKInterface | null = null;

  constructor(private readonly configService: ConfigService) {}

  async upload(file: UploadedFile): Promise<ArweaveUploadResult> {
    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Arweave upload failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('Failed to upload to Arweave. Please try again later.');
    }
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
      this.logger.error('Arweave wallet not configured');
      throw new InternalServerErrorException(
        'Arweave wallet not configured. Please contact support.',
      );
    }

    try {
      this.walletJwk = JSON.parse(walletJson) as JWKInterface;
    } catch (error) {
      this.logger.error('Invalid Arweave wallet JSON payload');
      throw new BadRequestException('Invalid Arweave wallet configuration');
    }

    return this.walletJwk;
  }
}
