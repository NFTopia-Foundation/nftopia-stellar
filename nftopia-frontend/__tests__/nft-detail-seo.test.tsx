import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import NFTDetailPage, { generateMetadata } from "../app/[locale]/marketplace/[nftId]/page";
import NFTDetailClient from "../app/[locale]/marketplace/[nftId]/NFTDetailClient";
import { getApolloClient } from "@/lib/graphql/client";

// Mock next/navigation notFound to avoid throwing during tests
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}));

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock GraphQL queries hooks
jest.mock("@/hooks/graphql/useNFTQueries", () => ({
  useNFTByIdQuery: () => ({
    data: null,
    loading: false,
    error: null,
  }),
  useNFTTransferHistoryQuery: () => ({
    data: {
      nftTransferHistory: {
        edges: [],
        totalCount: 0,
        pageInfo: { hasNextPage: false },
      },
    },
    loading: false,
    refetch: jest.fn(),
  }),
}));

// Mock getApolloClient
jest.mock("@/lib/graphql/client", () => {
  const queryMock = jest.fn();
  return {
    getApolloClient: () => ({
      query: queryMock,
    }),
  };
});

const mockApolloClient = getApolloClient() as any;

describe("NFT Detail SEO & Server Wrapper", () => {
  const mockNft = {
    id: "nft-1",
    tokenId: "token-123",
    name: "Stellar Voyager",
    description: "An NFT of a voyager traveling the Stellar universe.",
    image: "https://example.com/voyager.png",
    lastPrice: "100",
    creator: { id: "c1", username: "creator_one", walletAddress: "G123" },
    owner: { id: "o1", username: "owner_one", walletAddress: "G456" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateMetadata", () => {
    it("generates correct metadata when NFT is found", async () => {
      mockApolloClient.query.mockResolvedValueOnce({
        data: { nft: mockNft },
      });

      const metadata = await generateMetadata({
        params: { nftId: "nft-1", locale: "en" },
      });

      expect(metadata.title).toBe("Stellar Voyager | NFTopia Marketplace");
      expect(metadata.description).toBe("An NFT of a voyager traveling the Stellar universe.");
      expect(metadata.openGraph?.title).toBe("Stellar Voyager | NFTopia Marketplace");
      expect(metadata.openGraph?.images).toEqual(["https://example.com/voyager.png"]);
      expect((metadata.twitter as any)?.card).toBe("summary_large_image");
      expect(metadata.alternates?.canonical).toBe("http://localhost:3000/en/marketplace/nft-1");
    });

    it("generates correct fallback metadata when NFT is not found", async () => {
      mockApolloClient.query.mockResolvedValueOnce({
        data: { nft: null },
      });

      const metadata = await generateMetadata({
        params: { nftId: "nft-nonexistent", locale: "en" },
      });

      expect(metadata.title).toBe("NFT Not Found | NFTopia Marketplace");
      expect(metadata.description).toBe("The requested NFT could not be found or does not exist.");
    });

    it("uses localized fallback strings for French locale when NFT is not found", async () => {
      mockApolloClient.query.mockResolvedValueOnce({
        data: { nft: null },
      });

      const metadata = await generateMetadata({
        params: { nftId: "nft-nonexistent", locale: "fr" },
      });

      expect(metadata.title).toBe("NFT introuvable | NFTopia Marketplace");
      expect(metadata.description).toBe("L'NFT demandé est introuvable ou n'existe pas.");
    });
  });

  describe("NFTDetailPage (Server Component)", () => {
    it("renders page with correct JSON-LD Product Schema structured data", async () => {
      mockApolloClient.query.mockResolvedValueOnce({
        data: { nft: mockNft },
      });

      const element = await NFTDetailPage({
        params: { nftId: "nft-1", locale: "en" },
      });

      render(element);

      // Verify JSON-LD script is rendered
      const script = document.querySelector("script[type='application/ld+json']");
      expect(script).toBeInTheDocument();
      const json = JSON.parse(script?.innerHTML || "{}");
      expect(json["@type"]).toBe("Product");
      expect(json.name).toBe("Stellar Voyager");
      expect(json.sku).toBe("token-123");
      expect(json.offers?.price).toBe("100");
    });
  });

  describe("NFTDetailClient (Client Component)", () => {
    it("renders NFT content immediately using initialNft without loading skeleton", () => {
      render(<NFTDetailClient nftId="nft-1" initialNft={mockNft} />);

      expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
      expect(screen.getByText("Stellar Voyager")).toBeInTheDocument();
      expect(screen.getByText("An NFT of a voyager traveling the Stellar universe.")).toBeInTheDocument();
    });
  });
});
