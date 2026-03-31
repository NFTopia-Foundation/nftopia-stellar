"use client";

import { useState } from "react";
import {
  Wallet,
  Link2,
  Link2Off,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStellarWallet } from "@/components/wallet/hooks/useStellarWallet";
import { useStellarAuth } from "@/components/wallet/hooks/useStellarAuth";
import { WalletModal } from "@/components/wallet/WalletModal";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { WalletNetworkStatus } from "@/components/wallet/WalletNetworkStatus";
import { linkWalletToAccount } from "@/lib/stellar/auth/signature";
import { getExplorerUrl } from "@/lib/stellar/network";
import { LinkedWallet } from "@/types/auth";


function useCurrentUser() {
  return {
    user: null as null | { id: string; email?: string; linkedWallets?: LinkedWallet[] },
    token: typeof window !== "undefined" ? localStorage.getItem("auth_token") : null,
  };
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, token } = useCurrentUser();
  const linkedWallets: LinkedWallet[] = user?.linkedWallets ?? [];

  const {
    connected,
    address,
    provider,
    network,
    connect,
    disconnect,
    clearError,
  } = useStellarWallet();

  const { authenticateWithWallet, loading: authLoading } = useStellarAuth();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const handleLinkWallet = async () => {
    if (!address || !provider || !token) {
      setLinkError("Connect your wallet first, and make sure you are logged in.");
      return;
    }

    setLinking(true);
    setLinkError(null);
    setLinkSuccess(null);

    try {
      // 1. Auth-sign to prove ownership
      const result = await authenticateWithWallet(address, provider);

      // 2. Link to account
      await linkWalletToAccount(
        { publicKey: address, signature: "", nonce: "", provider },
        token
      );

      setLinkSuccess(`Wallet ${address.slice(0, 6)}…${address.slice(-4)} linked successfully.`);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link wallet.");
    } finally {
      setLinking(false);
    }
  };

  const isAlreadyLinked = linkedWallets.some((w) => w.address === address);

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("profile.title") || "Profile"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("profile.subtitle") || "Manage your account and linked wallets"}
          </p>
        </div>

        {/* Linked wallets section */}
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-card-foreground">
                {t("profile.linkedWallets") || "Linked Stellar Wallets"}
              </h2>
            </div>
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("profile.addWallet") || "Add Wallet"}
            </button>
          </div>

          {/* Feedback banners */}
          {linkError && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {linkError}
            </div>
          )}
          {linkSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-green-900/30 border border-green-500/30 text-green-300 text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {linkSuccess}
            </div>
          )}

          {/* Existing linked wallets */}
          {linkedWallets.length > 0 ? (
            <div className="space-y-3 mb-5">
              {linkedWallets.map((w) => (
                <LinkedWalletRow key={w.address} wallet={w} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-5">
              {t("profile.noWallets") ||
                "No wallets linked yet. Connect a Stellar wallet to enable wallet-based login and NFT transactions."}
            </p>
          )}

          {/* Currently connected wallet — link prompt */}
          {connected && address && (
            <div className="border border-purple-500/20 rounded-lg p-4 bg-purple-500/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("profile.connectedWallet") || "Connected Wallet"}
                  </p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">
                    {address}
                  </p>
                </div>
                <WalletNetworkStatus network={network} />
              </div>

              {/* Balance */}
              <WalletBalance address={address} network={network} className="mb-4" />

              <div className="flex gap-2">
                {!isAlreadyLinked && (
                  <button
                    onClick={handleLinkWallet}
                    disabled={linking || authLoading}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {linking || authLoading ? "Linking…" : t("profile.linkWallet") || "Link to Account"}
                  </button>
                )}
                <button
                  onClick={disconnect}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Link2Off className="h-4 w-4" />
                  {t("connectWallet.disconnect") || "Disconnect"}
                </button>
              </div>

              {isAlreadyLinked && (
                <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  This wallet is already linked to your account.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}

function LinkedWalletRow({ wallet }: { wallet: LinkedWallet }) {
  const network = wallet.address.startsWith("G") ? "mainnet" : "testnet";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Wallet className="h-4 w-4 text-purple-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-mono text-foreground truncate">
              {wallet.address.slice(0, 6)}…{wallet.address.slice(-6)}
            </p>
            {wallet.isPrimary && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                Primary
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {wallet.provider} · Linked {new Date(wallet.linkedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <a
        href={getExplorerUrl(network as "testnet" | "mainnet", undefined, wallet.address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-purple-400 hover:text-purple-300 transition-colors ml-2"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}