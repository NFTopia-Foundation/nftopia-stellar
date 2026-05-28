"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Link2Off, Wallet } from "lucide-react";
import { connectFreighter } from "@/lib/stellar/wallet/freighter";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  LinkedWallet,
  fetchLinkedWallets,
  linkWalletWithChallenge,
  unlinkWallet,
} from "@/lib/services/profile";

export default function SettingsPage() {
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const getCurrentUser = useAuthStore((state) => state.getCurrentUser);

  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinkingAddress, setUnlinkingAddress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!authUser) {
      const storedUser = getCurrentUser();
      if (storedUser) setAuthUser(storedUser);
    }
  }, [authUser, getCurrentUser, setAuthUser]);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      setLoading(true);
      setMessage(null);

      try {
        const nextWallets = await fetchLinkedWallets();
        if (active) setWallets(nextWallets);
      } catch (error) {
        if (active) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Failed to load linked wallets.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWallets();
    return () => {
      active = false;
    };
  }, []);

  const handleLinkFreighter = async () => {
    setMessage(null);
    setLinking(true);

    try {
      const walletAddress = await connectFreighter();
      await linkWalletWithChallenge(walletAddress, "freighter");
      setWallets(await fetchLinkedWallets());
      setMessage({ type: "success", text: "Wallet linked successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to link wallet.",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (walletAddress: string) => {
    setMessage(null);
    setUnlinkingAddress(walletAddress);

    try {
      await unlinkWallet(walletAddress);
      setWallets(await fetchLinkedWallets());
      setMessage({ type: "success", text: "Wallet unlinked successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to unlink wallet.",
      });
    } finally {
      setUnlinkingAddress(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold text-nftopia-text">Settings</h1>

      {message && <StatusMessage type={message.type} text={message.text} />}

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-card-foreground">Linked Stellar Wallets</h2>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading wallets...</p>
        ) : wallets.length === 0 ? (
          <p className="mb-4 text-sm text-nftopia-subtext">No wallets linked.</p>
        ) : (
          <ul className="mb-5 space-y-3">
            {wallets.map((wallet) => (
              <li
                key={wallet.walletAddress}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm text-foreground">
                      {shortAddress(wallet.walletAddress)}
                    </span>
                    {wallet.isPrimary && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {wallet.walletProvider}
                    {wallet.createdAt ? ` · Linked ${new Date(wallet.createdAt).toLocaleDateString()}` : ""}
                  </p>
                </div>

                <button
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  onClick={() => handleUnlink(wallet.walletAddress)}
                  disabled={linking || unlinkingAddress === wallet.walletAddress}
                >
                  <Link2Off className="h-4 w-4" />
                  {unlinkingAddress === wallet.walletAddress ? "Unlinking..." : "Unlink"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          onClick={handleLinkFreighter}
          disabled={linking}
        >
          <Link2 className="h-4 w-4" />
          {linking ? "Linking..." : "Link Freighter Wallet"}
        </button>
      </section>
    </div>
  );
}

function StatusMessage({ type, text }: { type: "success" | "error"; text: string }) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  const classes =
    type === "success"
      ? "border-green-500/30 bg-green-900/30 text-green-300"
      : "border-red-500/30 bg-red-900/30 text-red-300";

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

