import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Durability, Api } from 'stellar-sdk/rpc';
import { xdr } from 'stellar-sdk';
import { Transaction, Networks } from 'stellar-sdk';

/** Stroops per XLM: 1 XLM = 10^7 stroops */
export const STROOPS_PER_XLM = 10_000_000;

export function xlmToStroops(xlm: string): bigint {
  const [whole, frac = ''] = xlm.split('.');
  const padded = frac.padEnd(7, '0').slice(0, 7);
  return BigInt(whole + padded);
}

export function stroopsToXlm(stroops: bigint | string): string {
  const s = typeof stroops === 'string' ? BigInt(stroops) : stroops;
  const str = s.toString().padStart(8, '0');
  const intPart = str.slice(0, -7) || '0';
  const decPart = str.slice(-7).replace(/0+$/, '') || '0';
  return decPart === '0' ? intPart : `${intPart}.${decPart}`;
}

export interface AuctionContractError {
  code: string;
  message: string;
}

export interface HighestBidResult {
  bidder: string;
  amountStroops: string;
  amountXlm: string;
  ledgerSequence?: number;
}

@Injectable()
export class SorobanRpcService {
  private readonly logger = new Logger(SorobanRpcService.name);
  private readonly server: Server;
  private readonly auctionContractId: string;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL') ?? 'https://soroban-testnet.stellar.org';
    this.server = new Server(rpcUrl);
    const contractId = this.configService.get<string>('AUCTION_CONTRACT_ID');
    if (!contractId) {
      this.logger.warn('AUCTION_CONTRACT_ID is not set. Auction contract methods will fail.');
    }
    this.auctionContractId = contractId ?? '';
  }

  getServer(): Server {
    return this.server;
  }

  getAuctionContractId(): string {
    return this.auctionContractId;
  }

  /**
   * Fetch contract data by key; returns the ScVal for contract data entries.
   */
  async getContractData(contractId: string, key: xdr.ScVal): Promise<xdr.ScVal | null> {
    try {
      const data = await this.server.getContractData(contractId, key, Durability.Persistent);
      const entry = data?.val;
      if (!entry) return null;
      const contractData = (entry as unknown as { contractData?: () => { val: () => xdr.ScVal } }).contractData?.();
      return contractData?.val?.() ?? null;
    } catch (e) {
      const err = e as Error;
      this.logger.debug(`getContractData failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Get highest bid for an auction from contract state.
   * Contract storage key format is implementation-specific; override buildAuctionStateKey if needed.
   */
  async getHighestBidFromContract(auctionId: string): Promise<HighestBidResult | null> {
    if (!this.auctionContractId) return null;
    try {
      const key = this.buildAuctionStateKey(auctionId, 'highest_bid');
      const val = await this.getContractData(this.auctionContractId, key);
      if (!val) return null;
      return this.parseHighestBidScVal(val);
    } catch (e) {
      this.logger.warn(`getHighestBidFromContract(${auctionId}): ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Get all bids from contract when exposed; otherwise use events/DB.
   */
  async getBidsFromContract(_auctionId: string): Promise<Array<{ bidder: string; amountStroops: string }>> {
    return [];
    // Contract-specific: implement when auction contract exposes a bids list.
  }

  /**
   * Simulate a transaction (for fee estimation and validation).
   */
  async simulateTransaction(envelopeXdr: string): Promise<{ success: boolean; error?: AuctionContractError }> {
    try {
      const networkPassphrase = this.configService.get<string>('NETWORK_PASSPHRASE') ?? Networks.TESTNET;
      const tx = new Transaction(envelopeXdr, networkPassphrase);
      const response = await this.server.simulateTransaction(tx);
      if (Api.isSimulationError(response)) {
        return {
          success: false,
          error: this.mapContractError(response.error),
        };
      }
      return { success: true };
    } catch (e) {
      const err = e as Error;
      return {
        success: false,
        error: { code: 'SIMULATION_FAILED', message: err.message },
      };
    }
  }

  /**
   * Submit a signed transaction to the network.
   */
  async sendTransaction(signedEnvelopeXdr: string): Promise<{ hash: string } | { error: AuctionContractError }> {
    try {
      const networkPassphrase = this.configService.get<string>('NETWORK_PASSPHRASE') ?? Networks.TESTNET;
      const tx = new Transaction(signedEnvelopeXdr, networkPassphrase);
      const result = await this.server.sendTransaction(tx);
      if (result.errorResult) {
        return { error: this.parseErrorResult(result.errorResult) };
      }
      return { hash: result.hash };
    } catch (e) {
      const err = e as Error;
      return {
        error: { code: 'SEND_FAILED', message: err.message },
      };
    }
  }

  /**
   * Wait for transaction confirmation by polling getTransaction.
   */
  async waitForTransaction(hash: string, _timeoutLedgers = 20): Promise<boolean> {
    const start = Date.now();
    const timeoutMs = 60000;
    while (Date.now() - start < timeoutMs) {
      try {
        const tx = await this.server.getTransaction(hash);
        if (tx.status === Api.GetTransactionStatus.SUCCESS) return true;
        if (tx.status === Api.GetTransactionStatus.FAILED || tx.status === Api.GetTransactionStatus.NOT_FOUND) return false;
      } catch {
        // not found yet
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }

  async getLatestLedger(): Promise<number> {
    try {
      const response = await this.server.getLatestLedger();
      return response.sequence;
    } catch (e) {
      this.logger.warn(`getLatestLedger: ${(e as Error).message}`);
      return 0;
    }
  }

  async getEvents(
    startLedger: number,
    contractIds: string[],
    topics: string[][] = [],
  ): Promise<Array<{ ledger: number; topic: string[]; value: xdr.ScVal }>> {
    try {
      const response = await this.server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds, topics }],
      });
      return (response.events ?? []).map((e: Api.EventResponse) => ({
        ledger: e.ledger,
        topic: (e.topic ?? []).map((t) => (typeof t === 'string' ? t : String(t))),
        value: e.value,
      }));
    } catch (e) {
      this.logger.warn(`getEvents: ${(e as Error).message}`);
      return [];
    }
  }

  /** Build storage key for auction state (format depends on contract; extend in subclass if needed). */
  private buildAuctionStateKey(auctionId: string, suffix: string): xdr.ScVal {
    const entries: xdr.ScMapEntry[] = [
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('id'), val: xdr.ScVal.scvString(auctionId) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('kind'), val: xdr.ScVal.scvSymbol(suffix) }),
    ];
    return xdr.ScVal.scvMap(entries as never);
  }

  private parseHighestBidScVal(val: xdr.ScVal): HighestBidResult | null {
    try {
      const map = val.map?.();
      if (!map || !map.length) return null;
      let bidder = '';
      let amountStroops = '0';
      const raw = val as unknown as { map?: () => Array<{ key: () => unknown; val: () => unknown }> };
      const entries = raw.map?.() ?? [];
      for (const entry of entries) {
        const k = entry.key();
        const v = entry.val();
        const kAny = k as { switch?: () => unknown; sym?: () => { toString?: () => string } };
        const vAny = v as { switch?: () => unknown; address?: () => { toScAddress?: () => { accountId?: () => { ed25519?: () => Buffer } } }; i128?: () => { hi?: () => unknown; lo?: () => unknown } };
        const sym = kAny.sym?.()?.toString?.() ?? '';
        if (sym === 'bidder' && vAny.address) {
          const addr = vAny.address();
          const accountId = addr?.toScAddress?.()?.accountId?.();
          const ed = accountId?.ed25519?.();
          bidder = ed ? 'G' + ed.toString('base64').replace(/=/g, '') : '';
        } else if ((sym === 'amount' || sym === 'value') && vAny.i128) {
          const i128 = vAny.i128();
          const hi = Number(i128?.hi?.() ?? 0);
          const lo = Number(i128?.lo?.() ?? 0);
          amountStroops = String(BigInt(hi) << 64n | BigInt(lo));
        }
      }
      if (!bidder) return null;
      return { bidder, amountStroops, amountXlm: stroopsToXlm(amountStroops) };
    } catch {
      return null;
    }
  }

  private mapContractError(rpcError: unknown): AuctionContractError {
    if (rpcError && typeof rpcError === 'object' && 'message' in rpcError) {
      return { code: 'CONTRACT_ERROR', message: (rpcError as { message: string }).message };
    }
    return { code: 'UNKNOWN', message: String(rpcError) };
  }

  private parseErrorResult(_errorResult: xdr.TransactionResult): AuctionContractError {
    return { code: 'TX_FAILED', message: 'Transaction failed on ledger' };
  }
}
