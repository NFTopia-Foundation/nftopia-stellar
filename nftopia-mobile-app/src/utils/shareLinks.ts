/**
 * Canonical shareable deep-link generation for NFTs, collections and profiles.
 *
 * Shared links use the universal-link host (`https://nftopia.io`) so that a
 * recipient who does not have the app installed still lands on the web page,
 * while recipients with the app get deep-linked straight into the matching
 * screen (see `src/navigation/linking.config.ts` and `app.json`).
 *
 * The paths below intentionally mirror `DEEP_LINK_PATHS` in
 * `src/navigation/linking.config.ts`. They are duplicated here (instead of
 * imported) so that this module stays free of React Native / Expo imports and
 * can be unit-tested in a plain node environment.
 */

export type ShareEntityType = 'nft' | 'collection' | 'profile' | 'creator' | 'auction';

export type ShareLinkFormat = 'universal' | 'scheme';

export interface ShareLinkOptions {
  /** `universal` (default) -> https://nftopia.io/... ; `scheme` -> nftopia://... */
  format?: ShareLinkFormat;
  /** Override the universal-link origin, e.g. a staging host. */
  baseUrl?: string;
  /** Override the custom URL scheme (only used when format is `scheme`). */
  scheme?: string;
  /** Extra query parameters appended to the link. */
  query?: Record<string, string | number | boolean | null | undefined>;
}

export const DEFAULT_SHARE_ORIGIN = 'https://nftopia.io';

export const DEFAULT_SHARE_SCHEME = 'nftopia';

/** Path templates, kept in sync with `DEEP_LINK_PATHS`. */
export const SHARE_ENTITY_PATHS: Record<ShareEntityType, string> = {
  nft: '/nft/:nftId',
  collection: '/collection/:collectionId',
  profile: '/profile/:userId',
  creator: '/creator/:creatorId',
  auction: '/auction/:auctionId',
};

const SHARE_ENTITY_TYPES = Object.keys(SHARE_ENTITY_PATHS) as ShareEntityType[];

export function isShareEntityType(value: string): value is ShareEntityType {
  return (SHARE_ENTITY_TYPES as string[]).includes(value);
}

/**
 * Resolve the app-internal path for a given entity, e.g.
 * `buildSharePath('nft', 'abc 123')` -> `/nft/abc%20123`.
 *
 * Throws when the type is unknown or the id is empty, so callers fail fast
 * during development instead of sharing broken links.
 */
export function buildSharePath(type: ShareEntityType, id: string): string {
  if (!isShareEntityType(type)) {
    throw new Error(`[shareLinks] Unknown share entity type: ${String(type)}`);
  }

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`[shareLinks] A non-empty id is required to share a ${type}`);
  }

  const template = SHARE_ENTITY_PATHS[type];
  return template.replace(/:([A-Za-z0-9_]+)\??/, () => encodeURIComponent(id.trim()));
}

function appendQuery(path: string, query?: ShareLinkOptions['query']): string {
  if (!query) return path;

  const entries = Object.entries(query).filter(
    ([, value]) => value !== undefined && value !== null
  ) as [string, string | number | boolean][];

  if (entries.length === 0) return path;

  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return `${path}?${search}`;
}

/**
 * Build a canonical, shareable URL for an NFT, collection or profile.
 *
 * ```ts
 * buildShareLink('nft', 'nft-123');
 * // => 'https://nftopia.io/nft/nft-123'
 *
 * buildShareLink('collection', 'col-1', { format: 'scheme' });
 * // => 'nftopia://collection/col-1'
 * ```
 */
export function buildShareLink(
  type: ShareEntityType,
  id: string,
  options: ShareLinkOptions = {}
): string {
  const path = appendQuery(buildSharePath(type, id), options.query);

  if (options.format === 'scheme') {
    const scheme = (options.scheme ?? DEFAULT_SHARE_SCHEME).replace(/:\/\/$/, '');
    return `${scheme}://${path.replace(/^\//, '')}`;
  }

  const origin = (options.baseUrl ?? DEFAULT_SHARE_ORIGIN).replace(/\/+$/, '');
  return `${origin}${path}`;
}

/**
 * Convenience helper for building a human-friendly share payload that mirrors
 * what is passed to the native share sheet.
 */
export function buildShareContent(
  type: ShareEntityType,
  id: string,
  options?: ShareLinkOptions
): { url: string; path: string } {
  return {
    url: buildShareLink(type, id, options),
    path: buildSharePath(type, id),
  };
}
