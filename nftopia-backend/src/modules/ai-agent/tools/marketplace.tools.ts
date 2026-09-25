import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { NftService } from '../../nft/nft.service';
import type { ListingService } from '../../listing/listing.service';
import type { CollectionService } from '../../collection/collection.service';
import type { OrderService } from '../../order/order.service';
import type { AuctionService } from '../../auction/auction.service';
import { ListingStatus } from '../../listing/interfaces/listing.interface';
import { OrderStatus, OrderType } from '../../order/dto/create-order.dto';
import { AuctionStatus } from '../../auction/interfaces/auction.interface';

/**
 * The exact tool names this builder is allowed to return — registered as
 * this set's ownership in tool-set.registry.ts. If a tool here is renamed
 * or a new tool is added without updating this list, resolveToolSet()
 * throws instead of silently exposing it under the 'marketplace-assistant'
 * name. Keep this in sync with the `name` passed to each betaZodTool below.
 */
export const MARKETPLACE_TOOL_NAMES = [
  'search_nfts',
  'get_nft',
  'search_listings',
  'get_listing',
  'search_collections',
  'get_collection',
  'get_collection_stats',
  'get_top_collections',
  'search_orders',
  'get_order',
  'search_auctions',
  'get_auction',
  'get_auction_bids',
] as const;

export interface MarketplaceToolsDeps {
  nftService: NftService;
  listingService: ListingService;
  collectionService: CollectionService;
  orderService: OrderService;
  auctionService: AuctionService;
  /**
   * The authenticated caller, from the JWT — never from tool input.
   * search_orders/get_order use it to scope results server-side so the
   * model can't read another user's orders by supplying a different id or
   * filter (#488).
   */
  userId: string;
  toolLogger?: import('./tool-set.types').ToolLogger;
}

/**
 * Read-only tool surface for the marketplace assistant. Every tool wraps an
 * existing service method directly (in-process) so the agent shares the same
 * DB connection, entities, and business rules as the REST/GraphQL surfaces.
 */
export function buildMarketplaceTools(deps: MarketplaceToolsDeps) {
  const {
    nftService,
    listingService,
    collectionService,
    orderService,
    auctionService,
    userId,
  } = deps;

  const createTool = <T extends z.ZodTypeAny>(config: {
    name: string;
    description: string;
    inputSchema: T;
    run: (input: z.infer<T>) => Promise<string>;
  }) => {
    const originalRun = config.run;
    config.run = async (input: z.infer<T>) => {
      const start = Date.now();
      try {
        const res = await originalRun(input);
        if (deps.toolLogger) {
          const resStr = typeof res === 'string' ? res : JSON.stringify(res);
          const summary =
            resStr.substring(0, 100) + (resStr.length > 100 ? '...' : '');
          deps.toolLogger(
            config.name,
            input as Record<string, unknown>,
            summary,
            Date.now() - start,
          );
        }
        return res;
      } catch (err) {
        if (deps.toolLogger) {
          deps.toolLogger(
            config.name,
            input as Record<string, unknown>,
            `Error: ${(err as Error).message}`,
            Date.now() - start,
          );
        }
        throw err;
      }
    };
    return betaZodTool(config);
  };

  const searchNfts = createTool({
    name: 'search_nfts',
    description:
      'Search NFTs by owner, creator, collection, or free-text title/description match. Returns a paginated list.',
    inputSchema: z.object({
      search: z
        .string()
        .optional()
        .describe('Free-text search on title/description'),
      ownerId: z.string().uuid().optional(),
      creatorId: z.string().uuid().optional(),
      collectionId: z.string().uuid().optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (input) => {
      const result = await nftService.findAll({
        search: input.search,
        ownerId: input.ownerId,
        creatorId: input.creatorId,
        collectionId: input.collectionId,
        page: input.page,
        limit: input.limit,
      });
      return JSON.stringify(result);
    },
  });

  const getNft = createTool({
    name: 'get_nft',
    description: 'Get full details for a single NFT by its id.',
    inputSchema: z.object({ id: z.string().uuid() }),
    run: async (input) => {
      const nft = await nftService.findById(input.id);
      return JSON.stringify(nft);
    },
  });

  const searchListings = createTool({
    name: 'search_listings',
    description:
      'Search marketplace listings by status, seller, or the NFT contract/token they list. Defaults to active listings.',
    inputSchema: z.object({
      status: z.nativeEnum(ListingStatus).optional(),
      sellerId: z.string().optional(),
      nftContractId: z.string().optional(),
      nftTokenId: z.string().optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (input) => {
      const result = await listingService.findAll(input);
      return JSON.stringify(result);
    },
  });

  const getListing = createTool({
    name: 'get_listing',
    description:
      'Get full details for a single listing by its id, including price and status.',
    inputSchema: z.object({ id: z.string() }),
    run: async (input) => {
      const listing = await listingService.findOne(input.id);
      return JSON.stringify(listing);
    },
  });

  const searchCollections = createTool({
    name: 'search_collections',
    description: 'Search NFT collections by creator or free-text name match.',
    inputSchema: z.object({
      search: z.string().optional(),
      creatorId: z.string().uuid().optional(),
      verifiedOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (input) => {
      const result = await collectionService.findAll({
        search: input.search,
        creatorId: input.creatorId,
        verifiedOnly: input.verifiedOnly,
        first: input.limit,
      });
      return JSON.stringify(result);
    },
  });

  const getCollection = createTool({
    name: 'get_collection',
    description: 'Get full details for a single collection by its id.',
    inputSchema: z.object({ id: z.string().uuid() }),
    run: async (input) => {
      const collection = await collectionService.findById(input.id);
      return JSON.stringify(collection);
    },
  });

  const getCollectionStats = createTool({
    name: 'get_collection_stats',
    description:
      'Get aggregate stats (floor price, total volume, supply, owner count) for a collection.',
    inputSchema: z.object({ id: z.string().uuid() }),
    run: async (input) => {
      const stats = await collectionService.getStats(input.id);
      return JSON.stringify(stats);
    },
  });

  const getTopCollections = createTool({
    name: 'get_top_collections',
    description: 'Get the top collections ranked by trading volume.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (input) => {
      const collections = await collectionService.getTopCollections(
        input.limit ?? 10,
      );
      return JSON.stringify(collections);
    },
  });

  const searchOrders = createTool({
    name: 'search_orders',
    description:
      "Search the caller's own past orders (purchases or sales), optionally filtered by NFT, type, status, or date range. Always scoped to the authenticated user as either buyer or seller — never returns other users' orders, regardless of what's asked.",
    inputSchema: z.object({
      nftId: z.string().uuid().optional(),
      type: z.nativeEnum(OrderType).optional(),
      status: z.nativeEnum(OrderStatus).optional(),
      fromDate: z.string().datetime().optional(),
      toDate: z.string().datetime().optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (input) => {
      const result = await orderService.findAllForUser(
        userId,
        {
          nftId: input.nftId,
          type: input.type,
          status: input.status,
          fromDate: input.fromDate,
          toDate: input.toDate,
        },
        { page: input.page, limit: input.limit },
      );
      return JSON.stringify(result);
    },
  });

  const getOrder = createTool({
    name: 'get_order',
    description:
      "Get full details for a single order by its id — but only if the caller is that order's buyer or seller. Use this to check the status of a specific order the caller has already mentioned.",
    inputSchema: z.object({ id: z.string().uuid() }),
    run: async (input) => {
      const order = await orderService.findOneForUser(userId, input.id);
      return JSON.stringify(order);
    },
  });

  const searchAuctions = createTool({
    name: 'search_auctions',
    description:
      'Search marketplace auctions by status, seller, or the NFT contract/token being auctioned. Defaults to active (non-expired) auctions. Does not include bid history — use get_auction_bids for that.',
    inputSchema: z.object({
      status: z.nativeEnum(AuctionStatus).optional(),
      sellerId: z.string().optional(),
      nftContractId: z.string().optional(),
      nftTokenId: z.string().optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (input) => {
      const result = await auctionService.findAll(input);
      return JSON.stringify(result);
    },
  });

  const getAuction = createTool({
    name: 'get_auction',
    description:
      "Get full details for a single auction by its id (current price, reserve, start/end time, status). Does NOT include bid history or the current highest bidder — call get_auction_bids for that; don't assume bid state from this alone.",
    inputSchema: z.object({ id: z.string() }),
    run: async (input) => {
      const auction = await auctionService.findOne(input.id);
      return JSON.stringify(auction);
    },
  });

  const getAuctionBids = createTool({
    name: 'get_auction_bids',
    description:
      'Get the full bid history for an auction, most recent first — including the current highest bid. Call this whenever a question depends on actual bid activity (e.g. "what is the highest bid", "has anyone bid on this"); get_auction alone is not enough to answer those.',
    inputSchema: z.object({ auctionId: z.string() }),
    run: async (input) => {
      const bids = await auctionService.getBids(input.auctionId);
      return JSON.stringify(bids);
    },
  });

  return [
    searchNfts,
    getNft,
    searchListings,
    getListing,
    searchCollections,
    getCollection,
    getCollectionStats,
    getTopCollections,
    searchOrders,
    getOrder,
    searchAuctions,
    getAuction,
    getAuctionBids,
  ];
}
