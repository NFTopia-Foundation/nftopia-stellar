import { API_CONFIG } from "@/lib/config";
import { WalletProvider } from "@/types/stellar";
import { WalletAuthResult } from "@/types/auth";

export interface SignatureVerificationPayload {
  publicKey: string;
  signature: string;
  nonce: string;
  provider: WalletProvider;
  locale?: string;
}


export async function verifyWalletSignature(
  payload: SignatureVerificationPayload
): Promise<WalletAuthResult> {
  const res = await fetch(`${API_CONFIG.baseUrl}/auth/wallet/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Signature verification failed");
  }

  return res.json();
}

export async function linkWalletToAccount(
  payload: SignatureVerificationPayload,
  jwt: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_CONFIG.baseUrl}/auth/wallet/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to link wallet to account");
  }

  return res.json();
}