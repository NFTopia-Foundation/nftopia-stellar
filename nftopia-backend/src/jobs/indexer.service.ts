import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Horizon } from 'stellar-sdk';
import { SystemSettings } from './system-settings.entity';
import { StellarNft } from '../nft/entities/stellar-nft.entity';

const LAST_LEDGER_KEY = 'last_ingested_ledger';
const HORIZON_URL = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const FACTORY_CONTRACT = process.env.FACTORY_CONTRACT_ID ?? '';
const MARKETPLACE_CONTRACT = process.env.MARKETPLACE_CONTRACT_ID ?? '';

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private running = false;

  constructor(
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
    @InjectRepository(StellarNft)
    private readonly nftRepo: Repository<StellarNft>,
  ) {}

  onModuleInit() {
    void this.startIngestion();
  }

  async startIngestion(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.log('Stellar ledger ingestion daemon started');

    while (this.running) {
      try {
        await this.ingestNext();
      } catch (err) {
        this.logger.error('Ingestion error', err);
        await this.sleep(5000);
      }
    }
  }

  stopIngestion(): void {
    this.running = false;
  }

  private async ingestNext(): Promise<void> {
    const lastLedger = await this.getLastIngestedLedger();
    const server = new Horizon.Server(HORIZON_URL);

    const contracts = [FACTORY_CONTRACT, MARKETPLACE_CONTRACT].filter(Boolean);
    if (contracts.length === 0) {
      await this.sleep(30000);
      return;
    }

    let maxLedger = lastLedger;

    for (const contractId of contracts) {
      try {
        const txPage = await server
          .transactions()
          .forAccount(contractId)
          .cursor(lastLedger > 0 ? String(lastLedger) : 'now')
          .order('asc')
          .limit(50)
          .call();

        for (const tx of txPage.records) {
          const ledger = tx.ledger_attr ?? 0;
          await this.processTransaction(tx, contractId);
          if (ledger > maxLedger) maxLedger = ledger;
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          this.logger.warn('Horizon rate limit hit, backing off');
          await this.sleep(10000);
          return;
        }
        this.logger.warn(`Failed to fetch txs for ${contractId}: ${String(err)}`);
      }
    }

    if (maxLedger > lastLedger) {
      await this.setLastIngestedLedger(maxLedger);
    }

    await this.sleep(6000); // ~1 ledger interval
  }

  private async processTransaction(
    tx: Horizon.ServerApi.TransactionRecord,
    contractId: string,
  ): Promise<void> {
    const memo = tx.memo ?? '';
    const eventType = this.parseEventType(memo);

    if (!eventType) return;

    this.logger.debug(`Processing ${eventType} event from contract ${contractId}`);

    switch (eventType) {
      case 'mint':
        await this.handleMint(tx, contractId);
        break;
      case 'sale':
        await this.handleSale(tx, contractId);
        break;
      case 'transfer':
        await this.handleTransfer(tx, contractId);
        break;
    }
  }

  private parseEventType(memo: string): 'mint' | 'sale' | 'transfer' | null {
    const lower = memo.toLowerCase();
    if (lower.includes('mint')) return 'mint';
    if (lower.includes('sale') || lower.includes('execute')) return 'sale';
    if (lower.includes('transfer')) return 'transfer';
    return null;
  }

  private async handleMint(
    tx: Horizon.ServerApi.TransactionRecord,
    contractId: string,
  ): Promise<void> {
    const tokenId = this.extractTokenId(tx.memo ?? '');
    if (!tokenId) return;

    const existing = await this.nftRepo.findOne({
      where: { contractId, tokenId },
    });
    if (existing) return;

    const nft = this.nftRepo.create({
      contractId,
      tokenId,
      owner: tx.source_account,
      mintedAt: new Date(tx.created_at),
    });
    await this.nftRepo.save(nft);
    this.logger.log(`Minted NFT ${contractId}:${tokenId}`);
  }

  private async handleSale(
    tx: Horizon.ServerApi.TransactionRecord,
    contractId: string,
  ): Promise<void> {
    const tokenId = this.extractTokenId(tx.memo ?? '');
    if (!tokenId) return;

    const nft = await this.nftRepo.findOne({ where: { contractId, tokenId } });
    if (!nft) return;

    nft.salesCount = (nft.salesCount ?? 0) + 1;
    await this.nftRepo.save(nft);
    this.logger.log(`Sale recorded for NFT ${contractId}:${tokenId}`);
  }

  private async handleTransfer(
    tx: Horizon.ServerApi.TransactionRecord,
    contractId: string,
  ): Promise<void> {
    const tokenId = this.extractTokenId(tx.memo ?? '');
    if (!tokenId) return;

    const nft = await this.nftRepo.findOne({ where: { contractId, tokenId } });
    if (!nft) return;

    nft.owner = tx.source_account;
    await this.nftRepo.save(nft);
    this.logger.log(`Transfer recorded for NFT ${contractId}:${tokenId}`);
  }

  private extractTokenId(memo: string): string | null {
    const match = memo.match(/token[_-]?id[:\s=]+([A-Za-z0-9]+)/i);
    return match ? match[1] : null;
  }

  private async getLastIngestedLedger(): Promise<number> {
    const setting = await this.settingsRepo.findOne({
      where: { key: LAST_LEDGER_KEY },
    });
    return setting ? parseInt(setting.value, 10) : 0;
  }

  private async setLastIngestedLedger(ledger: number): Promise<void> {
    await this.settingsRepo.save({ key: LAST_LEDGER_KEY, value: String(ledger) });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
