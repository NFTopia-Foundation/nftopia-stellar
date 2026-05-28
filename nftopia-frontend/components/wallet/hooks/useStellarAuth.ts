"use client";

import { useState, useCallback } from "react";
import { WalletProvider } from "@/types/stellar";
import { requestAuthChallenge, buildSignMessage } from "@/lib/stellar/auth/nonce";
import { verifyWalletSignature } from "@/lib/stellar/auth/signature";
import { signMessageWithFreighter } from "@/lib/stellar/wallet/freighter";
import { signMessageWithAlbedo } from "@/lib/stellar/wallet/albedo";

interface WalletAuthState {
  loading: boolean;
  error: string | null;
}

export function useStellarAuth() {
  const [state, setState] = useState<WalletAuthState>({
    loading: false,
    error: null,
  });

  const authenticateWithWallet = useCallback(
    async (
      publicKey: string,
      provider: WalletProvider,
      onSuccess?: (token: string) => void
    ) => {
      setState({ loading: true, error: null });
      try {
        // 1. Request challenge from backend
        const challenge = await requestAuthChallenge(publicKey, provider);
        const message = challenge.message;

        // 2. Sign the message with the appropriate wallet
        let signature: string;
        if (provider === "freighter") {
          signature = await signMessageWithFreighter(message);
        } else if (provider === "albedo") {
          const result = await signMessageWithAlbedo(message);
          signature = result.signature;
        } else {
          throw new Error(`Signing with "${provider}" is not yet supported`);
        }

        // 3. Verify signature on the backend, get JWT
        const result = await verifyWalletSignature({
          walletAddress: publicKey,
          signature,
          nonce: challenge.nonce,
          provider,
        });

        // 4. Persist token
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", result.token);
        }

        onSuccess?.(result.token);
        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        setState({ loading: false, error: message });
        throw err;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    ...state,
    authenticateWithWallet,
    clearError,
  };
}
