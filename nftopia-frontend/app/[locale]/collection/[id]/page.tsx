import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApolloClient } from "@/lib/graphql/client";
import { GET_COLLECTION_BY_ID_QUERY } from "@/lib/graphql/queries/collection.queries";
import { isValidCollectionId } from "@/utils/id-validation";
import { CollectionDetailClient } from "./CollectionDetailClient";

const fallbacks: Record<string, { notFoundTitle: string; notFoundDesc: string }> = {
  en: { notFoundTitle: "Collection Not Found | NFTopia Marketplace", notFoundDesc: "The requested collection could not be found or does not exist." },
  fr: { notFoundTitle: "Collection introuvable | NFTopia Marketplace", notFoundDesc: "La collection demandée est introuvable ou n'existe pas." },
  es: { notFoundTitle: "Colección no encontrada | NFTopia Marketplace", notFoundDesc: "La colección solicitada no se pudo encontrar o no existe." },
  de: { notFoundTitle: "Sammlung nicht gefunden | NFTopia Marketplace", notFoundDesc: "Die angeforderte Sammlung konnte nicht gefunden werden oder existiert nicht." },
};

async function fetchCollection(collectionId: string) {
  const client = getApolloClient();
  try {
    const { data } = await client.query({
      query: GET_COLLECTION_BY_ID_QUERY,
      variables: { id: collectionId },
      fetchPolicy: "network-only",
    });
    return data?.collection;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string; locale: string };
}): Promise<Metadata> {
  const { id, locale } = params;
  const collection = await fetchCollection(id);
  const localeKey = (Object.keys(fallbacks).includes(locale) ? locale : "en") as keyof typeof fallbacks;
  const tFallback = fallbacks[localeKey];

  if (!collection) {
    return {
      title: tFallback.notFoundTitle,
      description: tFallback.notFoundDesc,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${collection.name} | NFTopia Marketplace`,
    description: collection.description || `Browse NFTs in the ${collection.name} collection`,
    robots: { index: true, follow: true },
  };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const { id, locale } = params;

  if (!isValidCollectionId(id)) {
    notFound();
  }

  const collection = await fetchCollection(id);

  if (!collection) {
    notFound();
  }

  return <CollectionDetailClient collection={collection} locale={locale} />;
}
