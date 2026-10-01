// Canonical share-link + share-content builders for NFTs, collections, and
// profiles. Kept pure/side-effect free (no native imports) so they're cheap
// to unit test and so web and mobile can agree on the same URL shape.
//
// The path shapes here intentionally mirror `DEEP_LINK_PATHS` in
// `src/navigation/linking.config.ts` — keep the two in sync. They aren't
// imported from there directly because that module pulls in `expo-linking`
// at the top level, which this file must stay free of to remain a plain,
// side-effect-free utility (and importable under the project's node-based
// unit test environment). See `docs/SHARING.md` for the documented scheme.

export type ShareEntityType = 'nft' | 'collection' | 'profile';

export interface ShareContent {
  title: string;
  message: string;
  url: string;
}

/** Canonical web host shareable links resolve against. Matches the default
 * `EXPO_PUBLIC_DEEP_LINK_HOST` in `src/config/index.ts`. */
export const SHARE_LINK_HOST = 'nftopia.io';

const PATH_BUILDERS: Record<ShareEntityType, (id: string) => string> = {
  nft: (id) => `/nft/${id}`,
  collection: (id) => `/collection/${id}`,
  profile: (id) => `/profile/${id}`,
};

const DEFAULT_TITLES: Record<ShareEntityType, string> = {
  nft: 'Check out this NFT on NFTopia',
  collection: 'Check out this collection on NFTopia',
  profile: 'Check out this profile on NFTopia',
};

/**
 * Canonical, shareable URL for an NFT, collection, or profile.
 *
 * Uses the `https://` universal-link form (not the `nftopia://` custom
 * scheme) so the link also works outside the app — on the web, or when the
 * app isn't installed — while still being recognised as a deep link by
 * `linking.config.ts` when the app is.
 */
export function buildShareLink(type: ShareEntityType, id: string): string {
  if (!id) {
    throw new Error(`buildShareLink: an id is required to share a "${type}"`);
  }
  return `https://${SHARE_LINK_HOST}${PATH_BUILDERS[type](id)}`;
}

/**
 * Structured title/message/url for the OS share sheet. `name`, when given,
 * personalises the title (e.g. the NFT's actual name) instead of the generic
 * fallback. The link is folded into `message` (rather than kept only in a
 * separate `url` field) since Android's `Share.share` ignores `url`
 * entirely — this keeps the shared link visible on every platform.
 */
export function buildShareContent(
  type: ShareEntityType,
  id: string,
  name?: string,
): ShareContent {
  const url = buildShareLink(type, id);
  const title = name ? `${name} on NFTopia` : DEFAULT_TITLES[type];
  return {
    title,
    message: `${title}\n${url}`,
    url,
  };
}
