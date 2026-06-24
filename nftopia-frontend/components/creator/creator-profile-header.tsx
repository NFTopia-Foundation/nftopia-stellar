"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  ExternalLink,
  Globe,
  Instagram,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  buildCreatorProfilePath,
  buildInstagramUrl,
  buildTwitterUrl,
  getCreatorAvatarUrl,
  getCreatorBannerUrl,
  getCreatorDisplayName,
  sanitizeExternalUrl,
} from "@/lib/utils/creator-profile";
import { CreatorFollowButton } from "./creator-follow-button";
import { CreatorShareButton } from "./creator-share-button";

type CreatorProfileHeaderProps = {
  creator: {
    id: string;
    username?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    website?: string | null;
    twitterHandle?: string | null;
    instagramHandle?: string | null;
    isVerified: boolean;
    followerCount: number;
    totalNftsCreated: number;
    totalSalesVolume: string;
    createdAt: string;
    isFollowing?: boolean | null;
  };
  profileSlug: string;
  locale: string;
};

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

export function CreatorProfileHeader({
  creator,
  profileSlug,
  locale,
}: CreatorProfileHeaderProps) {
  const { t } = useTranslation();

  const displayName = getCreatorDisplayName(creator.username, creator.id);
  const avatarUrl = getCreatorAvatarUrl(creator.id, creator.avatarUrl);
  const bannerUrl = getCreatorBannerUrl(creator.id, creator.bannerUrl);
  const websiteUrl = sanitizeExternalUrl(creator.website);
  const twitterUrl = buildTwitterUrl(creator.twitterHandle);
  const instagramUrl = buildInstagramUrl(creator.instagramHandle);
  const profilePath = buildCreatorProfilePath(profileSlug, locale);

  const joinedLabel = useMemo(() => {
    if (!creator.createdAt) return null;
    return new Date(creator.createdAt).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }, [creator.createdAt]);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-900/40">
      <div className="relative h-36 md:h-48">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#181359] via-[#2a1f7a] to-[#4e3bff]/40" />
        )}
      </div>

      <div className="relative px-4 pb-5 pt-0 md:px-6">
        <div className="-mt-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-4 border-gray-900 bg-gray-900 md:h-24 md:w-24">
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
                unoptimized
              />
              {creator.isVerified ? (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-gray-900 p-0.5">
                  <BadgeCheck className="h-5 w-5 text-emerald-400" />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-white md:text-3xl">
                  {displayName}
                </h1>
                {creator.isVerified ? (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                    {t("creatorProfile.verified")}
                  </span>
                ) : null}
              </div>

              {creator.bio ? (
                <p className="mt-1 max-w-2xl text-sm text-gray-300 line-clamp-2">
                  {creator.bio}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                {joinedLabel ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {joinedLabel}
                  </span>
                ) : null}
                <span>
                  {creator.followerCount.toLocaleString()}{" "}
                  {t("creatorProfile.followers")}
                </span>
                <span>
                  {creator.totalNftsCreated.toLocaleString()}{" "}
                  {t("creatorProfile.nftsCreated")}
                </span>
                <span>
                  {Number(creator.totalSalesVolume).toFixed(2)} XLM{" "}
                  {t("creatorProfile.volume")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {twitterUrl ? (
                  <SocialLink href={twitterUrl} label="Twitter">
                    <XIcon className="h-4 w-4" />
                  </SocialLink>
                ) : null}
                {instagramUrl ? (
                  <SocialLink href={instagramUrl} label="Instagram">
                    <Instagram className="h-4 w-4" />
                  </SocialLink>
                ) : null}
                {websiteUrl ? (
                  <SocialLink href={websiteUrl} label="Website">
                    <Globe className="h-4 w-4" />
                  </SocialLink>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CreatorFollowButton
              creatorId={creator.id}
              initialFollowing={creator.isFollowing ?? false}
              initialFollowerCount={creator.followerCount}
            />
            <CreatorShareButton
              profileUrl={profilePath}
              title={displayName}
              text={creator.bio ?? undefined}
              imageUrl={avatarUrl}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-gray-700/80 px-2.5 py-1.5 text-gray-300 transition-colors hover:border-purple-400/50 hover:text-white"
      aria-label={label}
    >
      {children}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}
