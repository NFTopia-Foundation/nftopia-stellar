import { API_CONFIG } from "@/lib/config";

export interface NonceChallenge {
  nonce: string;
  expiresAt: number;
  message: string;
}

export async function requestAuthChallenge(publicKey: string): Promise<NonceChallenge> {
  const res = await fetch(`${API_CONFIG.baseUrl}/auth/wallet/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ publicKey }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to request auth challenge");
  }

  const data = await res.json();

  return {
    nonce: data.nonce,
    expiresAt: data.expiresAt,
    message: buildSignMessage(publicKey, data.nonce),
  };
}

export function buildSignMessage(publicKey: string, nonce: string): string {
  return `NFTopia Authentication\nPublic Key: ${publicKey}\nNonce: ${nonce}`;
}

export function isNonceExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}