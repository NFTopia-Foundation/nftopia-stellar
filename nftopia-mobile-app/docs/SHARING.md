# Native Share & Deep Link URL Scheme

How NFTs, collections, and profiles are shared out of the app, and the URL
shape any consumer (web, mobile, a future backend link-preview service) needs
to agree on for links to resolve correctly.

## URL shape

Shareable links use the `https://nftopia.io` universal-link form, **not**
the `nftopia://` custom scheme:

| Entity     | Path                       | Example                                |
| ---------- | -------------------------- | --------------------------------------- |
| NFT        | `/nft/:nftId`               | `https://nftopia.io/nft/abc123`         |
| Collection | `/collection/:collectionId` | `https://nftopia.io/collection/xyz789`  |
| Profile    | `/profile/:userId`          | `https://nftopia.io/profile/user-42`    |

`https://` is used instead of `nftopia://` because a custom-scheme link does
nothing on a device without the app installed, or when pasted into a browser
or a desktop chat client — exactly the "outside the app" cases sharing exists
for. `https://nftopia.io/...` is also already a registered prefix in
[`src/navigation/linking.config.ts`](../src/navigation/linking.config.ts), so
the same link opens the app directly (via the OS's universal-link handling)
when the app *is* installed, and can fall back to a web page otherwise.

These paths mirror `DEEP_LINK_PATHS` in `linking.config.ts` — if that file's
paths for `nft`, `collection`, or `profile` change, update
[`src/utils/shareLink.ts`](../src/utils/shareLink.ts) to match.

## Building a share link

Use `buildShareLink` / `buildShareContent` from `src/utils/shareLink.ts`
rather than constructing the URL by hand:

```ts
import { buildShareLink, buildShareContent } from '@/src/utils/shareLink';

buildShareLink('nft', 'abc123');
// => 'https://nftopia.io/nft/abc123'

buildShareContent('nft', 'abc123', 'Cosmic Ape #7');
// => {
//   title: 'Cosmic Ape #7 on NFTopia',
//   message: 'Cosmic Ape #7 on NFTopia\nhttps://nftopia.io/nft/abc123',
//   url: 'https://nftopia.io/nft/abc123',
// }
```

Both are pure functions with no native dependencies, so they're safe to call
from anywhere (including a future web share button) and are covered by unit
tests in `src/utils/shareLink.test.ts`.

## Triggering a share

`ShareButton` (`components/ui/ShareButton.tsx`) is the reusable affordance —
give it an `id`, `type` (`'nft' | 'collection' | 'profile'`), and optionally
a `name` to personalise the title. It's already wired into
`MarketplaceListingCard`.

Under the hood it calls `shareEntity()` in `src/services/share.service.ts`,
which:

1. Tracks `share_initiated`.
2. Probes `expo-sharing`'s `isAvailableAsync()` for share-sheet availability.
   (`expo-sharing`'s own `shareAsync` only accepts local file URLs, so it
   can't carry a text link — it's used purely as this availability check,
   and is reserved for a future file-preview share, e.g. sharing the NFT's
   actual image.)
3. Opens the OS share sheet via React Native's core `Share.share`, which is
   what actually shows the title + link.
4. Falls back to copying the link to the clipboard (`expo-clipboard`) if the
   share sheet is unavailable or `Share.share` throws.
5. Tracks `share_completed`, `share_cancelled`, or `share_failed`
   accordingly.

`shareEntity()` never rejects — every outcome (shared, cancelled, copied,
failed) comes back as a `status` on its resolved result, so callers don't
need a try/catch to stay resilient to a share-sheet failure.
