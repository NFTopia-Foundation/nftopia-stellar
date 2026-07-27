import axios from "axios";
import { API_CONFIG, PAGINATION } from "@/lib/config";
import type { Listing, MarketplaceFilter, ListingStatus, NFTAttribute } from "@/types/index";

/**
 * Marketplace service for fetching NFT listings.
 *
 * Communicates with the backend GraphQL API using axios.
 * Follows the same patterns as the rest of the app (e.g., auth.service.ts).
 */

const graphqlClient = axios.create({
  baseURL: API_CONFIG.graphqlUrl,
  headers: { "Content-Type": "application/json" },
});

function mapFilterToVariables(
  filter: MarketplaceFilter,
  after?: string | null,
) {
  const vars: Record<string, unknown> = {
    pagination: {
      first: PAGINATION.defaultPageSize,
      after: after ?? null,
    },
  };

  const filterObj: Record<string, unknown> = {};

  if (filter.status !== "ALL") {
    filterObj.status = filter.status;
  }
  if (filter.search) {
    filterObj.search = filter.search;
  }
  if (filter.minPrice !== null) {
    filterObj.minPrice = filter.minPrice;
  }
  if (filter.maxPrice !== null) {
    filterObj.maxPrice = filter.maxPrice;
  }
  if (filter.sortBy) {
    filterObj.sortBy = filter.sortBy;
  }

  if (Object.keys(filterObj).length > 0) {
    vars.filter = filterObj;
  }

  return vars;
}

const LISTINGS_QUERY = `
  query GetListings($pagination: PaginationInput, $filter: ListingFilterInput) {
    listings(pagination: $pagination, filter: $filter) {
      edges {
        node {
          id
          nftId
          sellerId
          price
          currency
          status
          createdAt
          expiresAt
          nft {
            id
            tokenId
            name
            description
            image
            ownerId
            collectionId
            mintedAt
            lastPrice
          }
          seller {
            id
            username
            walletAddress
            avatar
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export interface FetchListingsResult {
  listings: Listing[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  totalCount: number;
}

function mapNodeToListing(node: Record<string, unknown>): Listing {
  const nftRaw = node.nft as Record<string, unknown> | null | undefined;
  const sellerRaw = node.seller as Record<string, unknown> | null | undefined;

  return {
    id: node.id as string,
    nftId: node.nftId as string,
    sellerId: node.sellerId as string,
    price: node.price as string,
    currency: (node.currency as string) || "XLM",
    status: node.status as ListingStatus,
    createdAt: node.createdAt as string,
    expiresAt: (node.expiresAt as string) ?? null,
    nft: nftRaw
      ? {
          id: nftRaw.id as string,
          tokenId: nftRaw.tokenId as string,
          contractAddress: (nftRaw.contractAddress as string) ?? "",
          name: nftRaw.name as string,
          description: (nftRaw.description as string | null) ?? null,
          image: (nftRaw.image as string | null) ?? null,
          attributes: (nftRaw.attributes as NFTAttribute[]) ?? [],
          ownerId: nftRaw.ownerId as string,
          creatorId: (nftRaw.creatorId as string) ?? "",
          collectionId: (nftRaw.collectionId as string | null) ?? null,
          mintedAt: nftRaw.mintedAt as string,
          lastPrice: (nftRaw.lastPrice as string | null) ?? null,
        }
      : undefined,
    seller: sellerRaw
      ? {
          id: sellerRaw.id as string,
          username: (sellerRaw.username as string | null) ?? null,
          walletAddress: sellerRaw.walletAddress as string,
          avatar: (sellerRaw.avatar as string | null) ?? null,
        }
      : undefined,
  };
}

export async function fetchMarketplaceListings(
  filter: MarketplaceFilter,
  after?: string | null,
): Promise<FetchListingsResult> {
  const variables = mapFilterToVariables(filter, after);

  const { data: response } = await graphqlClient.post<{
    data?: {
      listings?: {
        edges?: Array<{ node: Record<string, unknown>; cursor: string }>;
        pageInfo?: { hasNextPage: boolean; startCursor: string | null; endCursor: string | null };
        totalCount?: number;
      };
    };
    errors?: Array<{ message: string }>;
  }>("", { query: LISTINGS_QUERY, variables });

  if (response.errors && response.errors.length > 0) {
    throw new Error(response.errors[0]?.message ?? "GraphQL error");
  }

  const connection = response.data?.listings;

  return {
    listings: (connection?.edges ?? []).map((e) => mapNodeToListing(e.node)),
    pageInfo: {
      hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
      endCursor: connection?.pageInfo?.endCursor ?? null,
    },
    totalCount: connection?.totalCount ?? 0,
  };
}
