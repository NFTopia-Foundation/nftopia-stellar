import {
  connectWalletConnect,
  signWithWalletConnect,
  disconnectWalletConnect,
  isWalletConnectConnected,
  getWalletConnectAddress,
  getWalletConnectNetwork,
  parseStellarAddress,
  getChainForNetwork,
  getWalletConnectSessions,
  disconnectWalletConnectSession,
  disconnectAllWalletConnectSessions,
} from "@/lib/stellar/wallet/walletconnect";

const mockApproval = jest.fn();
const mockConnect = jest.fn();
const mockRequest = jest.fn();
const mockDisconnect = jest.fn();
const mockSessionGet = jest.fn();
const mockOn = jest.fn();

const mockClient = {
  connect: mockConnect,
  request: mockRequest,
  disconnect: mockDisconnect,
  on: mockOn,
  session: {
    get: mockSessionGet,
    values: [] as any[],
  },
};

jest.mock("@walletconnect/sign-client", () => ({
  SignClient: {
    init: jest.fn().mockResolvedValue(mockClient),
  },
}));

describe("lib/stellar/wallet/walletconnect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe("helper utilities", () => {
    it("parses stellar address correctly from CAIP-10 account string", () => {
      const caip = "stellar:pubnet:GBTESTADDRESS123456789";
      expect(parseStellarAddress(caip)).toBe("GBTESTADDRESS123456789");
    });

    it("returns correct chain for network", () => {
      expect(getChainForNetwork("mainnet")).toBe("stellar:pubnet");
      expect(getChainForNetwork("testnet")).toBe("stellar:testnet");
    });
  });

  describe("connectWalletConnect", () => {
    it("successfully creates pairing URI, waits for approval, and returns address", async () => {
      const mockUri = "wc:sample-pairing-uri@2?relay-protocol=irn";
      const mockSession = {
        topic: "session-topic-123",
        namespaces: {
          stellar: {
            accounts: ["stellar:testnet:GCONNECTACCOUNT123"],
            chains: ["stellar:testnet"],
          },
        },
      };

      mockConnect.mockResolvedValue({
        uri: mockUri,
        approval: mockApproval.mockResolvedValue(mockSession),
      });

      const displayUriCallback = jest.fn();

      const address = await connectWalletConnect("testnet", displayUriCallback);

      expect(displayUriCallback).toHaveBeenCalledWith(mockUri);
      expect(address).toBe("GCONNECTACCOUNT123");
      expect(sessionStorage.getItem("stellar_wc_session")).toContain("GCONNECTACCOUNT123");
      expect(sessionStorage.getItem("stellar_wc_session")).toContain("session-topic-123");
    });

    it("throws error when session has no stellar accounts", async () => {
      mockConnect.mockResolvedValue({
        uri: "wc:uri",
        approval: jest.fn().mockResolvedValue({
          topic: "session-topic-empty",
          namespaces: {
            stellar: {
              accounts: [],
            },
          },
        }),
      });

      await expect(connectWalletConnect("testnet")).rejects.toThrow(
        "No Stellar accounts found in approved WalletConnect session."
      );
    });

    it("handles user rejection gracefully with custom error message", async () => {
      mockConnect.mockResolvedValue({
        uri: "wc:uri",
        approval: jest.fn().mockRejectedValue(new Error("User rejected proposal")),
      });

      await expect(connectWalletConnect("testnet")).rejects.toThrow(
        "Connection request was rejected in your mobile wallet."
      );
    });
  });

  describe("signWithWalletConnect", () => {
    it("signs transaction XDR and returns signed XDR string", async () => {
      const sessionData = {
        topic: "session-topic-123",
        address: "GCONNECTACCOUNT123",
        network: "testnet" as const,
      };
      sessionStorage.setItem("stellar_wc_session", JSON.stringify(sessionData));

      mockSessionGet.mockReturnValue({
        topic: "session-topic-123",
        namespaces: {
          stellar: {
            accounts: ["stellar:testnet:GCONNECTACCOUNT123"],
            chains: ["stellar:testnet"],
          },
        },
      });

      mockRequest.mockResolvedValue({ signedTxXdr: "AAAA_SIGNED_TRANSACTION_XDR" });

      const signedXdr = await signWithWalletConnect("AAAA_UNSIGNED_XDR", "testnet");
      expect(signedXdr).toBe("AAAA_SIGNED_TRANSACTION_XDR");
      expect(mockRequest).toHaveBeenCalledWith({
        topic: "session-topic-123",
        chainId: "stellar:testnet",
        request: {
          method: "stellar_signXdr",
          params: {
            xdr: "AAAA_UNSIGNED_XDR",
            account: "GCONNECTACCOUNT123",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
        },
      });
    });

    it("throws when no active session is present", async () => {
      sessionStorage.clear();
      mockSessionGet.mockImplementation(() => {
        throw new Error("No matching key");
      });
      (mockClient.session as any).values = [];

      await expect(signWithWalletConnect("AAAA_XDR", "testnet")).rejects.toThrow(
        "No active WalletConnect session found."
      );
    });
  });

  describe("disconnectWalletConnect and session queries", () => {
    it("disconnects active session and clears storage", async () => {
      const sessionData = {
        topic: "session-topic-123",
        address: "GCONNECTACCOUNT123",
        network: "testnet" as const,
      };
      sessionStorage.setItem("stellar_wc_session", JSON.stringify(sessionData));
      mockSessionGet.mockReturnValue({ topic: "session-topic-123" });

      await disconnectWalletConnect();

      expect(mockDisconnect).toHaveBeenCalledWith({
        topic: "session-topic-123",
        reason: {
          code: 6000,
          message: "User disconnected session",
        },
      });
      expect(sessionStorage.getItem("stellar_wc_session")).toBeNull();
    });

    it("retrieves address and network from persisted session", async () => {
      const sessionData = {
        topic: "session-topic-456",
        address: "GPERSISTEDADDRESS",
        network: "mainnet" as const,
      };
      sessionStorage.setItem("stellar_wc_session", JSON.stringify(sessionData));
      mockSessionGet.mockReturnValue({ topic: "session-topic-456" });

      const isConnected = await isWalletConnectConnected();
      expect(isConnected).toBe(true);

      const address = await getWalletConnectAddress();
      expect(address).toBe("GPERSISTEDADDRESS");

      const network = await getWalletConnectNetwork();
      expect(network).toBe("mainnet");
    });
  });

  describe("getWalletConnectSessions", () => {
    function fakeSession(overrides: Partial<Record<string, any>> = {}) {
      return {
        topic: "topic-1",
        expiry: Math.floor(Date.now() / 1000) + 3600,
        namespaces: {
          stellar: {
            accounts: ["stellar:testnet:GSESSIONACCOUNT1"],
            chains: ["stellar:testnet"],
          },
        },
        requiredNamespaces: {},
        peer: {
          metadata: {
            name: "Example dApp",
            url: "https://example.com",
            icons: ["https://example.com/icon.png"],
          },
        },
        ...overrides,
      };
    }

    it("maps every SDK session into a summary, most recently connected first", async () => {
      (mockClient.session as any).values = [
        fakeSession({ topic: "topic-older" }),
        fakeSession({ topic: "topic-newer" }),
      ];

      // "topic-older" was tracked as connected before "topic-newer".
      localStorage.setItem(
        "stellar_wc_session_meta",
        JSON.stringify({ "topic-older": 1000, "topic-newer": 2000 }),
      );

      const sessions = await getWalletConnectSessions();

      expect(sessions.map((s) => s.topic)).toEqual(["topic-newer", "topic-older"]);
      expect(sessions[0]).toMatchObject({
        dappName: "Example dApp",
        dappIcon: "https://example.com/icon.png",
        dappUrl: "https://example.com",
        address: "GSESSIONACCOUNT1",
        network: "testnet",
        connectedAt: 2000,
      });
    });

    it("falls back to sorting by expiry when connectedAt is unknown", async () => {
      (mockClient.session as any).values = [
        fakeSession({ topic: "topic-a", expiry: 2000 }),
        fakeSession({ topic: "topic-b", expiry: 1000 }),
      ];

      const sessions = await getWalletConnectSessions();

      expect(sessions.map((s) => s.topic)).toEqual(["topic-a", "topic-b"]);
      expect(sessions.every((s) => s.connectedAt === null)).toBe(true);
    });

    it("marks the session matching the persisted active topic as current", async () => {
      (mockClient.session as any).values = [fakeSession({ topic: "topic-current" })];
      sessionStorage.setItem(
        "stellar_wc_session",
        JSON.stringify({ topic: "topic-current", address: "G1", network: "testnet" }),
      );

      const sessions = await getWalletConnectSessions();

      expect(sessions[0].isCurrent).toBe(true);
    });

    it("falls back to 'Unknown app' when peer metadata is missing", async () => {
      (mockClient.session as any).values = [
        fakeSession({ topic: "topic-anon", peer: { metadata: {} } }),
      ];

      const sessions = await getWalletConnectSessions();

      expect(sessions[0].dappName).toBe("Unknown app");
      expect(sessions[0].dappIcon).toBeNull();
    });
  });

  describe("disconnectWalletConnectSession", () => {
    it("disconnects only the given topic and clears its connected-at entry", async () => {
      localStorage.setItem(
        "stellar_wc_session_meta",
        JSON.stringify({ "topic-1": 1000, "topic-2": 2000 }),
      );
      mockDisconnect.mockResolvedValue(undefined);

      await disconnectWalletConnectSession("topic-1");

      expect(mockDisconnect).toHaveBeenCalledWith({
        topic: "topic-1",
        reason: { code: 6000, message: "User disconnected session" },
      });
      const meta = JSON.parse(localStorage.getItem("stellar_wc_session_meta") || "{}");
      expect(meta).toEqual({ "topic-2": 2000 });
    });

    it("clears the persisted active session only if its topic matches", async () => {
      sessionStorage.setItem(
        "stellar_wc_session",
        JSON.stringify({ topic: "topic-active", address: "G1", network: "testnet" }),
      );
      mockDisconnect.mockResolvedValue(undefined);

      await disconnectWalletConnectSession("topic-other");
      expect(sessionStorage.getItem("stellar_wc_session")).not.toBeNull();

      await disconnectWalletConnectSession("topic-active");
      expect(sessionStorage.getItem("stellar_wc_session")).toBeNull();
    });

    it("still cleans up local state when the SDK disconnect call rejects", async () => {
      localStorage.setItem(
        "stellar_wc_session_meta",
        JSON.stringify({ "topic-gone": 1000 }),
      );
      mockDisconnect.mockRejectedValue(new Error("No matching topic"));

      await disconnectWalletConnectSession("topic-gone");

      const meta = JSON.parse(localStorage.getItem("stellar_wc_session_meta") || "{}");
      expect(meta).toEqual({});
    });
  });

  describe("disconnectAllWalletConnectSessions", () => {
    it("disconnects every active session and clears all local state", async () => {
      (mockClient.session as any).values = [
        { topic: "topic-1" },
        { topic: "topic-2" },
      ];
      localStorage.setItem(
        "stellar_wc_session_meta",
        JSON.stringify({ "topic-1": 1000, "topic-2": 2000 }),
      );
      sessionStorage.setItem(
        "stellar_wc_session",
        JSON.stringify({ topic: "topic-1", address: "G1", network: "testnet" }),
      );
      mockDisconnect.mockResolvedValue(undefined);

      await disconnectAllWalletConnectSessions();

      expect(mockDisconnect).toHaveBeenCalledTimes(2);
      expect(mockDisconnect).toHaveBeenCalledWith({
        topic: "topic-1",
        reason: { code: 6000, message: "User disconnected session" },
      });
      expect(mockDisconnect).toHaveBeenCalledWith({
        topic: "topic-2",
        reason: { code: 6000, message: "User disconnected session" },
      });
      expect(localStorage.getItem("stellar_wc_session_meta")).toBeNull();
      expect(sessionStorage.getItem("stellar_wc_session")).toBeNull();
    });

    it("clears local state even when one session fails to disconnect", async () => {
      (mockClient.session as any).values = [{ topic: "topic-1" }, { topic: "topic-2" }];
      mockDisconnect.mockRejectedValueOnce(new Error("relay unreachable"));
      mockDisconnect.mockResolvedValueOnce(undefined);

      await disconnectAllWalletConnectSessions();

      expect(localStorage.getItem("stellar_wc_session_meta")).toBeNull();
    });
  });
});
