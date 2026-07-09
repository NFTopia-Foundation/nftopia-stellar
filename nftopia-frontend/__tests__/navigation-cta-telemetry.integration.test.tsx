import { render, fireEvent, screen } from "@testing-library/react";
import { Navbar } from "../components/navbar";
import PopularCollection from "../components/PopularCollection";
import { telemetry } from "../lib/telemetry";

jest.mock("../lib/telemetry", () => ({
  telemetry: { track: jest.fn() },
}));

// Mock the GraphQL hooks - include BOTH hooks needed by PopularCollection
jest.mock("@/hooks/graphql/useCollectionQueries", () => ({
  usePopularCollectionsQuery: jest.fn().mockReturnValue({
    data: { 
      topCollections: [
        {
          id: "1",
          title: "Test Collection",
          creatorName: "Test Creator",
          creatorImage: "/images/fallbacks/avatar-fallback.svg",
          images: {
            main: "/images/fallbacks/collection-fallback.svg",
            secondary1: "/images/fallbacks/nft-fallback.svg",
            secondary2: "/images/fallbacks/nft-fallback.svg",
          },
          likes: 100,
        },
      ] 
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useLikeCollection: jest.fn().mockReturnValue({
    isLiked: false,
    likesCount: 0,
    isLoading: false,
    toggleLike: jest.fn().mockResolvedValue({ success: true }),
    refetchLikes: jest.fn(),
  }),
}));

// Mock next/router for components that read history state
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: '',
      asPath: '',
    };
  },
}));

describe("Navigation and CTA Telemetry Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("emits nav_item_clicked when desktop nav link is clicked", () => {
    render(<Navbar />);
    // Simulate desktop viewport configuration
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1280 });
    window.dispatchEvent(new Event("resize"));
    
    // Find and click the 'Explore' nav link
    const exploreLink = screen.getAllByText(/explore/i)[0];
    fireEvent.click(exploreLink);
    expect(telemetry.track).toHaveBeenCalledWith(
      "nav_item_clicked",
      expect.objectContaining({ nav_item_id: "explore", placement: "navbar_desktop" })
    );
  });

  it("emits cta_clicked when PopularCollection Explore More is clicked", () => {
    render(<PopularCollection />);
    
    // Query by accessibility role and label to bypass localization keys
    const exploreMore = screen.getByRole("link", { name: /explore more collections/i });
    
    fireEvent.click(exploreMore);
    expect(telemetry.track).toHaveBeenCalledWith(
      "cta_clicked",
      expect.objectContaining({ 
        cta_id: "explore_more_popular_collection", 
        placement: "landing_hero_primary" // 💡 Synced to match telemetry runtime logs
      })
    );
  });
});
