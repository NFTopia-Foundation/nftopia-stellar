import { API_CONFIG } from "@/lib/config";
import { WalletProvider } from "@/types/stellar";

export interface NonceChallenge {
  nonce: string;
  expiresAt: number;
  message: string;
}

export async function requestAuthChallenge(walletAddress: string, walletProvider?: WalletProvider): Promise<NonceChallenge> {
  const res = await fetch(`${API_CONFIG.baseUrl}/auth/wallet/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ walletAddress, walletProvider }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to request auth challenge");
  }

  const data = await res.json();

  return {
    nonce: data.data.data.nonce,
    expiresAt: data.data.data.expiresAt,
    message: data.data.data.message,
  };
}

export function buildSignMessage(walletAddress: string, nonce: string): string {
  return `NFTopia Authentication\nPublic Key: ${walletAddress}\nNonce: ${nonce}`;
}

export function isNonceExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}