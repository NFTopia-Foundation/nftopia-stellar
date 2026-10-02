/**
 * Deterministic backend for the auction e2e suite.
 *
 * The auction detail route is a Next.js server component, so Playwright's
 * browser-level `page.route` cannot stub the GraphQL query that produces
 * `initialAuction`. This tiny dependency-free HTTP server answers that query
 * (and the REST endpoints the client polls) so `playwright.config.ts` can boot
 * the app against it when `E2E_MOCK_BACKEND=1` is set.
 *
 * State is process-wide and single-auction: POST /__scenario replaces the
 * auction under test, POST /__reset restores the default active auction.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.E2E_MOCK_API_PORT || 4321);

const SELLER = {
  id: "user-seller",
  username: "seller",
  walletAddress: "GSELLER0000000000000000000000000000000000000000000000",
};

function iso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function buildAuction(overrides = {}) {
  const nft = {
    id: "nft-1",
    name: "Genesis Orb",
    image: `http://127.0.0.1:${PORT}/assets/orb.png`,
    tokenId: "42",
    description: "The first orb minted on the e2e fixture chain.",
    // Apollo Client raises a cache-write error for any field named in the query
    // that is missing from the response, so the fixture mirrors the whole
    // `nft.attributes` shape: `displayType` is nullable in the backend
    // (`nft_metadata.display_type`), hence the explicit `null` on the first
    // attribute, with a populated value on the second.
    attributes: [
      { traitType: "Rarity", value: "Legendary", displayType: null },
      { traitType: "Boost", value: "5", displayType: "boost_percentage" },
    ],
    collection: { id: "col-1", name: "Genesis", symbol: "GEN", image: "" },
    creator: { id: "user-creator", username: "creator", walletAddress: "GCREATOR" },
    owner: SELLER,
  };

  return {
    // UUID, like the real backend generates (`Auction` uses
    // `@PrimaryGeneratedColumn('uuid')`). The detail route validates the id
    // before it queries (`utils/id-validation.ts` accepts UUIDs and numeric ids
    // only), so a descriptive slug here would 404 the whole suite.
    id: "3f9c1b2a-4d5e-4f6a-8b7c-9d0e1f2a3b4c",
    nftId: nft.id,
    sellerId: SELLER.id,
    startPrice: "100",
    currentPrice: "100",
    reservePrice: null,
    startTime: iso(-60 * 60 * 1000),
    endTime: iso(60 * 60 * 1000),
    status: "ACTIVE",
    winnerId: null,
    nft,
    bids: [],
    highestBid: null,
    seller: SELLER,
    winner: null,
    ...overrides,
  };
}

let auction = buildAuction();

/**
 * Stamp `__typename` onto a payload the way a real GraphQL server does.
 *
 * Apollo Client reads a query result back out of its normalized cache, and it
 * can only do that for objects it can identify — which needs `__typename`
 * (plus `id`). Without it the store has no `Auction:<id>` entry, and every
 * field the query selects through the `AuctionFields` fragment (`startPrice`,
 * `status`, `endTime`, `winnerId`, …) silently disappears from `data.auction`
 * while the inline fields survive. The route then renders `NaN`/undefined
 * prices and never polls (`status !== "ACTIVE"`), so the suite has to serve
 * fully typed responses.
 */
function withTypenames(auction) {
  if (!auction) return auction;
  const user = (value) => (value ? { __typename: "User", ...value } : value);
  const bid = (value) =>
    value ? { __typename: "Bid", ...value, bidder: user(value.bidder) } : value;
  const nft = auction.nft
    ? {
        __typename: "NFT",
        ...auction.nft,
        attributes: auction.nft.attributes?.map((attribute) => ({
          __typename: "NFTAttribute",
          ...attribute,
        })),
        collection: auction.nft.collection
          ? { __typename: "Collection", ...auction.nft.collection }
          : auction.nft.collection,
        creator: user(auction.nft.creator),
        owner: user(auction.nft.owner),
      }
    : auction.nft;

  return {
    __typename: "Auction",
    ...auction,
    nft,
    bids: auction.bids?.map(bid),
    highestBid: bid(auction.highestBid),
    seller: user(auction.seller),
    winner: user(auction.winner),
  };
}

function sendJson(req, res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    // Echo the caller's origin so credentialed requests (`credentials: "include"`
    // on the bid POST) are not blocked; `*` is invalid with credentials.
    "access-control-allow-origin": req.headers.origin || "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    vary: "origin",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": req.headers.origin || "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      vary: "origin",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(req, res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/__reset") {
    auction = buildAuction();
    return sendJson(req, res, 200, auction);
  }

  if (req.method === "POST" && url.pathname === "/__scenario") {
    const body = await readBody(req);
    auction = buildAuction(body);
    return sendJson(req, res, 200, auction);
  }

  if (req.method === "POST" && url.pathname === "/graphql") {
    // Both the SSR page and any client query hit this endpoint; the e2e suite
    // only ever needs an auction by id.
    return sendJson(req, res, 200, { data: { auction: withTypenames(auction) } });
  }

  const auctionMatch = url.pathname.match(/^\/auctions\/([^/]+)$/);
  if (req.method === "GET" && auctionMatch) {
    return sendJson(req, res, 200, auction);
  }

  const bidMatch = url.pathname.match(/^\/auctions\/([^/]+)\/bids$/);
  if (req.method === "POST" && bidMatch) {
    const body = await readBody(req);
    const amount = Number(body.amount);
    const minimum = Number(auction.highestBid?.amount ?? auction.startPrice) + 0.01;

    if (!Number.isFinite(amount) || amount < minimum) {
      return sendJson(req, res, 400, { message: `Minimum bid is ${minimum.toFixed(2)} XLM` });
    }

    const placedBid = {
      id: `bid-${auction.bids.length + 1}`,
      amount: String(amount),
      bidderId: "user-e2e",
      bidder: { id: "user-e2e", username: "e2e-bidder", walletAddress: "GE2EBIDDER" },
      createdAt: new Date().toISOString(),
    };
    auction = {
      ...auction,
      bids: [placedBid, ...auction.bids],
      highestBid: placedBid,
      currentPrice: placedBid.amount,
    };
    return sendJson(req, res, 201, placedBid);
  }

  return sendJson(req, res, 404, { message: `No mock route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[e2e] mock backend listening on http://127.0.0.1:${PORT}`);
});
