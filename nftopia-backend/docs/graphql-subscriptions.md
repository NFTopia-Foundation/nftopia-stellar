# GraphQL subscriptions: real-time auction bid updates (#650)

## Why

The auction resolver previously only exposed queries and mutations, so any
client wanting live bid updates had to poll `auctionBids`/`auction` on an
interval. `auctionBidPlaced` lets a client open one subscription per auction
and receive a push on every new bid instead.

This is a second, GraphQL-native transport alongside the existing
Socket.IO `/bids` namespace (`BidGateway`) — use whichever fits your
client's existing stack. Both are fed by the same underlying event
(`BID_PLACED_EVENT`, emitted by `BidService` for every bid-placement path),
so they never drift out of sync with each other.

## Transport

The gateway serves subscriptions over `graphql-ws` on the same host/port and
path as queries/mutations (`ws://<graphql-host>:<GRAPHQL_PORT>/graphql`,
`wss://` in production) — not a separate endpoint. Use an Apollo Client (or
any `graphql-ws`-compatible client) configured with a `GraphQLWsLink`/`Client`
pointed at that URL; there is no support for the older
`subscriptions-transport-ws` protocol.

To authenticate a subscription connection (optional — `auctionBidPlaced`
itself doesn't require it today, but a future auth-gated subscription would
reuse this), send a bearer token in `connectionParams` when opening the
socket:

```ts
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'wss://api.example.com/graphql',
  connectionParams: {
    authorization: `Bearer ${accessToken}`,
  },
});
```

## The subscription

```graphql
subscription OnAuctionBid($auctionId: ID!) {
  auctionBidPlaced(auctionId: $auctionId) {
    id
    auctionId
    amount
    bidderId
    createdAt
    bidder {
      username
    }
  }
}
```

- `auctionId` (required): subscribe to bids on exactly this auction.
- The payload is a `Bid` — the same type `auctionBids`/`AuctionResolver.bids`
  return, including its `bidder`/`auction` `@ResolveField`s (resolved the
  usual way via DataLoader, so requesting `bidder { ... }` works here too).

## Scoping — not a global firehose

Every `auctionBidPlaced` subscriber shares one underlying PubSub topic, but
each subscriber's own `auctionId` argument filters what reaches it: a bid on
auction A is never delivered to a client subscribed to auction B. See
`auctionBidPlacedFilter` in `src/graphql/resolvers/auction.resolver.ts` and
its tests in `auction.resolver.spec.ts`.

There is currently no additional authorization check beyond the `auctionId`
filter — anyone who knows an auction's id can subscribe to its bid feed,
matching the existing unauthenticated `auctionBids`/`activeAuctions`
queries (auction bid data is public marketplace information, not
per-user-private). If a future auction type needs private bid visibility,
add that check as an additional `filter` condition (e.g. resolving the
subscriber's `context.user` and checking it against the auction's
participant list) rather than relying on the client simply not knowing the
id.

## Delivery path

```
BidService.create() / BidService.placeBid()
  → eventEmitter.emit(BID_PLACED_EVENT, event)
    → AuctionBidPublisher.handleBidPlaced()   (src/graphql/pubsub/auction-bid.publisher.ts)
      → pubSub.publish(AUCTION_BID_PLACED_TOPIC, { auctionBidPlaced: ... })
        → every connected auctionBidPlaced subscriber whose auctionId matches
```

`BidService.create()` (the path the `placeBid` GraphQL *mutation* uses) did
not emit `BID_PLACED_EVENT` before this change — only the on-chain
`placeBid()` method did, so a bid placed through GraphQL never reached the
highest-bid cache refresh, seller notification, or Socket.IO broadcast
either. Fixing that one emit call is what makes "every successful bid"
(not just on-chain ones) feed the subscription.

## Operational note

The PubSub instance (`src/graphql/pubsub/pubsub.provider.ts`) is in-process
and in-memory, matching the AI chat stream registry's documented
single-backend-instance limitation (see
docs/ai-chat-streaming-reconnect.md): a subscriber only receives bids placed
through the *same* backend instance it connected to. A multi-instance
deployment would need a shared pub/sub backend (e.g.
`graphql-redis-subscriptions`) instead.
