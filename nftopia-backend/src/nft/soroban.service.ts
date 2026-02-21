import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Durability } from 'stellar-sdk/rpc';
import { xdr } from 'stellar-sdk';
import { SorobanRpcError } from '../common/errors/stellar.errors';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private server: Server;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL');
    if (!rpcUrl) {
      this.logger.warn(
        'SOROBAN_RPC_URL is not set. Using default testnet URL.',
      );
    }
    this.server = new Server(rpcUrl || 'https://soroban-testnet.stellar.org');
  }

  getRpcServer() {
    return this.server;
  }

  async getContractData(contractId: string, key: xdr.ScVal) {
    try {
      const data = await this.server.getContractData(
        contractId,
        key,
        Durability.Persistent,
      );
      return data;
    } catch (e) {
      const error = e as Error;
      this.logger.error(
        `Failed to fetch contract data for contract ${contractId}: ${error.message}`,
        error.stack,
      );
      throw new SorobanRpcError(
        `Contract data fetch failed: ${error.message}`,
        { contractId },
      );
    }
  }

  async getEvents(
    startLedger: number,
    contractIds: string[],
    topics: string[][] = [],
  ) {
    try {
      const response = await this.server.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds,
            topics,
          },
        ],
      });
      return response.events;
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Error fetching events: ${error.message}`);
      throw new SorobanRpcError(`Events fetch failed: ${error.message}`);
    }
  }

  async getLatestLedger() {
    try {
      const response = await this.server.getLatestLedger();
      return response.sequence;
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Error fetching latest ledger: ${error.message}`);
      throw new SorobanRpcError(`Latest ledger fetch failed: ${error.message}`);
    }
  }
}
