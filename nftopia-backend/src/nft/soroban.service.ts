
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Durability } from 'stellar-sdk/rpc';
import { scValToNative, xdr } from 'stellar-sdk';

@Injectable()
export class SorobanService {
    private readonly logger = new Logger(SorobanService.name);
    private server: Server;

    constructor(private configService: ConfigService) {
        const rpcUrl =
            this.configService.get<string>('SOROBAN_RPC_URL') ||
            'https://soroban-testnet.stellar.org';
        this.server = new Server(rpcUrl);
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
            this.logger.error(`Error fetching contract data: ${e.message}`);
            return null;
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
            this.logger.error(`Error fetching events: ${e.message}`);
            return [];
        }
    }

    async getLatestLedger() {
        try {
            const response = await this.server.getLatestLedger();
            return response.sequence;
        } catch (e) {
            this.logger.error(`Error fetching latest ledger: ${e.message}`);
            return 0;
        }
    }
}
