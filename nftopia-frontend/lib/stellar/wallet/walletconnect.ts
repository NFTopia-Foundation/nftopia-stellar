import { StellarNetwork } from "@/types/stellar";
import { getNetworkPassphrase } from "@/lib/stellar/client";
import type { ISignClient, SessionTypes } from "@walletconnect/types";

const WC_SESSION_KEY = "stellar_wc_session";
const WC_SESSION_META_KEY = "stellar_wc_session_meta";
const DEFAULT_PROJECT_ID = "8a5542a1b9e15f3e99097e3a9c7b2a11";

let signClientInstance: ISignClient | null = null;
let initPromise: Promise<ISignClient> | null = null;

export interface WalletConnectSessionData {
  topic: string;
  address: string;
  network: StellarNetwork;
}

export function getWalletConnectProjectId(): string {
  return (
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    DEFAULT_PROJECT_ID
  );
}

export async function getSignClient(): Promise<ISignClient> {
  if (signClientInstance) {
    return signClientInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const { SignClient } = await import("@walletconnect/sign-client");
      const projectId = getWalletConnectProjectId();

      const client = await SignClient.init({
        projectId,
        metadata: {
          name: "NFTopia",
          description: "Decentralized NFT Marketplace on Stellar",
          url: typeof window !== "undefined" ? window.location.origin : "https://nftopia.app",
          icons: ["https://nftopia.app/icon.png"],
        },
      });

      if (typeof (client as any).on === "function") {
        client.on("session_delete", (event) => {
          const persisted = getPersistedSession();
          if (persisted?.topic === event.topic) {
            clearPersistedSession();
          }
        });

        client.on("session_expire", (event) => {
          const persisted = getPersistedSession();
          if (persisted?.topic === event.topic) {
            clearPersistedSession();
          }
        });
      }

      signClientInstance = client;
      return client;
    } catch (err: any) {
      initPromise = null;
      throw new Error(
        err?.message ||
          "Failed to initialize WalletConnect. Please verify NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local."
      );
    }
  })();

  return initPromise;
}

export function getChainForNetwork(network: StellarNetwork): string {
  return network === "mainnet" ? "stellar:pubnet" : "stellar:testnet";
}

export function parseStellarAddress(accountString: string): string {
  const parts = accountString.split(":");
  return parts[parts.length - 1];
}

export function getPersistedSession(): WalletConnectSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(WC_SESSION_KEY) ||
      localStorage.getItem(WC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletConnectSessionData;
  } catch {
    return null;
  }
}

export function persistSession(data: WalletConnectSessionData): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(data);
  sessionStorage.setItem(WC_SESSION_KEY, json);
  localStorage.setItem(WC_SESSION_KEY, json);
}

export function clearPersistedSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(WC_SESSION_KEY);
  localStorage.removeItem(WC_SESSION_KEY);
}

/**
 * Local bookkeeping of when each session topic was connected, keyed by
 * topic. The WalletConnect SDK's SessionTypes.Struct carries `expiry` but no
 * creation timestamp, so this is the only source of truth for "connected
 * at" - populated going forward by connectWalletConnect(). A session that
 * predates this tracking (or was approved outside this app) simply has no
 * entry here; callers fall back to the session's expiry in that case.
 */
type SessionConnectedAtMap = Record<string, number>;

function readSessionConnectedAtMap(): SessionConnectedAtMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WC_SESSION_META_KEY);
    return raw ? (JSON.parse(raw) as SessionConnectedAtMap) : {};
  } catch {
    return {};
  }
}

function writeSessionConnectedAtMap(map: SessionConnectedAtMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WC_SESSION_META_KEY, JSON.stringify(map));
}

function recordSessionConnectedAt(topic: string): void {
  const map = readSessionConnectedAtMap();
  map[topic] = Date.now();
  writeSessionConnectedAtMap(map);
}

function removeSessionConnectedAt(topic: string): void {
  const map = readSessionConnectedAtMap();
  if (topic in map) {
    delete map[topic];
    writeSessionConnectedAtMap(map);
  }
}

function clearSessionConnectedAtMap(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WC_SESSION_META_KEY);
}

export async function getActiveWCSession(): Promise<SessionTypes.Struct | null> {
  const client = await getSignClient();
  const persisted = getPersistedSession();

  if (persisted?.topic) {
    try {
      const session = client.session.get(persisted.topic);
      if (session) return session;
    } catch {
      // Session not found in client
    }
  }

  const sessions = client.session.values;
  if (sessions && sessions.length > 0) {
    return sessions[sessions.length - 1];
  }

  return null;
}

export async function connectWalletConnect(
  network: StellarNetwork,
  onDisplayUri?: (uri: string) => void
): Promise<string> {
  const client = await getSignClient();
  const chain = getChainForNetwork(network);

  const requiredNamespaces = {
    stellar: {
      methods: ["stellar_signXdr"],
      chains: [chain],
      events: [],
    },
  };

  try {
    const connectPromise = client.connect({ requiredNamespaces });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "WalletConnect relay connection timed out. Please check your internet connection or try connecting via a VPN if your regional ISP restricts WalletConnect relay WebSocket traffic."
          )
        );
      }, 30000);
    });

    const { uri, approval } = await Promise.race([connectPromise, timeoutPromise]);

    if (uri && onDisplayUri) {
      onDisplayUri(uri);
    }

    const session = await approval();

    // Extract address from namespaces
    const stellarNamespace = session.namespaces?.stellar;
    if (!stellarNamespace || !stellarNamespace.accounts || stellarNamespace.accounts.length === 0) {
      throw new Error("No Stellar accounts found in approved WalletConnect session.");
    }

    const fullAccount = stellarNamespace.accounts[0];
    const address = parseStellarAddress(fullAccount);

    if (!address) {
      throw new Error("Invalid Stellar address received from WalletConnect.");
    }

    persistSession({
      topic: session.topic,
      address,
      network,
    });
    recordSessionConnectedAt(session.topic);

    return address;
  } catch (err: any) {
    if (err?.message?.includes("User rejected") || err?.code === 5000) {
      throw new Error("Connection request was rejected in your mobile wallet.");
    }
    throw new Error(err?.message || "Failed to establish WalletConnect session.");
  }
}

export async function signWithWalletConnect(
  transactionXdr: string,
  network: StellarNetwork
): Promise<string> {
  const client = await getSignClient();
  const session = await getActiveWCSession();

  if (!session) {
    throw new Error("No active WalletConnect session found. Please reconnect your wallet.");
  }

  const chain = getChainForNetwork(network);
  const persisted = getPersistedSession();
  const address = persisted?.address || parseStellarAddress(session.namespaces.stellar?.accounts?.[0] || "");
  const networkPassphrase = getNetworkPassphrase(network);

  try {
    const response = await client.request<any>({
      topic: session.topic,
      chainId: chain,
      request: {
        method: "stellar_signXdr",
        params: {
          xdr: transactionXdr,
          account: address,
          networkPassphrase,
        },
      },
    });

    if (typeof response === "string") {
      return response;
    }

    if (response?.signedTxXdr) {
      return response.signedTxXdr;
    }

    if (response?.signedXdr) {
      return response.signedXdr;
    }

    if (response?.xdr) {
      return response.xdr;
    }

    throw new Error("Invalid response format received from WalletConnect signing request.");
  } catch (err: any) {
    if (err?.message?.includes("User rejected") || err?.code === 5000) {
      throw new Error("Transaction signing was rejected by user.");
    }
    throw new Error(err?.message || "WalletConnect signing failed.");
  }
}

export async function disconnectWalletConnect(): Promise<void> {
  try {
    const client = await getSignClient();
    const session = await getActiveWCSession();

    if (session) {
      await client.disconnect({
        topic: session.topic,
        reason: {
          code: 6000,
          message: "User disconnected session",
        },
      });
      removeSessionConnectedAt(session.topic);
    }
  } catch {
    // Ignore error if already disconnected
  } finally {
    clearPersistedSession();
  }
}

/**
 * One WalletConnect session as the session-management UI renders it.
 * `connectedAt` is only known for sessions this app itself established
 * (see recordSessionConnectedAt) - null means it predates that tracking, in
 * which case the UI falls back to `expiresAt`.
 */
export interface WalletConnectSessionSummary {
  topic: string;
  dappName: string;
  dappIcon: string | null;
  dappUrl: string | null;
  address: string | null;
  network: StellarNetwork;
  /** ms epoch */
  expiresAt: number;
  /** ms epoch, or null if this session predates connected-at tracking */
  connectedAt: number | null;
  /** Whether this is the session currently used for signing requests. */
  isCurrent: boolean;
}

function toSessionSummary(
  session: SessionTypes.Struct,
  currentTopic: string | undefined,
  connectedAtByTopic: SessionConnectedAtMap,
): WalletConnectSessionSummary {
  const fullAccount = session.namespaces?.stellar?.accounts?.[0];
  const chain =
    session.namespaces?.stellar?.chains?.[0] ||
    session.requiredNamespaces?.stellar?.chains?.[0] ||
    "";

  return {
    topic: session.topic,
    dappName: session.peer?.metadata?.name || "Unknown app",
    dappIcon: session.peer?.metadata?.icons?.[0] || null,
    dappUrl: session.peer?.metadata?.url || null,
    address: fullAccount ? parseStellarAddress(fullAccount) : null,
    network: chain.includes("pubnet") ? "mainnet" : "testnet",
    expiresAt: session.expiry * 1000,
    connectedAt: connectedAtByTopic[session.topic] ?? null,
    isCurrent: currentTopic === session.topic,
  };
}

/**
 * Lists every WalletConnect session the SDK currently holds (not just the
 * one this app is actively signing with) so the user can audit and revoke
 * stale pairings. Most recently connected first; sessions with no tracked
 * connectedAt sort by expiry instead.
 */
export async function getWalletConnectSessions(): Promise<WalletConnectSessionSummary[]> {
  const client = await getSignClient();
  const currentTopic = getPersistedSession()?.topic;
  const connectedAtByTopic = readSessionConnectedAtMap();

  return client.session.values
    .map((session) => toSessionSummary(session, currentTopic, connectedAtByTopic))
    .sort((a, b) => (b.connectedAt ?? b.expiresAt) - (a.connectedAt ?? a.expiresAt));
}

/** Revokes a single WalletConnect session by topic. */
export async function disconnectWalletConnectSession(topic: string): Promise<void> {
  const client = await getSignClient();
  try {
    await client.disconnect({
      topic,
      reason: { code: 6000, message: "User disconnected session" },
    });
  } catch {
    // Already gone on the relay/peer side - still clean up local state below.
  } finally {
    removeSessionConnectedAt(topic);
    if (getPersistedSession()?.topic === topic) {
      clearPersistedSession();
    }
  }
}

/** Revokes every active WalletConnect session. */
export async function disconnectAllWalletConnectSessions(): Promise<void> {
  const client = await getSignClient();
  const topics = client.session.values.map((session) => session.topic);
  await Promise.allSettled(topics.map((topic) => disconnectWalletConnectSession(topic)));
  // Belt-and-suspenders: guarantees a clean slate even if a topic above
  // failed before its individual cleanup ran.
  clearSessionConnectedAtMap();
  clearPersistedSession();
}

export async function isWalletConnectConnected(): Promise<boolean> {
  try {
    const session = await getActiveWCSession();
    return !!session;
  } catch {
    return false;
  }
}

export async function getWalletConnectAddress(): Promise<string | null> {
  const persisted = getPersistedSession();
  if (persisted?.address) return persisted.address;

  const session = await getActiveWCSession();
  if (!session) return null;

  const fullAccount = session.namespaces?.stellar?.accounts?.[0];
  if (!fullAccount) return null;

  return parseStellarAddress(fullAccount);
}

export async function getWalletConnectNetwork(): Promise<StellarNetwork> {
  const persisted = getPersistedSession();
  if (persisted?.network) return persisted.network;

  const session = await getActiveWCSession();
  if (!session) return "testnet";

  const chain = session.namespaces?.stellar?.chains?.[0] || "";
  return chain.includes("pubnet") ? "mainnet" : "testnet";
}