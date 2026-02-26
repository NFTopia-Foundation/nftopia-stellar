import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';
import { StellarNft } from '../nft/entities/stellar-nft.entity';
import { User } from '../users/user.entity';

export const MEILI_CLIENT = 'MEILI_CLIENT';

export type SearchType = 'nfts' | 'users' | 'all';

export interface SearchParams {
  q: string;
  type?: SearchType;
  contractId?: string;
  owner?: string;
  filter?: string;
  sort?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  nfts?: { hits: unknown[]; estimatedTotalHits?: number };
  users?: { hits: unknown[]; estimatedTotalHits?: number };
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly NFT_INDEX = 'nfts';
  private readonly USER_INDEX = 'users';
  private client: MeiliSearch;

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(MEILI_CLIENT)
    injectedClient?: MeiliSearch,
  ) {
    this.client = injectedClient ?? new MeiliSearch({
      host: this.config.get<string>('MEILI_HOST', 'http://localhost:7700'),
      apiKey: this.config.get<string>('MEILI_API_KEY'),
    });
  }

  async onModuleInit() {
    try {
      await this.ensureIndices();
    } catch (e) {
      this.logger.warn(`Search indices setup skipped or failed: ${(e as Error).message}`);
    }
  }

  async ensureIndices() {
    const nftIndex = this.client.index(this.NFT_INDEX);
    await nftIndex.updateSettings({
      searchableAttributes: ['name', 'description', 'attributes', 'contractId', 'owner'],
      filterableAttributes: ['contractId', 'owner', 'attributes'],
      sortableAttributes: ['mintedAt', 'views', 'volume'],
    });

    const userIndex = this.client.index(this.USER_INDEX);
    await userIndex.updateSettings({
      searchableAttributes: ['username', 'bio', 'address'],
      filterableAttributes: ['address'],
    });
  }

  /** Fire-and-forget: do not await in callers to avoid blocking API. */
  indexNft(nft: StellarNft): Promise<void> {
    const doc = this.nftToDocument(nft);
    return this.client
      .index(this.NFT_INDEX)
      .addDocuments([doc])
      .then(() => {})
      .catch((err) => {
        this.logger.warn(`indexNft failed: ${(err as Error).message}`);
      });
  }

  /** Fire-and-forget: do not await in callers to avoid blocking API. */
  indexUser(user: User): Promise<void> {
    const doc = this.userToDocument(user);
    return this.client
      .index(this.USER_INDEX)
      .addDocuments([doc])
      .then(() => {})
      .catch((err) => {
        this.logger.warn(`indexUser failed: ${(err as Error).message}`);
      });
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const { q, type = 'all', contractId, owner, filter, sort, limit = 20, offset = 0 } = params;
    const parts: string[] = [];
    if (contractId) parts.push(`contractId = "${contractId}"`);
    if (owner) parts.push(`owner = "${owner}"`);
    if (filter) parts.push(filter);
    const filterStr = parts.length > 0 ? parts.join(' AND ') : undefined;

    const searchOpts = { filter: filterStr, sort, limit, offset };

    if (type === 'nfts') {
      const res = await this.client.index(this.NFT_INDEX).search(q, searchOpts);
      return { nfts: { hits: res.hits, estimatedTotalHits: res.estimatedTotalHits } };
    }
    if (type === 'users') {
      const res = await this.client.index(this.USER_INDEX).search(q, searchOpts);
      return { users: { hits: res.hits, estimatedTotalHits: res.estimatedTotalHits } };
    }

    const [nftRes, userRes] = await Promise.all([
      this.client.index(this.NFT_INDEX).search(q, searchOpts),
      this.client.index(this.USER_INDEX).search(q, { ...searchOpts, filter: undefined }),
    ]);
    return {
      nfts: { hits: nftRes.hits, estimatedTotalHits: nftRes.estimatedTotalHits },
      users: { hits: userRes.hits, estimatedTotalHits: userRes.estimatedTotalHits },
    };
  }

  /** Backfill: index all NFTs from the given list (e.g. from NftService). */
  async reindexAllNfts(nfts: StellarNft[]): Promise<void> {
    if (nfts.length === 0) return;
    const docs = nfts.map((n) => this.nftToDocument(n));
    await this.client.index(this.NFT_INDEX).addDocuments(docs);
    this.logger.log(`Reindexed ${nfts.length} NFTs.`);
  }

  private nftToDocument(nft: StellarNft): Record<string, unknown> {
    const meta = nft.metadata;
    const id = `${nft.contractId}:${nft.tokenId}`;
    return {
      id,
      contractId: nft.contractId,
      tokenId: nft.tokenId,
      owner: nft.owner,
      name: meta?.name ?? null,
      description: meta?.description ?? null,
      image: meta?.image ?? null,
      attributes: meta?.attributes ?? null,
      views: Number(nft.views),
      volume: Number(nft.volume),
      mintedAt: nft.mintedAt ? new Date(nft.mintedAt).getTime() : null,
    };
  }

  private userToDocument(user: User): Record<string, unknown> {
    return {
      id: user.address,
      address: user.address,
      username: user.username ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  }
}
