import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApolloClient } from "@/lib/graphql/client";
import { GET_NFT_BY_ID_QUERY } from "@/lib/graphql/queries/nft.queries";
import { isValidNFTId } from "@/utils/id-validation";
import NFTDetailClient from "./NFTDetailClient";

// Localized fallbacks for metadata
const fallbacks: Record<string, { description: string; notFoundTitle: string; notFoundDesc: string }> = {
  en: {
    description: "View this unique NFT on NFTopia",
    notFoundTitle: "NFT Not Found | NFTopia Marketplace",
    notFoundDesc: "The requested NFT could not be found or does not exist.",
  },
  fr: {
    description: "Voir cet NFT unique sur NFTopia",
    notFoundTitle: "NFT introuvable | NFTopia Marketplace",
    notFoundDesc: "L'NFT demandé est introuvable ou n'existe pas.",
  },
  es: {
    description: "Ver este NFT único en NFTopia",
    notFoundTitle: "NFT no encontrado | NFTopia Marketplace",
    notFoundDesc: "El NFT solicitado no se pudo encontrar o no existe.",
  },
  de: {
    description: "Diesen einzigartigen NFT auf NFTopia ansehen",
    notFoundTitle: "NFT nicht gefunden | NFTopia Marketplace",
    notFoundDesc: "Der angeforderte NFT konnte nicht gefunden werden oder existiert nicht.",
  },
};

// Fetch NFT details on the server side
async function fetchNFT(nftId: string) {
  const client = getApolloClient();
  try {
    const { data } = await client.query({
      query: GET_NFT_BY_ID_QUERY,
      variables: { id: nftId },
      fetchPolicy: "network-only",
    });
    return data?.nft;
  } catch (error) {
    console.error("Error fetching NFT on server:", error);
    return null;
  }
}

// Generate dynamic SEO metadata
export async function generateMetadata({
  params,
}: {
  params: { nftId: string; locale: string };
}): Promise<Metadata> {
  const { nftId, locale } = params;
  const nft = await fetchNFT(nftId);
  const localeKey = (Object.keys(fallbacks).includes(locale) ? locale : "en") as keyof typeof fallbacks;
  const tFallback = fallbacks[localeKey];

  if (!nft) {
    return {
      title: tFallback.notFoundTitle,
      description: tFallback.notFoundDesc,
      robots: { index: false, follow: false },
    };
  }

  const title = `${nft.name} | NFTopia Marketplace`;
  const description = nft.description || tFallback.description;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const pageUrl = `${baseUrl}/${locale}/marketplace/${nftId}`;
  const images = nft.image ? [nft.image] : [`${baseUrl}/nftopia-03.png`];

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${baseUrl}/en/marketplace/${nftId}`,
        fr: `${baseUrl}/fr/marketplace/${nftId}`,
        es: `${baseUrl}/es/marketplace/${nftId}`,
        de: `${baseUrl}/de/marketplace/${nftId}`,
        "x-default": `${baseUrl}/en/marketplace/${nftId}`,
      },
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

// Main Page entrypoint (Server Component)
export default async function NFTDetailPage({
  params,
}: {
  params: { nftId: string; locale: string };
}) {
  const { nftId, locale } = params;

  if (!isValidNFTId(nftId)) {
    notFound();
  }

  const nft = await fetchNFT(nftId);

  if (!nft) {
    notFound();
  }

  // Structured Data (JSON-LD Product Schema)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": nft.name,
    "image": nft.image,
    "description": nft.description || undefined,
    "sku": nft.tokenId,
    "offers": nft.lastPrice
      ? {
          "@type": "Offer",
          "price": nft.lastPrice,
          "priceCurrency": "XLM",
          "availability": "https://schema.org/InStock",
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NFTDetailClient nftId={nftId} initialNft={nft} />
    </>
  );
}