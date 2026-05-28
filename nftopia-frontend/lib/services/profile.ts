import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { API_CONFIG } from "@/lib/config";
import { signMessageWithAlbedo } from "@/lib/stellar/wallet/albedo";
import { WalletProvider } from "@/types/stellar";

export interface ProfileUser {
  id?: string;
  address?: string;
  walletAddress?: string;
  email?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  website?: string;
  walletProvider?: string;
}

export interface UpdateProfilePayload {
  username?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  website?: string;
}

export interface LinkedWallet {
  id: string;
  walletAddress: string;
  walletProvider: string;
  isPrimary: boolean;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface WalletChallenge {
  sessionId: string;
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

function unwrapApiData<T>(payload: unknown): T {
  const typed = payload as { data?: { data?: T } | T };
  if (typed?.data && typeof typed.data === "object" && "data" in typed.data) {
    return (typed.data as { data: T }).data;
  }
  if ("data" in (typed || {})) {
    return typed.data as T;
  }
  return payload as T;
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorPayload = payload as { message?: string; error?: string };
    throw new Error(errorPayload.message || errorPayload.error || fallbackMessage);
  }

  return unwrapApiData<T>(payload);
}

export function cleanProfilePayload(values: UpdateProfilePayload): UpdateProfilePayload {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => value !== undefined && value !== "")
  ) as UpdateProfilePayload;
}

export async function fetchProfileByAddress(address: string): Promise<ProfileUser> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/users/${address}`, {
    method: "GET",
    credentials: "include",
  });

  return parseResponse<ProfileUser>(response, "Failed to load profile");
}

export async function updateMyProfile(
  walletAddress: string,
  payload: UpdateProfilePayload
): Promise<ProfileUser> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/users/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...jsonHeaders,
      "x-wallet-address": walletAddress,
    },
    body: JSON.stringify(cleanProfilePayload(payload)),
  });

  return parseResponse<ProfileUser>(response, "Failed to save profile");
}

export async function fetchLinkedWallets(): Promise<LinkedWallet[]> {
  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/users/wallets`, {
    method: "GET",
    credentials: "include",
    headers: jsonHeaders,
  });

  return parseResponse<LinkedWallet[]>(response, "Failed to load linked wallets");
}

export async function requestWalletChallenge(
  walletAddress: string,
  walletProvider?: WalletProvider
): Promise<WalletChallenge> {
  const response = await fetch(`${API_CONFIG.baseUrl}/auth/wallet/challenge`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ walletAddress, walletProvider }),
  });

  return parseResponse<WalletChallenge>(response, "Failed to request wallet challenge");
}

export async function signWalletChallenge(
  message: string,
  walletProvider: WalletProvider,
  walletAddress: string
): Promise<string> {
  if (walletProvider === "freighter") {
    const freighterApi = (await import("@stellar/freighter-api")) as {
      signMessage?: (
        message: string,
        opts: { address: string }
      ) => Promise<{ signedMessage: string | null; signerAddress?: string; error?: string }>;
    };

    if (!freighterApi.signMessage) {
      throw new Error("Freighter message signing is unavailable in this browser.");
    }

    const result = await freighterApi.signMessage(message, { address: walletAddress });
    if (result.error || !result.signedMessage) {
      throw new Error(result.error || "Freighter did not return a signature.");
    }

    return result.signedMessage;
  }

  if (walletProvider === "albedo") {
    const result = await signMessageWithAlbedo(message);
    if (result.publicKey !== walletAddress) {
      throw new Error("Signed wallet does not match the connected wallet.");
    }
    return result.signature;
  }

  throw new Error(`Wallet provider "${walletProvider}" does not support message signing yet.`);
}

export async function linkWalletWithChallenge(
  walletAddress: string,
  walletProvider: WalletProvider
): Promise<{ success: boolean; wallet: LinkedWallet }> {
  const challenge = await requestWalletChallenge(walletAddress, walletProvider);
  const signature = await signWalletChallenge(
    challenge.message,
    walletProvider,
    walletAddress
  );

  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/wallet/link`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      walletAddress,
      nonce: challenge.nonce,
      signature,
      walletProvider,
    }),
  });

  return parseResponse<{ success: boolean; wallet: LinkedWallet }>(
    response,
    "Failed to link wallet"
  );
}

export async function unlinkWallet(walletAddress: string): Promise<{ success: boolean }> {
  const requestInit: RequestInit = {
    method: "DELETE",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ walletAddress }),
  };

  const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/wallet/unlink`, requestInit);

  if (response.status === 404 || response.status === 405) {
    const legacyResponse = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/wallet/unlink`, {
      ...requestInit,
      method: "POST",
    });
    return parseResponse<{ success: boolean }>(legacyResponse, "Failed to unlink wallet");
  }

  return parseResponse<{ success: boolean }>(response, "Failed to unlink wallet");
}

