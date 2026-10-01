// Pure parsing/validation for WalletConnect pairing URIs. No native
// dependencies, so it's cheap to unit test independently of the camera or
// the wallet store.
//
// Shape: `wc:<topic>@<version>?<params>` — v1 pairing carries `bridge=` and
// `key=` params, v2 carries `relay-protocol=` and `symKey=`. This validates
// the URI's shape (enough to route a scan and report the topic/version for
// analytics), not the crypto material inside it.

export interface ParsedWalletConnectUri {
  topic: string;
  version: number;
  params: Record<string, string>;
}

const WC_URI_PATTERN = /^wc:[^@\s?]+@\d+\?\S+/;

export function isWalletConnectUri(value: string): boolean {
  return WC_URI_PATTERN.test((value ?? '').trim());
}

/** Returns `null` for anything that isn't a well-formed WalletConnect URI. */
export function parseWalletConnectUri(value: string): ParsedWalletConnectUri | null {
  const trimmed = (value ?? '').trim();
  if (!isWalletConnectUri(trimmed)) return null;

  const withoutScheme = trimmed.slice('wc:'.length);
  const [topicAndVersion, queryString = ''] = withoutScheme.split('?');
  const [topic, versionStr] = topicAndVersion.split('@');
  const version = Number(versionStr);

  if (!topic || !Number.isFinite(version)) return null;

  const params: Record<string, string> = {};
  new URLSearchParams(queryString).forEach((value, key) => {
    params[key] = value;
  });

  return { topic, version, params };
}
