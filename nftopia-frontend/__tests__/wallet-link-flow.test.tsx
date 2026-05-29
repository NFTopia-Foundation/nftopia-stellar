import {
  fetchLinkedWallets,
  linkWalletWithChallenge,
  unlinkWallet,
} from "@/lib/services/profile";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { signMessage } from "@stellar/freighter-api";

jest.mock("@/lib/api/fetchWithAuth", () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock("@/lib/config", () => ({
  API_CONFIG: {
    baseUrl: "http://localhost:3000/api/v1",
  },
}));

jest.mock(
  "@stellar/freighter-api",
  () => ({
    signMessage: jest.fn(),
  }),
  { virtual: true }
);

const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>;
const mockSignMessage = signMessage as jest.MockedFunction<typeof signMessage>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("wallet link flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("links wallet through challenge, signature, and authenticated link request", async () => {
    const walletAddress = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234";

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
          sessionId: `nonce:${walletAddress}`,
          walletAddress,
          nonce: "nonce-12345678",
          message: "NFTopia Wallet Authentication\nNonce: nonce-12345678",
          expiresAt: "2026-05-28T12:00:00.000Z",
        })
    );
    mockSignMessage.mockResolvedValueOnce({
      signedMessage: "base64-signature",
      signerAddress: walletAddress,
    });
    mockFetchWithAuth.mockResolvedValueOnce(
      jsonResponse({
          success: true,
          wallet: {
            id: "wallet-1",
            walletAddress,
            walletProvider: "freighter",
            isPrimary: false,
          },
        })
    );

    await linkWalletWithChallenge(walletAddress, "freighter");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/auth/wallet/challenge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ walletAddress, walletProvider: "freighter" }),
      })
    );
    expect(mockSignMessage).toHaveBeenCalledWith(
      "NFTopia Wallet Authentication\nNonce: nonce-12345678",
      { address: walletAddress }
    );
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/auth/wallet/link",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          nonce: "nonce-12345678",
          signature: "base64-signature",
          walletProvider: "freighter",
        }),
      })
    );
  });

  it("fetches and unlinks wallets through authenticated backend contracts", async () => {
    const walletAddress = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234";

    mockFetchWithAuth
      .mockResolvedValueOnce(
        jsonResponse([
            {
              id: "wallet-1",
              walletAddress,
              walletProvider: "freighter",
              isPrimary: true,
              createdAt: "2026-05-28T10:00:00.000Z",
            },
          ])
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    const wallets = await fetchLinkedWallets();
    await unlinkWallet(walletAddress);

    expect(wallets).toHaveLength(1);
    expect(mockFetchWithAuth).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/v1/users/wallets",
      expect.objectContaining({ method: "GET" })
    );
    expect(mockFetchWithAuth).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/v1/auth/wallet/unlink",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ walletAddress }),
      })
    );
  });
});
