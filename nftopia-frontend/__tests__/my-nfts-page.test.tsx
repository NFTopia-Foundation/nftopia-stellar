import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyNFTsPage from "@/app/[locale]/creator-dashboard/my-nfts/page";

// Mocks
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockFetchWithAuth = jest.fn();
jest.mock("@/lib/api/fetchWithAuth", () => ({
  fetchWithAuth: (...args: any[]) => mockFetchWithAuth(...args),
}));

// Create a stable `t` function to avoid re-creating useCallback deps
const tMap: Record<string, string> = {
  "profile.myNFTs": "My NFTs",
  "creator.createNFT": "Create NFT",
};
const stableT = (key: string) => tMap[key] || key;

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: stableT,
    locale: "en",
  }),
}));

const mockUseAuthStore = jest.fn();
jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill, unoptimized, priority, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

describe("MyNFTsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: { sub: "creator-uuid-123", walletAddress: "GABC123" },
      isAuthenticated: true,
      loading: false,
    });
  });

  it("redirects to login if not authenticated", async () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    render(<MyNFTsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/en/auth/login");
    });
  });

  it("renders loading skeletons initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {})); // Never resolves
    const { container } = render(<MyNFTsPage />);
    const busyGrid = container.querySelector('[aria-busy="true"]');
    expect(busyGrid).toBeInTheDocument();
  });

  it("renders empty state if no NFTs are found", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ nfts: [], hasMore: false }),
    });

    render(<MyNFTsPage />);

    await waitFor(() => {
      expect(screen.getByText("No NFTs found")).toBeInTheDocument();
    });
  });

  it("renders NFTs inside card grid upon successful fetch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        nfts: [
          {
            id: "nft-1",
            name: "Super Star",
            tokenId: "99",
            imageUrl: "https://example.com/star.png",
            collectionName: "Cosmic Club",
          },
        ],
        hasMore: false,
      }),
    });

    render(<MyNFTsPage />);

    await waitFor(() => {
      expect(screen.getByText("Super Star")).toBeInTheDocument();
      expect(screen.getByText("ID #99")).toBeInTheDocument();
      expect(screen.getByText("Cosmic Club")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure and allows retry", async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nfts: [], hasMore: false }),
      });

    render(<MyNFTsPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load NFTs")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("No NFTs found")).toBeInTheDocument();
    });
  });

  it("renders pagination controls when items have more pages", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        nfts: Array.from({ length: 20 }, (_, i) => ({
          id: `nft-${i}`,
          name: `NFT ${i}`,
          tokenId: `${i}`,
        })),
        hasMore: true,
      }),
    });

    render(<MyNFTsPage />);

    // Wait for data and pagination to both render in a single assertion block
    await waitFor(() => {
      expect(screen.getByText("NFT 0")).toBeInTheDocument();
      expect(screen.getByText("Page 1")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /next page/i })
      ).toBeEnabled();
    });
  });
});
