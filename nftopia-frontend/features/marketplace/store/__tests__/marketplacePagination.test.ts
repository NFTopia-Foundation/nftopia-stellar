import {
  DEFAULT_MARKETPLACE_PAGE_SIZE,
  useMarketplaceStore,
} from "@/features/marketplace/store/marketplaceStore";
import type {
  MarketplaceListing,
  MarketplaceListingsPage,
} from "@/features/marketplace/api/marketplace-listings";

function listing(id: string): MarketplaceListing {
  return {
    id,
    nftId: `nft-${id}`,
    name: `NFT ${id}`,
    image: null,
    tokenId: id,
    price: "10",
    currency: "XLM",
    status: "ACTIVE",
    seller: "seller-1",
    cursor: `cursor-${id}`,
  };
}

function page(
  ids: string[],
  nextCursor: string | null,
  hasNextPage: boolean,
  totalCount: number,
): MarketplaceListingsPage {
  return { items: ids.map(listing), nextCursor, hasNextPage, totalCount };
}

/** A loader whose resolution is controlled by the test. */
function deferredLoader() {
  const calls: Array<{ cursor: string | null; limit: number }> = [];
  let settle: {
    resolve: (value: MarketplaceListingsPage) => void;
    reject: (reason?: unknown) => void;
  } | null = null;

  const loader = jest.fn(
    (params: { cursor: string | null; limit: number }) => {
      calls.push({ cursor: params.cursor, limit: params.limit });
      return new Promise<MarketplaceListingsPage>((resolve, reject) => {
        settle = { resolve, reject };
      });
    },
  );

  return {
    loader,
    calls,
    resolvePage: (value: MarketplaceListingsPage) => settle?.resolve(value),
    rejectPage: (reason?: unknown) => settle?.reject(reason),
  };
}

describe("marketplace store cursor pagination", () => {
  const store = () => useMarketplaceStore.getState();

  beforeEach(() => {
    useMarketplaceStore.setState({
      items: [],
      cursor: null,
      hasNextPage: false,
      totalCount: 0,
      isLoadingMore: false,
      isLoadingFirstPage: false,
      paginationError: null,
      pageSize: DEFAULT_MARKETPLACE_PAGE_SIZE,
      paginationFilter: {},
      pageLoader: null,
    });
  });

  it("loads the first page, cursor and total count", async () => {
    const loader = jest
      .fn()
      .mockResolvedValue(page(["1", "2"], "cursor-2", true, 125));
    store().configurePagination({ loader });

    await store().loadFirstPage();

    expect(loader).toHaveBeenCalledWith({
      cursor: null,
      limit: DEFAULT_MARKETPLACE_PAGE_SIZE,
      filter: {},
    });
    expect(store().items.map((item) => item.id)).toEqual(["1", "2"]);
    expect(store().cursor).toBe("cursor-2");
    expect(store().hasNextPage).toBe(true);
    expect(store().totalCount).toBe(125);
    expect(store().isLoadingFirstPage).toBe(false);
  });

  it("appends the next page instead of replacing what is loaded", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce(page(["1", "2"], "cursor-2", true, 4))
      .mockResolvedValueOnce(page(["3", "4"], "cursor-4", false, 4));
    store().configurePagination({ loader });

    await store().loadFirstPage();
    await store().loadMore();

    expect(loader).toHaveBeenLastCalledWith({
      cursor: "cursor-2",
      limit: DEFAULT_MARKETPLACE_PAGE_SIZE,
      filter: {},
    });
    expect(store().items.map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
    expect(store().totalCount).toBe(4);
    expect(store().hasNextPage).toBe(false);
  });

  it("never duplicates rows when a page overlaps the previous one", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce(page(["1", "2"], "cursor-2", true, 3))
      .mockResolvedValueOnce(page(["2", "3"], "cursor-3", false, 3));
    store().configurePagination({ loader });

    await store().loadFirstPage();
    await store().loadMore();

    expect(store().items.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("does not start a second request while one is in flight", async () => {
    const { loader, calls, resolvePage } = deferredLoader();
    store().configurePagination({ loader });
    useMarketplaceStore.setState({
      items: [listing("1")],
      cursor: "cursor-1",
      hasNextPage: true,
    });

    const first = store().loadMore();
    await store().loadMore();

    expect(calls).toHaveLength(1);
    expect(store().isLoadingMore).toBe(true);

    resolvePage(page(["2"], null, false, 2));
    await first;

    expect(store().items.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("does nothing when there is no next page", async () => {
    const loader = jest.fn();
    store().configurePagination({ loader });

    await store().loadMore();

    expect(loader).not.toHaveBeenCalled();
  });

  it("records a failed page and retries the same cursor", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce(page(["1"], "cursor-1", true, 3))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(page(["2"], "cursor-2", false, 3));
    store().configurePagination({ loader });

    await store().loadFirstPage();
    await store().loadMore();

    expect(store().paginationError).toBe("network down");
    expect(store().isLoadingMore).toBe(false);
    // The cursor is untouched, so a retry asks for the same page again.
    expect(store().cursor).toBe("cursor-1");

    await store().loadMore();

    expect(store().paginationError).toBeNull();
    expect(store().items.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("resets every page when the server-side filter changes", async () => {
    const loader = jest
      .fn()
      .mockResolvedValue(page(["1"], "cursor-1", true, 9));
    store().configurePagination({ loader });

    await store().loadFirstPage();
    store().setPaginationFilter({ search: "dragon" });

    expect(store().items).toEqual([]);
    expect(store().cursor).toBeNull();
    expect(store().hasNextPage).toBe(false);
    expect(store().totalCount).toBe(0);
    expect(store().paginationFilter).toEqual({ search: "dragon" });
  });

  it("resets pagination when local filters change, keeping the loader", async () => {
    const loader = jest.fn().mockResolvedValue(page(["1"], "c1", true, 5));
    store().configurePagination({ loader });
    await store().loadFirstPage();

    store().setFilters({ status: "sold" });

    expect(store().items).toEqual([]);
    expect(store().cursor).toBeNull();
    expect(store().pageLoader).toBe(loader);
    expect(store().filters.status).toBe("sold");
  });

  it("resetPagination keeps the transport so the list can reload", () => {
    const loader = jest.fn();
    store().configurePagination({ loader, pageSize: 5 });

    store().resetPagination();

    expect(store().pageLoader).toBe(loader);
    expect(store().pageSize).toBe(5);
    expect(store().items).toEqual([]);
  });
});
