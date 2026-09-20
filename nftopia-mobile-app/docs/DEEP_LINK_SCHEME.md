# Deep Link & Share URL Scheme

Canonical reference for the URL scheme used by the NFTopia mobile app for deep
linking and native sharing. Keep this in sync with
`src/navigation/linking.config.ts` and `app.json`.

## Supported URL formats

| Purpose                    | Format                              | Example                                |
| -------------------------- | ----------------------------------- | -------------------------------------- |
| Universal link (sharing)   | `https://nftopia.io/<path>`         | `https://nftopia.io/nft/nft-123`       |
| Universal link (www)       | `https://www.nftopia.io/<path>`     | `https://www.nftopia.io/collection/12` |
| Custom scheme (dev/test)   | `nftopia://<path>`                  | `nftopia://nft/nft-123`                |
| Custom scheme (staging)    | `nftopia-staging://<path>`          | `nftopia-staging://profile/user-9`     |
| Custom scheme (development)| `nftopia-dev://<path>`              | `nftopia-dev://nft/nft-123`            |

Universal links are the preferred format for sharing because they also resolve
to the web page when the app is not installed.

## Entity paths

| Entity     | Path template            | Share `type` |
| ---------- | ------------------------ | ------------ |
| NFT        | `/nft/:nftId`            | `nft`        |
| Collection | `/collection/:collectionId` | `collection` |
| Profile    | `/profile/:userId`       | `profile`    |
| Creator    | `/creator/:creatorId`    | `creator`    |
| Auction    | `/auction/:auctionId`    | `auction`    |

Additional paths handled by the app: `/` (Home), `/marketplace`,
`/notifications`, `/wallet`, `/auth/login`, `/auth/register`, `/onboarding`.

## Platform configuration

`app.json` registers the associated domains and intent filters:

- iOS `associatedDomains`: `applinks:nftopia.io`, `applinks:www.nftopia.io`
- Android `intentFilters`: `https://nftopia.io`, `https://www.nftopia.io`
- Custom scheme: `nftopia`

`getLinkingConfig()` in `src/navigation/linking.config.ts` maps these prefixes
and paths onto React Navigation screens. `src/services/deepLink.service.ts`
validates incoming URLs, tracks `deep_link_open` / `deep_link_error` analytics,
and defers links until authentication completes.

## Generating share links

Always use the shared utility instead of hand-building URLs:

```ts
import { buildShareLink } from '@/src/utils/shareLinks';

buildShareLink('nft', 'nft-123');
// => 'https://nftopia.io/nft/nft-123'

buildShareLink('collection', 'col-9', { format: 'scheme' });
// => 'nftopia://collection/col-9'

buildShareLink('profile', 'user-1', { query: { ref: 'share' } });
// => 'https://nftopia.io/profile/user-1?ref=share'
```

The utility URL-encodes ids and query values and throws for unknown entity types
or empty ids so broken links are caught before reaching the share sheet.

## UI component

`components/ui/ShareButton.tsx` wraps the native share sheet. It accepts either
`type` + `id` (preferred) or an explicit `url`, and fires analytics when the
sheet is opened, completed, cancelled, or fails. Cancelling the share sheet is
treated as a normal outcome and never throws.

```tsx
<ShareButton
  type="nft"
  id={nft.id}
  title={nft.name}
  message={`Check out ${nft.name} on NFTopia!`}
/>
```

Share affordances are available from marketplace/NFT cards, the NFT detail
header, collection detail, and creator profiles.

## Analytics events

| Event                | Constant                     | When                       |
| -------------------- | ---------------------------- | -------------------------- |
| `share_initiated`    | `SHARE_INITIATED`            | Share button pressed       |
| `share_completed`    | `SHARE_COMPLETED`            | Recipient action completed |
| `share_cancelled`    | `SHARE_CANCELLED`            | Sheet dismissed            |
| `share_failed`       | `SHARE_FAILED`               | Share API threw            |

Events are routed through `analyticsService`, which is a no-op until analytics
consent and configuration are enabled.

## Web / mobile parity

The web app should serve the same `https://nftopia.io/<path>` URLs so a link
shared from mobile opens the matching web page, and the universal-link config
routes it back into the app when installed.
