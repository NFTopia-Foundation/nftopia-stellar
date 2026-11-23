import {
  MAX_RECENTLY_VIEWED,
  useRecentlyViewedStore,
} from "@/lib/stores/recently-viewed-store";

describe("recently viewed store", () => {
  beforeEach(() => {
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("adds a viewed NFT to the front of the list", () => {
    useRecentlyViewedStore.getState().trackView("nft-1");

    const items = useRecentlyViewedStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].nftId).toBe("nft-1");
    expect(typeof items[0].viewedAt).toBe("number");
  });

  it("moves a re-viewed NFT to the front without duplicating it", () => {
    const store = useRecentlyViewedStore.getState();
    store.trackView("nft-1");
    store.trackView("nft-2");
    store.trackView("nft-3");
    store.trackView("nft-1");

    const items = useRecentlyViewedStore.getState().items;
    expect(items.map((item) => item.nftId)).toEqual(["nft-1", "nft-3", "nft-2"]);
    expect(items.filter((item) => item.nftId === "nft-1")).toHaveLength(1);
  });

  it("caps the list at MAX_RECENTLY_VIEWED entries, evicting the oldest", () => {
    const store = useRecentlyViewedStore.getState();
    for (let index = 0; index < MAX_RECENTLY_VIEWED + 5; index += 1) {
      store.trackView(`nft-${index}`);
    }

    const items = useRecentlyViewedStore.getState().items;
    expect(items).toHaveLength(MAX_RECENTLY_VIEWED);
    // Most recently viewed (highest index) is first; oldest entries (0-4) were evicted.
    expect(items[0].nftId).toBe(`nft-${MAX_RECENTLY_VIEWED + 4}`);
    expect(items.some((item) => item.nftId === "nft-0")).toBe(false);
    expect(items.some((item) => item.nftId === "nft-4")).toBe(false);
  });

  it("clearHistory empties the list", () => {
    const store = useRecentlyViewedStore.getState();
    store.trackView("nft-1");
    store.trackView("nft-2");

    store.clearHistory();

    expect(useRecentlyViewedStore.getState().items).toEqual([]);
  });
});
