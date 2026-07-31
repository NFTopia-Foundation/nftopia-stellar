import type { GetListingsQuery } from "@/hooks/graphql/generated";
import { ListingStatus } from "@/hooks/graphql/generated";
import { mergeListingConnection } from "@/lib/services/marketplace-pagination";

type ListingEdge = GetListingsQuery["listings"]["edges"][number];

function listingEdge(id: string, cursor = `cursor-${id}`): ListingEdge {
  return {
    __typename: "ListingEdge",
    cursor,
    node: {
      __typename: "Listing",
      id,
      nftId: `nft-${id}`,
      sellerId: `seller-${id}`,
      price: "10",
      currency: "XLM",
      status: ListingStatus.Active,
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      nft: {
        __typename: "NFT",
        id: `nft-${id}`,
        name: `NFT ${id}`,
        image: null,
        tokenId: id,
      },
      seller: {
        __typename: "User",
        id: `seller-${id}`,
        username: `seller-${id}`,
        walletAddress: null,
      },
    },
  };
}

function listingsQuery(
  ids: string[],
  overrides: Partial<GetListingsQuery["listings"]> = {},
): GetListingsQuery {
  return {
    __typename: "Query",
    listings: {
      __typename: "ListingConnection",
      totalCount: ids.length,
      edges: ids.map((id) => listingEdge(id)),
      pageInfo: {
        __typename: "PageInfo",
        hasNextPage: false,
        startCursor: ids.length ? `cursor-${ids[0]}` : null,
        endCursor: ids.length ? `cursor-${ids[ids.length - 1]}` : null,
      },
      ...overrides,
    },
  };
}

describe("mergeListingConnection", () => {
  it("appends new listing edges and keeps incoming pagination metadata", () => {
    const previous = listingsQuery(["1", "2"], {
      totalCount: 4,
      pageInfo: {
        __typename: "PageInfo",
        hasNextPage: true,
        startCursor: "cursor-1",
        endCursor: "cursor-2",
      },
    });
    const incoming = listingsQuery(["3", "4"], {
      totalCount: 4,
      pageInfo: {
        __typename: "PageInfo",
        hasNextPage: false,
        startCursor: "cursor-3",
        endCursor: "cursor-4",
      },
    });

    const result = mergeListingConnection(previous, incoming);

    expect(result.listings.edges.map((edge) => edge.node.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(result.listings.totalCount).toBe(4);
    expect(result.listings.pageInfo.hasNextPage).toBe(false);
    expect(result.listings.pageInfo.endCursor).toBe("cursor-4");
  });

  it("does not append duplicate listing ids when a page overlaps", () => {
    const result = mergeListingConnection(
      listingsQuery(["1", "2"]),
      listingsQuery(["2", "3"]),
    );

    expect(result.listings.edges.map((edge) => edge.node.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("returns the previous result when fetchMore has no payload", () => {
    const previous = listingsQuery(["1"]);

    expect(mergeListingConnection(previous, undefined)).toBe(previous);
  });
});
