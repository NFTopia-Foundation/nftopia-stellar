import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanContractArg, SorobanService } from './soroban.service';

@Injectable()
export class TransactionContractClient {
  private readonly logger = new Logger(TransactionContractClient.name);
  private readonly contractId: string;

  constructor(
    private readonly sorobanService: SorobanService,
    private readonly configService: ConfigService,
  ) {
    const contractId = this.configService.get<string>(
      'TRANSACTION_CONTRACT_ID',
    );
    if (!contractId) {
      throw new ServiceUnavailableException(
        'TRANSACTION_CONTRACT_ID is not configured',
      );
    }
    this.contractId = contractId;
  }

  async createTransaction(
    creator: string,
    metadata: Record<string, unknown>,
    operations: Array<Record<string, unknown>>,
  ): Promise<number> {
    const args: SorobanContractArg[] = [
      { type: 'address', value: creator },
      { type: 'string', value: JSON.stringify(metadata || {}) },
      { type: 'string', value: JSON.stringify(operations || []) },
    ];

    const result = await this.call('create_transaction', args);
    return Number(result);
  }

  async addOperation(
    txId: number,
    operation: Record<string, unknown>,
  ): Promise<unknown> {
    const args: SorobanContractArg[] = [
      { type: 'u64', value: txId },
      { type: 'string', value: JSON.stringify(operation || {}) },
    ];
    return this.call('add_operation', args);
  }

  async executeTransaction(
    txId: number,
    maxGas: number,
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const args: SorobanContractArg[] = [
      { type: 'u64', value: txId },
      { type: 'u64', value: maxGas },
      { type: 'string', value: JSON.stringify(config || {}) },
    ];

    const result = await this.call('execute_transaction', args);
    return (result as Record<string, unknown>) || {};
  }

  async cancelTransaction(txId: number, reason: string): Promise<unknown> {
    const args: SorobanContractArg[] = [
      { type: 'u64', value: txId },
      { type: 'string', value: reason || 'cancelled_by_user' },
    ];
    return this.call('cancel_transaction', args);
  }

  async estimateTransactionGas(txId: number): Promise<number> {
    const args: SorobanContractArg[] = [{ type: 'u64', value: txId }];
    const result = await this.call('estimate_transaction_gas', args);
    return Number(result);
  }

  async batchCreateTransactions(
    blueprints: Array<Record<string, unknown>>,
  ): Promise<number[]> {
    const args: SorobanContractArg[] = [
      { type: 'string', value: JSON.stringify(blueprints || []) },
    ];
    const result = await this.call('batch_create_transactions', args);
    if (Array.isArray(result)) {
      return result.map((id) => Number(id));
    }
    return [];
  }

  async batchExecuteTransactions(
    ids: number[],
    config: Record<string, unknown>,
  ): Promise<unknown> {
    const args: SorobanContractArg[] = [
      { type: 'string', value: JSON.stringify(ids || []) },
      { type: 'string', value: JSON.stringify(config || {}) },
    ];
    return this.call('batch_execute_transactions', args);
  }

  async addSignature(
    txId: number,
    signer: string,
    signature: string,
  ): Promise<unknown> {
    const args: SorobanContractArg[] = [
      { type: 'u64', value: txId },
      { type: 'address', value: signer },
      { type: 'string', value: signature },
    ];
    return this.call('add_signature', args);
  }

  async recoverTransaction(txId: number, strategy: string): Promise<unknown> {
    const args: SorobanContractArg[] = [
      { type: 'u64', value: txId },
      { type: 'string', value: strategy || 'retry' },
    ];
    return this.call('recover_transaction', args);
  }

  async getTransactionStatus(txId: number): Promise<string> {
    const args: SorobanContractArg[] = [{ type: 'u64', value: txId }];
    const result = await this.call('get_transaction_status', args);
    return typeof result === 'string' ? result : 'unknown';
  }

  async getTransactionEvents(
    txId: number,
  ): Promise<Array<Record<string, unknown>>> {
    const args: SorobanContractArg[] = [{ type: 'u64', value: txId }];
    const result = await this.call('get_transaction_events', args);
    if (Array.isArray(result)) {
      return result as Array<Record<string, unknown>>;
    }
    return [];
  }

  private async call(method: string, args: SorobanContractArg[]) {
    try {
      const response = await this.sorobanService.invokeContract(
        this.contractId,
        method,
        args,
      );
      return response.returnValue;
    } catch (error) {
      this.logger.error(
        `Transaction contract call failed: ${method}`,
        (error as Error)?.stack,
      );

      const message =
        error instanceof Error ? error.message : 'contract invocation failed';
      throw new BadRequestException(message);
    }
  }
}
