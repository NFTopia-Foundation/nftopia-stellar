"use client";

import { useState, useCallback } from "react";
import { WalletProvider } from "@/types/stellar";
import { requestAuthChallenge, buildSignMessage } from "@/lib/stellar/auth/nonce";
import { verifyWalletSignature } from "@/lib/stellar/auth/signature";
import { signWithFreighter } from "@/lib/stellar/wallet/freighter";
import { signMessageWithAlbedo } from "@/lib/stellar/wallet/albedo";
import { defaultNetwork } from "@/lib/stellar/client";

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
        const challenge = await requestAuthChallenge(publicKey);
        const message = buildSignMessage(publicKey, challenge.nonce);

        // 2. Sign the message with the appropriate wallet
        let signature: string;
        if (provider === "freighter") {
          // For auth, we sign a SEP-0010-style transaction XDR or a simple memo
          // Here we use freighter's signTransaction with a challenge transaction
          // The backend should issue a proper challenge TX; this is a simplified version
          signature = await signMessageViaFreighter(message, publicKey);
        } else if (provider === "albedo") {
          const result = await signMessageWithAlbedo(message);
          signature = result.signature;
        } else {
          throw new Error(`Signing with "${provider}" is not yet supported`);
        }

        // 3. Verify signature on the backend, get JWT
        const result = await verifyWalletSignature({
          publicKey,
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

/**
 * Freighter signs XDR transactions, not arbitrary strings.
 * For authentication, we encode the message as a minimal Stellar transaction.
 * The backend verifies by checking the signature against the challenge transaction.
 */
async function signMessageViaFreighter(message: string, publicKey: string): Promise<string> {
  const StellarSdk = await import("@stellar/stellar-sdk");
  const network = defaultNetwork;
  const server = new StellarSdk.Horizon.Server(
    network === "testnet"
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org"
  );

  try {
    const sourceAccount = await server.loadAccount(publicKey);
    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase:
        network === "testnet"
          ? StellarSdk.Networks.TESTNET
          : StellarSdk.Networks.PUBLIC,
    })
      .addMemo(StellarSdk.Memo.text(message.slice(0, 28))) // memo max 28 bytes
      .setTimeout(30)
      .build();

    const xdr = tx.toXDR();
    return await signWithFreighter(xdr, network);
  } catch {
    // Account not funded (testnet) — fall back to signing a pre-built challenge XDR if provided
    throw new Error(
      "Unable to build auth transaction. Ensure your Stellar account is funded."
    );
  }
}