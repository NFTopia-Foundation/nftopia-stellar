import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Index, MeiliSearch } from 'meilisearch';
import { Nft } from '../modules/nft/entities/nft.entity';
import { User } from '../users/user.entity';
import {
  SEARCH_CLIENT,
  SEARCH_NFT_INDEX,
  SEARCH_PROFILE_INDEX,
} from './search.constants';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  SearchNftDocument,
  SearchProfileDocument,
  SearchResults,
} from './interfaces/search-document.interface';

type SearchResponsePayload = {
  query: string;
  type: 'all' | 'nfts' | 'profiles';
  page: number;
  limit: number;
  nfts?: SearchResults<SearchNftDocument>;
  profiles?: SearchResults<SearchProfileDocument>;
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private settingsPromise?: Promise<void>;

  constructor(
    @Inject(SEARCH_CLIENT)
    private readonly client: MeiliSearch,
  ) {}

  async indexNft(nft: Nft): Promise<void> {
    await this.ensureSettings();
    await this.nftIndex().addDocuments([this.toNftDocument(nft)]);
  }

  async removeNft(id: string): Promise<void> {
    await this.ensureSettings();
    await this.nftIndex().deleteDocument(id);
  }

  async indexUser(user: User): Promise<void> {
    await this.ensureSettings();
    await this.profileIndex().addDocuments([this.toProfileDocument(user)]);
  }

  async search(query: SearchQueryDto): Promise<SearchResponsePayload> {
    await this.ensureSettings();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const searchTerm = query.q?.trim() ?? '';
    const type = query.type ?? 'all';

    const payload: SearchResponsePayload = {
      query: searchTerm,
      type,
      page,
      limit,
    };

    if (type === 'all' || type === 'nfts') {
      const nftResult = await this.nftIndex().search<SearchNftDocument>(
        searchTerm,
        {
          page,
          hitsPerPage: limit,
          filter: this.buildNftFilters(query),
          sort: this.buildSort(query, 'nfts'),
          facets: ['collectionId', 'ownerId', 'creatorId', 'attributeFacets'],
        },
      );

      payload.nfts = this.mapResult(nftResult, page, limit);
    }

    if (type === 'all' || type === 'profiles') {
      const profileResult =
        await this.profileIndex().search<SearchProfileDocument>(searchTerm, {
          page,
          hitsPerPage: limit,
          sort: this.buildSort(query, 'profiles'),
        });

      payload.profiles = this.mapResult(profileResult, page, limit);
    }

    return payload;
  }

  private nftIndex(): Index<SearchNftDocument> {
    return this.client.index<SearchNftDocument>(SEARCH_NFT_INDEX);
  }

  private profileIndex(): Index<SearchProfileDocument> {
    return this.client.index<SearchProfileDocument>(SEARCH_PROFILE_INDEX);
  }

  private async ensureSettings(): Promise<void> {
    if (!this.settingsPromise) {
      this.settingsPromise = this.configureIndexes();
    }

    await this.settingsPromise;
  }

  private async configureIndexes(): Promise<void> {
    const nftIndex = this.nftIndex();
    const profileIndex = this.profileIndex();

    try {
      await Promise.all([
        nftIndex.updateSearchableAttributes([
          'name',
          'description',
          'tokenId',
          'attributes.traitType',
          'attributes.value',
        ]),
        nftIndex.updateFilterableAttributes([
          'collectionId',
          'ownerId',
          'creatorId',
          'attributeFacets',
          'isBurned',
        ]),
        nftIndex.updateSortableAttributes([
          'createdAt',
          'updatedAt',
          'mintedAt',
          'lastPrice',
        ]),
        profileIndex.updateSearchableAttributes([
          'username',
          'bio',
          'address',
          'walletAddress',
        ]),
        profileIndex.updateSortableAttributes(['username']),
      ]);
    } catch (error) {
      this.logger.error('Failed to configure MeiliSearch indexes', error);
      throw error;
    }
  }

  private buildNftFilters(query: SearchQueryDto): string[] | undefined {
    const filters: string[] = ['isBurned = false'];

    if (query.collectionId) {
      filters.push(`collectionId = "${query.collectionId}"`);
    }

    if (query.ownerId) {
      filters.push(`ownerId = "${query.ownerId}"`);
    }

    if (query.creatorId) {
      filters.push(`creatorId = "${query.creatorId}"`);
    }

    if (query.traitType && query.traitValue) {
      filters.push(
        `attributeFacets = "${this.toAttributeFacet(query.traitType, query.traitValue)}"`,
      );
    }

    return filters.length ? filters : undefined;
  }

  private buildSort(
    query: SearchQueryDto,
    entity: 'nfts' | 'profiles',
  ): string[] | undefined {
    if (!query.sort) {
      return entity === 'nfts' ? ['createdAt:desc'] : undefined;
    }

    if (entity === 'profiles' && !query.sort.startsWith('username:')) {
      return undefined;
    }

    if (entity === 'nfts' && query.sort.startsWith('username:')) {
      return ['createdAt:desc'];
    }

    return [query.sort];
  }

  private mapResult<TDocument extends object>(
    result: {
      hits: TDocument[];
      estimatedTotalHits?: number;
      totalHits?: number;
      facetDistribution?: Record<string, Record<string, number>>;
    },
    page: number,
    limit: number,
  ): SearchResults<TDocument> {
    const totalHits = result.estimatedTotalHits ?? result.totalHits ?? 0;

    return {
      hits: result.hits,
      estimatedTotalHits: totalHits,
      page,
      hitsPerPage: limit,
      totalPages: totalHits > 0 ? Math.ceil(totalHits / limit) : 0,
      ...(result.facetDistribution
        ? { facetDistribution: result.facetDistribution }
        : {}),
    };
  }

  private toNftDocument(nft: Nft): SearchNftDocument {
    const attributes = (nft.attributes ?? []).map((attribute) => ({
      traitType: attribute.traitType,
      value: attribute.value,
      ...(attribute.displayType ? { displayType: attribute.displayType } : {}),
    }));

    return {
      id: nft.id,
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      name: nft.name,
      description: nft.description ?? null,
      imageUrl: nft.imageUrl ?? null,
      animationUrl: nft.animationUrl ?? null,
      externalUrl: nft.externalUrl ?? null,
      ownerId: nft.ownerId,
      creatorId: nft.creatorId,
      collectionId: nft.collectionId ?? null,
      lastPrice:
        nft.lastPrice !== undefined && nft.lastPrice !== null
          ? Number(nft.lastPrice)
          : null,
      isBurned: nft.isBurned,
      mintedAt: nft.mintedAt?.toISOString() ?? null,
      createdAt: nft.createdAt.toISOString(),
      updatedAt: nft.updatedAt.toISOString(),
      attributes,
      attributeFacets: attributes.map((attribute) =>
        this.toAttributeFacet(attribute.traitType, attribute.value),
      ),
      entityType: 'nft',
    };
  }

  private toProfileDocument(user: User): SearchProfileDocument {
    return {
      id: user.id,
      address: user.address ?? null,
      username: user.username ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      walletAddress: user.walletAddress ?? null,
      walletPublicKey: user.walletPublicKey ?? null,
      walletProvider: user.walletProvider ?? null,
      entityType: 'profile',
    };
  }

  private toAttributeFacet(traitType: string, value: string): string {
    return `${traitType}:${value}`;
  }

  static createClient(configService: ConfigService): MeiliSearch {
    return new MeiliSearch({
      host:
        configService.get<string>('MEILISEARCH_HOST') ??
        'http://127.0.0.1:7700',
      apiKey: configService.get<string>('MEILISEARCH_API_KEY'),
    });
  }
}
