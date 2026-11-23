import { act, fireEvent, render, screen } from "@testing-library/react";
import { RecentlyViewedRow } from "../RecentlyViewedRow";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import { useNFTByIdQuery } from "@/hooks/graphql/useNFTQueries";

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/graphql/useNFTQueries", () => ({
  useNFTByIdQuery: jest.fn(),
}));

const mockedUseNFTByIdQuery = jest.mocked(useNFTByIdQuery);

function nftFixture(id: string) {
  return { id, name: `NFT ${id}`, image: `https://example.com/${id}.png` };
}

describe("RecentlyViewedRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("renders nothing, not even the heading, when there's no history", () => {
    const { container } = render(<RecentlyViewedRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a card per recently-viewed NFT, most recent first", () => {
    act(() => {
      useRecentlyViewedStore.getState().trackView("nft-1");
      useRecentlyViewedStore.getState().trackView("nft-2");
    });
    mockedUseNFTByIdQuery.mockImplementation(({ id }: { id: string }) => ({
      data: { nft: nftFixture(id) },
      loading: false,
    }) as ReturnType<typeof useNFTByIdQuery>);

    render(<RecentlyViewedRow />);

    expect(screen.getByText("marketplace.recentlyViewed.title")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // nft-2 was viewed last, so it renders first.
    expect(items[0]).toHaveTextContent("NFT nft-2");
    expect(items[1]).toHaveTextContent("NFT nft-1");
  });

  it("shows a loading skeleton for a card whose NFT hasn't resolved yet", () => {
    act(() => {
      useRecentlyViewedStore.getState().trackView("nft-1");
    });
    mockedUseNFTByIdQuery.mockReturnValue({
      data: undefined,
      loading: true,
    } as unknown as ReturnType<typeof useNFTByIdQuery>);

    render(<RecentlyViewedRow />);

    expect(screen.getAllByTestId("recently-viewed-skeleton")).toHaveLength(1);
  });

  it("drops a card silently when its NFT can no longer be found", () => {
    act(() => {
      useRecentlyViewedStore.getState().trackView("nft-1");
      useRecentlyViewedStore.getState().trackView("nft-2");
    });
    mockedUseNFTByIdQuery.mockImplementation(({ id }: { id: string }) => ({
      data: { nft: id === "nft-1" ? null : nftFixture(id) },
      loading: false,
    }) as ReturnType<typeof useNFTByIdQuery>);

    render(<RecentlyViewedRow />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("NFT nft-2")).toBeInTheDocument();
    expect(screen.queryByText("NFT nft-1")).not.toBeInTheDocument();
  });

  it("clears the history when the clear action is used", () => {
    act(() => {
      useRecentlyViewedStore.getState().trackView("nft-1");
    });
    mockedUseNFTByIdQuery.mockImplementation(({ id }: { id: string }) => ({
      data: { nft: nftFixture(id) },
      loading: false,
    }) as ReturnType<typeof useNFTByIdQuery>);

    render(<RecentlyViewedRow />);
    fireEvent.click(
      screen.getByRole("button", { name: "marketplace.recentlyViewed.clear" }),
    );

    expect(useRecentlyViewedStore.getState().items).toEqual([]);
  });
});
