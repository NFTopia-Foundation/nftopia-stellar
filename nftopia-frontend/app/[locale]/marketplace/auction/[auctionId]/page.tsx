import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApolloClient } from "@/lib/graphql/client";
import { GET_AUCTION_BY_ID_QUERY } from "@/lib/graphql/queries/auction.queries";
import { isValidAuctionId } from "@/utils/id-validation";
import AuctionDetailClient from "./AuctionDetailClient";

/**
 * Auctions are live data: the price, status and bid list change while the page
 * is open, and the fixture backend the e2e suite drives rewrites them for every
 * case. Without this the route is treated as static, so Next's Data Cache keeps
 * answering the GraphQL read with the first response it ever saw —
 * `fetchAuction` asking for `network-only` only governs Apollo's own store — and
 * the page renders that original auction (price, status, `endTime`) forever.
 */
export const dynamic = "force-dynamic";

const fallbacks: Record<string, { notFoundTitle: string; notFoundDesc: string }> = {
  en: { notFoundTitle: "Auction Not Found | NFTopia Marketplace", notFoundDesc: "The auction you're looking for doesn't exist or has ended." },
  fr: { notFoundTitle: "Enchère introuvable | NFTopia Marketplace", notFoundDesc: "L'enchère que vous recherchez n'existe pas ou est terminée." },
  es: { notFoundTitle: "Subasta no encontrada | NFTopia Marketplace", notFoundDesc: "La subasta que buscas no existe o ha finalizado." },
  de: { notFoundTitle: "Auktion nicht gefunden | NFTopia Marketplace", notFoundDesc: "Die von Ihnen gesuchte Auktion existiert nicht oder ist beendet." },
};

async function fetchAuction(auctionId: string) {
  const client = getApolloClient();
  try {
    const { data } = await client.query({
      query: GET_AUCTION_BY_ID_QUERY,
      variables: { id: auctionId },
      fetchPolicy: "network-only",
    });
    return data?.auction;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { auctionId: string; locale: string };
}): Promise<Metadata> {
  const { auctionId, locale } = params;
  const auction = await fetchAuction(auctionId);
  const localeKey = (Object.keys(fallbacks).includes(locale) ? locale : "en") as keyof typeof fallbacks;
  const tFallback = fallbacks[localeKey];

  if (!auction) {
    return {
      title: tFallback.notFoundTitle,
      description: tFallback.notFoundDesc,
      robots: { index: false, follow: false },
    };
  }

  const title = `${auction.nft?.name || "Auction"} | NFTopia Marketplace`;
  const description = auction.nft?.description || tFallback.notFoundDesc;

  return {
    title,
    description,
    robots: { index: true, follow: true },
  };
}

export default async function AuctionDetailPage({
  params,
}: {
  params: { auctionId: string; locale: string };
}) {
  const { auctionId, locale } = params;

  if (!isValidAuctionId(auctionId)) {
    notFound();
  }

  const auction = await fetchAuction(auctionId);

  if (!auction) {
    notFound();
  }

  return (
    <AuctionDetailClient initialAuction={auction} locale={locale} />
  );
}
