"use client";

import { CircuitBackground } from "@/components/circuit-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMarketplaceStore } from "@/features/marketplace/store/marketplaceStore";
import { useNFTStore } from "@/features/nft/store/nftStore";
import { useUserStore } from "@/features/user/store/userStore";
import { useAuth } from "@/lib/stores/auth-store";
import { connect } from "get-starknet";
import { KeyRound, LogIn, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";



export default function LoginPage() {
  const {
    requestNonce,
    verifySignature,
    loading,
    error: authError,
    clearError,
  } = useAuth();
  const [walletAddress, setWalletAddress] = useState("");
  const [nonce, setNonce] = useState("");
  const [connected, setConnected] = useState(false);
  const [signer, setSigner] = useState<any>(null);
  const [localError, setLocalError] = useState("");
  const [walletType, setWalletType] = useState<"argentx" | "braavos" | null>(
    null
  );

  const { t, locale } = useTranslation();

  const connectWallet = async () => {
    try {
      clearError();
      setLocalError("");
      const starknet = await connect({
        modalMode: "alwaysAsk",
      });

      if (!starknet || !starknet.isConnected) {
        throw new Error("Wallet not connected");
      }

      const account = await starknet.account;
      const address = account.address;

      // Detect wallet type
      const detectedType =
        starknet.id === "argentX"
          ? "argentx"
          : starknet.id === "braavos"
          ? "braavos"
          : null;

      if (!detectedType) {
        throw new Error("Unsupported wallet type");
      }

      setWalletAddress(address);
      setSigner(account);
      setWalletType(detectedType);
      setConnected(true);
    } catch (err) {
      console.error(err);
      setLocalError("Failed to connect to Starknet wallet.");
    }
  };

  const getNonce = async () => {
    if (!walletAddress) {
      setLocalError("Please connect your wallet first");
      return;
    }
    try {
      clearError();
      setLocalError("");
      const nonceValue = await requestNonce(walletAddress);
      setNonce(nonceValue);
    } catch (error) {
      console.error("Nonce request failed:", error);
      setLocalError("Failed to get nonce. Please try again.");
    }
  };

  const handleLogin = async () => {
    try {
      setLocalError("");
      clearError();

      // 1. Ensure wallet is connected
      if (!walletAddress || !signer || !walletType) {
        throw new Error("Wallet not connected");
      }

      // 2. Get nonce from backend
      if (!nonce) {
        await getNonce();
        return; // Wait for nonce to be set before proceeding
      }

      const typedData = {
        types: {
          StarkNetDomain: [
            { name: "name", type: "felt" },
            { name: "version", type: "felt" },
            { name: "chainId", type: "felt" },
          ],
          Message: [{ name: "nonce", type: "felt" }],
        },
        primaryType: "Message",
        domain: {
          name: "NFTopia",
          version: "1",
          chainId: "SN_SEPOLIA",
        },
        message: { nonce },
      };

      let signature: [string, string];
      if (walletType === "argentx") {
        const rawSignature = await signer.signMessage(typedData);
        console.log(rawSignature);
        signature = [rawSignature[2], rawSignature[3]];
      } else if (walletType === "braavos") {
        const rawSignature = await signer.signMessage(typedData);
        console.log(rawSignature);
        signature = [rawSignature[1], rawSignature[2]];
      } else {
        throw new Error("Unsupported wallet type");
      }

      await verifySignature(walletAddress, signature, nonce, walletType, locale);
    } catch (err) {
      console.error("Login failed:", err);
      setLocalError(err instanceof Error ? err.message : "Login failed");
    }
  };

  // Combine local errors and auth store errors
  const error = localError || authError;
  const authUser = useAuthStore((state) => state.user);
  const userProfile = useUserStore((state) => state.user);
  const nftCount = useNFTStore((state) => state.nfts.length);
  const marketplaceListings = useMarketplaceStore(
    (state) => state.listings.length
  );

  React.useEffect(() => {
    console.log("[LoginPage Zustand State]", {
      authUser,
      userProfile,
      nftCount,
      marketplaceListings,
    });
  }, [authUser, userProfile, nftCount, marketplaceListings]);

  return (
    <div className="h-[500px] text-white">
      <CircuitBackground />

      <div className="relative z-10  pb-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="border border-purple-500/20 rounded-xl p-8 bg-glass backdrop-blur-md shadow-lg">
            <div className="flex justify-center mb-8">
              <Image
                src="/nftopia-04.svg"
                alt="NFTopia Logo"
                width={200}
                height={60}
                className="h-auto"
              />
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-900/50 text-red-300 rounded-lg border border-red-500/30">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Wallet Address (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2 text-purple-300">
                 {t("login.walletAddress")}
                </label>
                <Input
                  type="text"
                  value={walletAddress}
                  readOnly
                  placeholder={t("login.inputPlaceholder")}
                  className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg px-4 py-3 text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="space-y-4">
                {!connected ? (
                  <Button
                    onClick={connectWallet}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                    disabled={loading}
                  >
                    <Wallet className="mr-2 h-5 w-5" />
                    {t("login.connectWallet")}
                  </Button>
                ) : (
                  <>
                    {!nonce ? (
                      <Button
                        onClick={getNonce}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-700 hover:to-purple-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                        disabled={loading}
                      >
                        <KeyRound className="mr-2 h-5 w-5" />
                        {t("login.getNonce")}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleLogin}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                        disabled={loading}
                      >
                        <LogIn className="mr-2 h-5 w-5" />
                        {loading ? t(`login.signingIn`) : t(`login.signAndLogin`)}
                      </Button>
                    )}
                  </>
                )}
              </div>

              <div className="text-center text-sm text-gray-400 mt-6">
                {t("login.dontHave")}{" "}
                <Link
                  href={`/${locale}/auth/register`}
                  className="text-purple-400 hover:text-purple-300"
                >
                  {t("login.registerWith")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
