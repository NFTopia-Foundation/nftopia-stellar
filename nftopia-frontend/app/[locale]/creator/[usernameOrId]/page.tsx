import type { Metadata } from "next";
import { CreatorProfileClient } from "./creator-profile-client";
import { getCreatorDisplayName } from "@/lib/utils/creator-profile";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3001/graphql";

type PageProps = {
  params: {
    locale: string;
    usernameOrId: string;
  };
};

async function fetchCreatorMeta(identifier: string) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query PublicCreatorMeta($identifier: String!) {
          publicCreator(identifier: $identifier) {
            id
            username
            bio
            avatarUrl
            bannerUrl
          }
        }
      `,
      variables: { identifier },
    }),
    next: { revalidate: 120 },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    data?: {
      publicCreator?: {
        id: string;
        username?: string | null;
        bio?: string | null;
        avatarUrl?: string | null;
        bannerUrl?: string | null;
      };
    };
  };

  return payload.data?.publicCreator ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const identifier = decodeURIComponent(params.usernameOrId);
  const creator = await fetchCreatorMeta(identifier);

  if (!creator) {
    return {
      title: "Creator | NFTopia",
      description: "Explore creator profiles on NFTopia.",
    };
  }

  const name = getCreatorDisplayName(creator.username, creator.id);
  const description =
    creator.bio?.slice(0, 160) || `View ${name}'s NFTs, collections, and activity on NFTopia.`;

  return {
    title: `${name} | NFTopia`,
    description,
    openGraph: {
      title: `${name} | NFTopia`,
      description,
      images: creator.bannerUrl || creator.avatarUrl || undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | NFTopia`,
      description,
      images: creator.bannerUrl || creator.avatarUrl || undefined,
    },
  };
}

export default function CreatorProfilePage() {
  return <CreatorProfileClient />;
}
