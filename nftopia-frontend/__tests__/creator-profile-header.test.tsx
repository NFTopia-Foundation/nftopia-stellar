import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CreatorProfileHeader } from "../components/creator/creator-profile-header";

/**
 * Covers #659's acceptance criterion that both follower and following
 * counts are visible on the public profile — previously only followerCount
 * was rendered and followingCount was typed but never displayed anywhere.
 */

jest.mock("next/image", () => {
  return function MockImage({ src, alt, fill, priority, unoptimized, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt || "mock image"} {...props} />;
  };
});

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "creatorProfile.followers": "followers",
        "creatorProfile.following": "following",
        "creatorProfile.nftsCreated": "NFTs",
        "creatorProfile.volume": "volume",
        "creatorProfile.verified": "Verified",
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock("@/src/components/ReportButton", () => ({
  ReportButton: () => <div data-testid="report-button" />,
}));

jest.mock("../components/creator/creator-follow-button", () => ({
  CreatorFollowButton: () => <button type="button">Follow</button>,
}));

jest.mock("../components/creator/creator-share-button", () => ({
  CreatorShareButton: () => <button type="button">Share</button>,
}));

const baseCreator = {
  id: "creator-1",
  username: "stellar_artist",
  bio: "Building on Stellar",
  avatarUrl: null,
  bannerUrl: null,
  website: null,
  twitterHandle: null,
  instagramHandle: null,
  isVerified: false,
  followerCount: 42,
  followingCount: 7,
  totalNftsCreated: 12,
  totalSalesVolume: "100.0000000",
  createdAt: "2026-01-01T00:00:00.000Z",
  isFollowing: false,
};

describe("CreatorProfileHeader (#659)", () => {
  it("renders both follower and following counts", () => {
    render(
      <CreatorProfileHeader creator={baseCreator} profileSlug="stellar_artist" locale="en" />
    );

    expect(screen.getByText("42 followers")).toBeInTheDocument();
    expect(screen.getByText("7 following")).toBeInTheDocument();
  });

  it("renders the follow button", () => {
    render(
      <CreatorProfileHeader creator={baseCreator} profileSlug="stellar_artist" locale="en" />
    );

    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });
});
