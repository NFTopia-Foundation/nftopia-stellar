import {
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  StrKey,
} from 'stellar-sdk';
import { Server as SorobanServer, assembleTransaction } from 'stellar-sdk/rpc';

type SorobanArgType =
  | 'address'
  | 'i128'
  | 'u32'
  | 'u64'
  | 'string'
  | 'symbol'
  | 'bool'
  | 'bytes'
  | 'raw';

export type SorobanContractArg = {
  type?: SorobanArgType;
  value: unknown;
};

export type BuildTransactionResult = {
  transactionXdr: string;
  simulationResult: unknown;
};

export type SubmitTransactionResult = {
  hash: string;
  status: string;
  ledger?: number;
  result?: unknown;
};

export type InvokeContractResult = {
  transaction?: BuildTransactionResult;
  submission?: SubmitTransactionResult;
  returnValue?: unknown;
};

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);

  constructor(private readonly configService: ConfigService) {}

  async invokeContract(
    contractId: string,
    method: string,
    args: SorobanContractArg[] = [],
    options?: {
      sourceAccount?: string;
      signature?: string;
      submit?: boolean;
    },
  ): Promise<InvokeContractResult> {
    this.ensureValidContractAddress(contractId);
    this.logger.log(
      `Audit contract invoke: contract=${contractId} method=${method} submit=${Boolean(options?.submit)}`,
    );

    const tx = await this.buildTransaction(
      contractId,
      method,
      args,
      options?.sourceAccount,
    );

    if (options?.submit) {
      const submission = await this.submitTransaction(tx, options.signature);
      return {
        transaction: tx,
        submission,
      };
    }

    return {
      transaction: tx,
      returnValue: this.extractSimulationReturnValue(tx.simulationResult),
    };
  }

  async buildTransaction(
    contractId: string,
    method: string,
    args: SorobanContractArg[] = [],
    sourceAccount?: string,
  ): Promise<BuildTransactionResult> {
    this.ensureValidContractAddress(contractId);
    const source =
      sourceAccount ||
      this.configService.get<string>('STELLAR_OPERATOR_PUBLIC_KEY');

    if (!source || !StrKey.isValidEd25519PublicKey(source)) {
      throw new ServiceUnavailableException(
        'Missing or invalid STELLAR_OPERATOR_PUBLIC_KEY for transaction building',
      );
    }

    const server = this.createRpcServer();
    const networkPassphrase = this.getNetworkPassphrase();
    const timeoutSeconds = this.getTransactionTimeoutSeconds();

    try {
      const account = await server.getAccount(source);
      const contract = new Contract(contractId);
      const operation = contract.call(
        method,
        ...args.map((arg) => this.toScVal(arg)),
      );

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(timeoutSeconds)
        .build();

      const simulationResult = await server.simulateTransaction(tx);

      if ('error' in (simulationResult as { error?: string })) {
        throw new BadRequestException(
          `Soroban simulation failed: ${(simulationResult as { error?: string }).error || 'unknown error'}`,
        );
      }

      this.logger.log(
        `Audit tx built: contract=${contractId} method=${method} source=${source}`,
      );

      return {
        transactionXdr: tx.toXDR(),
        simulationResult,
      };
    } catch (error) {
      throw this.mapSorobanError(error);
    }
  }

  async submitTransaction(
    tx: BuildTransactionResult,
    signature?: string,
  ): Promise<SubmitTransactionResult> {
    const signer =
      signature || this.configService.get<string>('STELLAR_OPERATOR_SECRET');
    if (!signer) {
      throw new ServiceUnavailableException(
        'No transaction signer provided. Configure STELLAR_OPERATOR_SECRET or pass signature.',
      );
    }

    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const server = this.createRpcServer();
        const networkPassphrase = this.getNetworkPassphrase();
        const keypair = Keypair.fromSecret(signer);

        const unsignedTx = TransactionBuilder.fromXDR(
          tx.transactionXdr,
          networkPassphrase,
        ) as Transaction;

        const assembled = assembleTransaction(
          unsignedTx,
          tx.simulationResult as never,
        ).build();

        assembled.sign(keypair);
        const sendResult = await server.sendTransaction(assembled);

        if (sendResult.status === 'ERROR') {
          throw new BadRequestException(
            `Soroban submission error: ${JSON.stringify(sendResult.errorResult ?? {})}`,
          );
        }

        const finalized = await this.pollTransactionResult(
          server,
          sendResult.hash,
        );

        this.logger.log(
          `Audit tx submitted: hash=${sendResult.hash} status=${finalized.status}`,
        );

        return finalized;
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          break;
        }

        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw this.mapSorobanError(lastError);
  }

  ensureValidAccountAddress(address: string): void {
    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new BadRequestException(
        `Invalid Stellar account address: ${address}`,
      );
    }
  }

  ensureValidContractAddress(address: string): void {
    try {
      Address.fromString(address);
    } catch {
      throw new BadRequestException(
        `Invalid Stellar contract address: ${address}`,
      );
    }
  }

  private createRpcServer(): SorobanServer {
    const rpcUrl =
      this.configService.get<string>('SOROBAN_RPC_URL') ||
      'https://soroban-testnet.stellar.org';

    return new SorobanServer(rpcUrl);
  }

  private getNetworkPassphrase(): string {
    const network =
      this.configService.get<string>('STELLAR_NETWORK') || 'TESTNET';

    if (network.toUpperCase() === 'MAINNET') {
      return Networks.PUBLIC;
    }

    return Networks.TESTNET;
  }

  private getTransactionTimeoutSeconds(): number {
    const raw =
      this.configService.get<string>('TRANSACTION_TIMEOUT_SECONDS') || '60';
    const timeout = Number.parseInt(raw, 10);

    return Number.isFinite(timeout) && timeout > 0 ? timeout : 60;
  }

  private toScVal(arg: SorobanContractArg) {
    const type = arg.type || 'raw';

    if (type === 'address') {
      if (typeof arg.value !== 'string') {
        throw new BadRequestException('Address argument must be a string');
      }
      return Address.fromString(arg.value).toScVal();
    }

    if (type === 'i128') {
      return nativeToScVal(BigInt(String(arg.value)), { type: 'i128' });
    }

    if (type === 'u32') {
      return nativeToScVal(Number(arg.value), { type: 'u32' });
    }

    if (type === 'u64') {
      return nativeToScVal(BigInt(String(arg.value)), { type: 'u64' });
    }

    if (type === 'string') {
      return nativeToScVal(String(arg.value), { type: 'string' });
    }

    if (type === 'symbol') {
      return nativeToScVal(String(arg.value), { type: 'symbol' });
    }

    if (type === 'bool') {
      return nativeToScVal(Boolean(arg.value), { type: 'bool' });
    }

    if (type === 'bytes') {
      return nativeToScVal(Buffer.from(String(arg.value)), { type: 'bytes' });
    }

    return nativeToScVal(arg.value);
  }

  private extractSimulationReturnValue(simulationResult: unknown): unknown {
    const maybeResult = simulationResult as {
      result?: {
        retval?: unknown;
      };
    };

    const retval = maybeResult?.result?.retval;
    if (!retval) {
      return null;
    }

    try {
      return scValToNative(retval as never);
    } catch {
      return retval;
    }
  }

  private async pollTransactionResult(
    server: SorobanServer,
    hash: string,
  ): Promise<SubmitTransactionResult> {
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      const txResult = (await server.getTransaction(hash)) as {
        status?: string;
        ledger?: number;
        returnValue?: unknown;
      };

      if (!txResult?.status || txResult.status === 'NOT_FOUND') {
        continue;
      }

      if (txResult.status === 'FAILED') {
        throw new BadRequestException(`Soroban transaction failed: ${hash}`);
      }

      if (txResult.status === 'SUCCESS') {
        return {
          hash,
          status: txResult.status,
          ledger: txResult.ledger,
          result: txResult.returnValue,
        };
      }
    }

    throw new GatewayTimeoutException(
      `Timed out waiting for transaction finalization: ${hash}`,
    );
  }

  private mapSorobanError(error: unknown): Error {
    if (error instanceof Error && 'getStatus' in error) {
      return error;
    }

    const message =
      (error as { message?: string })?.message || 'Unknown Soroban error';
    const normalized = message.toLowerCase();

    if (normalized.includes('timeout') || normalized.includes('timed out')) {
      return new GatewayTimeoutException(message);
    }

    if (
      normalized.includes('bad sequence') ||
      normalized.includes('tx_bad_seq')
    ) {
      return new ConflictException(message);
    }

    if (
      normalized.includes('insufficient') ||
      normalized.includes('invalid') ||
      normalized.includes('simulation failed')
    ) {
      return new BadRequestException(message);
    }

    if (
      normalized.includes('unavailable') ||
      normalized.includes('network error') ||
      normalized.includes('fetch failed')
    ) {
      return new ServiceUnavailableException(message);
    }

    this.logger.error(`Unhandled Soroban error: ${message}`);
    return new InternalServerErrorException(message);
  }
}
