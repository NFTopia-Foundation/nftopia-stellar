import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end coverage for the auction bidding journey on
 * `app/[locale]/marketplace/auction/[auctionId]/AuctionDetailClient.tsx`.
 *
 * The auction route is server-rendered from GraphQL, so the deterministic
 * fixture backend in `e2e/mock-backend.mjs` supplies `initialAuction` (started
 * by `playwright.config.ts` when `E2E_MOCK_BACKEND=1`). Everything the browser
 * does afterwards is stubbed per test:
 *   - REST bid placement / refetch via `page.route`
 *   - the `auctionBidPlaced` subscription via `page.routeWebSocket`
 * so the suite covers bid placement, being outbid, and settlement without
 * depending on a live backend or wall-clock timing. The Freighter extension is
 * stubbed per test by `connectWallet` below.
 */

const MOCK_API = process.env.E2E_MOCK_API_URL || "http://127.0.0.1:4321";
/**
 * Must satisfy the detail route's id guard (`utils/id-validation.ts` accepts a
 * UUID or a numeric id) — the route calls `notFound()` before it ever queries,
 * and it must match the id the fixture backend serves.
 */
const AUCTION_ID = "3f9c1b2a-4d5e-4f6a-8b7c-9d0e1f2a3b4c";
const AUCTION_PATH = `/en/marketplace/auction/${AUCTION_ID}`;

/** Wallet that the `stellar-wallet-store` localStorage seed connects. */
const BIDDER_ADDRESS = "GBIDDER0000000000000000000000000000000000000000000000000";
const RIVAL_ADDRESS = "GRIVAL00000000000000000000000000000000000000000000000000";

interface MockBid {
  id: string;
  amount: string;
  bidderId: string;
  createdAt: string;
  bidder: { id: string; username: string; walletAddress: string };
}

const bidderUser = {
  id: "user-e2e",
  username: "e2e-bidder",
  walletAddress: BIDDER_ADDRESS,
};
const rivalUser = {
  id: "user-rival",
  username: "rival",
  walletAddress: RIVAL_ADDRESS,
};

/**
 * Boot the app as a connected Freighter wallet.
 *
 * A localStorage seed on its own is not enough, which is why this helper also
 * stands in for the extension:
 *
 *   1. `StellarWalletProvider` rehydrates a persisted `freighter` session on
 *      mount and calls `setDisconnected()` the moment `isFreighterConnected()`
 *      reports false — which is always the case in a bare Chromium, so the
 *      seeded session survives for only one paint.
 *   2. `@stellar/freighter-api` v6 resolves `isConnected()` straight from
 *      `window.freighter`; everything else is a `window.postMessage`
 *      handshake with the extension that gives up after 2s with
 *      `isConnected: false`.
 *
 * The stub answers only the identity/network handshakes: this flow never signs
 * anything, because the bid POST is stubbed with `page.route`.
 */
async function connectWallet(page: Page, address = BIDDER_ADDRESS): Promise<void> {
  await page.addInitScript((seededAddress) => {
    // 1. `isConnected()` short-circuits to `{ isConnected: window.freighter }`.
    (window as unknown as { freighter: boolean }).freighter = true;

    // 2. Answer the extension handshakes. Requests carry `messageId`; the v6
    //    responder check reads `messagedId` (sic) off the reply, so echo both.
    window.addEventListener("message", (event: MessageEvent) => {
      const request = event.data as
        | { source?: string; type?: string; messageId?: number }
        | null;
      if (!request || request.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

      const respond = (payload: Record<string, unknown>) => {
        window.postMessage(
          {
            source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
            messageId: request.messageId,
            messagedId: request.messageId,
            ...payload,
          },
          window.location.origin,
        );
      };

      switch (request.type) {
        case "REQUEST_CONNECTION_STATUS":
          respond({ isConnected: true, publicKey: seededAddress });
          break;
        case "REQUEST_PUBLIC_KEY":
        case "REQUEST_ACCESS":
          respond({ publicKey: seededAddress, isConnected: true });
          break;
        case "REQUEST_NETWORK":
        case "REQUEST_NETWORK_DETAILS":
          respond({
            network: "TESTNET",
            networkDetails: {
              network: "TESTNET",
              networkName: "Testnet",
              networkUrl: "https://horizon-testnet.stellar.org",
              networkPassphrase: "Test SDF Network ; September 2015",
            },
          });
          break;
        case "REQUEST_ALLOWED_STATUS":
          respond({ isAllowed: true });
          break;
        default:
          respond({});
      }
    });

    // 3. Persisted zustand state, so the bid form is connected on first paint.
    window.localStorage.setItem(
      "stellar-wallet-store",
      JSON.stringify({
        state: {
          address: seededAddress,
          provider: "freighter",
          network: "testnet",
          connected: true,
        },
        version: 0,
      }),
    );
  }, address);
}

/** Replace the auction the server component will render. */
async function setScenario(
  request: APIRequestContext,
  scenario: Record<string, unknown>,
): Promise<void> {
  const response = await request.post(`${MOCK_API}/__scenario`, { data: scenario });
  expect(response.ok()).toBeTruthy();
}

/**
 * Open the auction detail route and fail fast if the server rendered the
 * not-found page. Without the status assertion a fixture/validator mismatch
 * reads as four unrelated element timeouts.
 */
async function openAuction(page: Page): Promise<void> {
  const response = await page.goto(AUCTION_PATH);
  expect(response?.status()).toBe(200);
}

/**
 * Answer the `OnAuctionBidPlaced` subscription with the given bids. Playwright
 * intercepts the WebSocket before it reaches the network, so the client sees a
 * deterministic push instead of waiting out the 15s polling fallback.
 */
async function mockBidSubscription(page: Page, bids: MockBid[]): Promise<void> {
  await page.routeWebSocket(/\/graphql(?:\?.*)?$/, (webSocket) => {
    webSocket.onMessage((raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === "connection_init") {
        webSocket.send(JSON.stringify({ type: "connection_ack" }));
        return;
      }
      if (message.type === "subscribe") {
        for (const bid of bids) {
          webSocket.send(
            JSON.stringify({
              id: message.id,
              type: "next",
              payload: { data: { auctionBidPlaced: bid } },
            }),
          );
        }
      }
    });
  });
}

function bid(overrides: Partial<MockBid> & { amount: string }): MockBid {
  return {
    id: `bid-${overrides.amount}`,
    bidderId: bidderUser.id,
    bidder: bidderUser,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test.describe("auction bid flow", () => {
  test.beforeEach(async ({ page, request }) => {
    // Fresh auction for every test; individual tests override the scenario.
    await request.post(`${MOCK_API}/__reset`);
    await connectWallet(page);
  });

  test("places a bid and reflects it as the current highest bid", async ({ page, request }) => {
    await setScenario(request, { status: "ACTIVE", currentPrice: "100" });

    await openAuction(page);

    // The wallet seed renders the bidding form instead of the connect prompt.
    await expect(page.getByRole("button", { name: "Place Bid" })).toBeVisible();
    await expect(page.getByText("Minimum bid: 100.01 XLM")).toBeVisible();

    await page.getByPlaceholder("Enter bid amount").fill("125");
    await page.getByRole("button", { name: "Place Bid" }).click();

    await expect(page.getByText("Bid placed successfully!")).toBeVisible();
    // The component refetches the auction 1s after a successful POST; the mock
    // backend returns the accepted bid as the new highest.
    await expect(page.getByText("Minimum bid: 125.01 XLM")).toBeVisible();
    await expect(page.getByText("HIGHEST")).toBeVisible();
    await expect(page.getByText("125", { exact: true }).first()).toBeVisible();
  });

  test("shows the outbid alert when a rival raises the bid", async ({ page, request }) => {
    const myBid = bid({ amount: "120", id: "bid-1", bidderId: bidderUser.id, bidder: bidderUser });
    await setScenario(request, {
      status: "ACTIVE",
      currentPrice: "120",
      highestBid: myBid,
      bids: [myBid],
    });

    await mockBidSubscription(page, [
      bid({ amount: "150", id: "bid-2", bidderId: rivalUser.id, bidder: rivalUser }),
    ]);

    await openAuction(page);

    const alert = page.getByTestId("outbid-notification");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("You've been outbid!");
    await expect(alert).toContainText("150 XLM");
  });

  test("reflects a win when the connected wallet settles as the winner", async ({ page, request }) => {
    const winningBid = bid({ amount: "150", id: "bid-win", bidderId: bidderUser.id, bidder: bidderUser });
    await setScenario(request, {
      status: "SETTLED",
      endTime: new Date(Date.now() - 60_000).toISOString(),
      currentPrice: "150",
      winnerId: bidderUser.id,
      winner: bidderUser,
      highestBid: winningBid,
      bids: [winningBid],
    });

    await openAuction(page);

    await expect(page.getByText("This auction has ended")).toBeVisible();
    await expect(page.getByText("Winner")).toBeVisible();
    await expect(page.getByText("e2e-bidder").first()).toBeVisible();
    await expect(page.getByText("Winning Bid: 150 XLM")).toBeVisible();
  });

  test("reflects a loss when another wallet settles as the winner", async ({ page, request }) => {
    const rivalBid = bid({ amount: "200", id: "bid-rival", bidderId: rivalUser.id, bidder: rivalUser });
    await setScenario(request, {
      status: "SETTLED",
      endTime: new Date(Date.now() - 60_000).toISOString(),
      currentPrice: "200",
      winnerId: rivalUser.id,
      winner: rivalUser,
      highestBid: rivalBid,
      bids: [rivalBid],
    });

    await openAuction(page);

    await expect(page.getByText("This auction has ended")).toBeVisible();
    await expect(page.getByText("Winning Bid: 200 XLM")).toBeVisible();
    // The connected wallet is not the winner, so the settlement banner names
    // the rival instead.
    await expect(page.getByText("rival", { exact: true }).first()).toBeVisible();
  });
});
