import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SorobanRpcService } from '../../soroban/soroban-rpc.service';
import { BidsService } from '../bids.service';
import { BidsGateway } from '../bids.gateway';
import { ConfigService } from '@nestjs/config';

/** Topic for BidPlaced events (contract-specific; adjust to match your auction contract). */
const BID_PLACED_TOPIC = 'BidPlaced';

@Injectable()
export class BidEventListener implements OnModuleInit {
  private readonly logger = new Logger(BidEventListener.name);
  private lastLedger = 0;
  private pollIntervalMs = 5000;

  constructor(
    private readonly sorobanRpc: SorobanRpcService,
    private readonly bidsService: BidsService,
    private readonly bidsGateway: BidsGateway,
    private readonly configService: ConfigService,
  ) {
    const contractId = this.configService.get<string>('AUCTION_CONTRACT_ID');
    if (!contractId) {
      this.logger.warn('AUCTION_CONTRACT_ID not set; bid event listener will no-op');
    }
  }

  async onModuleInit() {
    this.lastLedger = await this.sorobanRpc.getLatestLedger();
    this.schedulePoll();
  }

  private schedulePoll() {
    setInterval(() => this.poll(), this.pollIntervalMs);
  }

  private async poll() {
    const contractId = this.sorobanRpc.getAuctionContractId();
    if (!contractId) return;

    const latest = await this.sorobanRpc.getLatestLedger();
    if (latest <= this.lastLedger) return;

    const events = await this.sorobanRpc.getEvents(
      this.lastLedger + 1,
      [contractId],
      [[BID_PLACED_TOPIC]],
    );

    for (const ev of events) {
      const parsed = this.parseBidPlacedEvent(ev);
      if (parsed) {
        try {
          const bid = await this.bidsService.upsertBidFromEvent(parsed);
          await this.bidsService.invalidateHighestBidCache(parsed.auctionId);
          this.bidsGateway.broadcastNewBid(parsed.auctionId, {
            id: bid.id,
            auctionId: bid.auctionId,
            bidderPublicKey: bid.bidderPublicKey,
            amountXlm: bid.amountXlm,
            amountStroops: bid.amountStroops,
            transactionHash: bid.transactionHash,
            ledgerSequence: bid.ledgerSequence,
            createdAt: bid.createdAt,
          });
        } catch (e) {
          this.logger.warn(`Failed to index BidPlaced event: ${(e as Error).message}`);
        }
      }
    }

    this.lastLedger = latest;
  }

  private parseBidPlacedEvent(ev: {
    ledger: number;
    topic: string[];
    value: unknown;
  }): {
    auctionId: string;
    bidderPublicKey: string;
    amountStroops: string;
    transactionHash: string;
    ledgerSequence: number;
  } | null {
    try {
      const value = ev.value as { body?: { xdr?: string } };
      const bodyXdr = value?.body?.xdr ?? (ev as { value?: { xdr?: string } }).value?.xdr;
      if (!bodyXdr) return null;
      const ledger = ev.ledger || 0;
      return {
        auctionId: '', // Decode from event body XDR if available
        bidderPublicKey: '',
        amountStroops: '0',
        transactionHash: '',
        ledgerSequence: ledger,
      };
    } catch {
      return null;
    }
  }
}
