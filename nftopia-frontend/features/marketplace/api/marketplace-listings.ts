import type {
  GetListingsQuery,
  GetListingsQueryVariables,
  ListingFilterInput,
  ListingStatus,
} from "@/hooks/graphql/generated";
import { getApolloClient } from "@/lib/graphql/client";
import { GET_LISTINGS_QUERY } from "@/lib/graphql/queries/listing.queries";

/**
 * Cursor-paginated marketplace listings.
 *
 * Reuses the gateway's `listings(pagination, filter)` connection, whose
 * `PaginationInput` is `{ first, after }`: the marketplace store keeps that
 * `after` cursor and appends page by page. Kept as a plain async function (not
 * a `useQuery` hook) so the store owns pagination state and tests can inject a
 * fake loader.
 */

/** One marketplace row as the grid renders it. */
export interface MarketplaceListing {
  /** Listing id — used to de-duplicate rows across pages. */
  id: string;
  nftId: string;
  name: string;
  image: string | null;
  tokenId: string | null;
  price: string;
  currency: string;
  status: ListingStatus | string;
  /** Seller username, falling back to the wallet address. */
  seller: string;
  /** Cursor of this row; the next page is requested `after` it. */
  cursor: string;
}

export interface MarketplaceListingsPage {
  items: MarketplaceListing[];
  nextCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
}

/** Server-side filters; mirrors `ListingFilterInput`. */
export interface MarketplaceListingsFilter {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  status?: ListingStatus;
}

export interface MarketplaceListingsPageParams {
  /** Cursor to fetch after; `null` asks for the first page. */
  cursor: string | null;
  limit: number;
  filter?: MarketplaceListingsFilter;
}

type ListingEdge = GetListingsQuery["listings"]["edges"][number];

function toMarketplaceListing(edge: ListingEdge): MarketplaceListing {
  const node = edge.node;
  const seller = node.seller;
  return {
    id: node.id,
    nftId: node.nftId,
    name: node.nft?.name ?? "Untitled NFT",
    image: node.nft?.image ?? null,
    tokenId: node.nft?.tokenId ?? null,
    price: node.price,
    currency: node.currency,
    status: node.status,
    seller: seller?.username ?? seller?.walletAddress ?? node.sellerId,
    cursor: edge.cursor,
  };
}

/**
 * Loads one page of marketplace listings.
 *
 * `fetchPolicy: "network-only"` is deliberate: infinite scroll must not be
 * served a stale cache entry, otherwise the same page can come back twice (the
 * store also de-duplicates by id as a second line of defence).
 */
export async function fetchMarketplaceListingsPage(
  params: MarketplaceListingsPageParams,
): Promise<MarketplaceListingsPage> {
  const { cursor, limit, filter } = params;
  const client = getApolloClient();

  const variables: GetListingsQueryVariables = {
    pagination: { first: limit, after: cursor ?? undefined },
    filter: filter as ListingFilterInput | undefined,
  };

  const { data } = await client.query<
    GetListingsQuery,
    GetListingsQueryVariables
  >({
    query: GET_LISTINGS_QUERY,
    variables,
    fetchPolicy: "network-only",
  });

  const connection = data?.listings;
  const edges = connection?.edges ?? [];
  const items = edges.map(toMarketplaceListing);

  return {
    items,
    nextCursor: connection?.pageInfo?.endCursor ?? null,
    hasNextPage: Boolean(connection?.pageInfo?.hasNextPage),
    totalCount: connection?.totalCount ?? items.length,
  };
}
