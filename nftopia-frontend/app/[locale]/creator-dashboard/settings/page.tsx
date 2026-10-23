"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Coins,
  Link2,
  Link2Off,
  Wallet,
} from "lucide-react";
import { connectFreighter } from "@/lib/stellar/wallet/freighter";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAuthContext } from "@/lib/context/AuthContext";
import {
  LinkedWallet,
  fetchLinkedWallets,
  linkWalletWithChallenge,
  unlinkWallet,
} from "@/lib/services/profile";
import { useDisplayCurrency, useNotifications } from "@/lib/stores/preferences-store";
import { DISPLAY_CURRENCY_OPTIONS } from "@/lib/currency";
import type { DisplayCurrency } from "@/lib/stores/types";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-notifications";

export default function SettingsPage() {
  // Sync state cleanly with the global user stores from main branch
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const getCurrentUser = useAuthStore((state) => state.getCurrentUser);

  const { t } = useTranslation();
  const { currency: displayCurrency, setCurrency: setDisplayCurrency } =
    useDisplayCurrency();

  const { notifications, setNotifications } = useNotifications();
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const pushSupported = isPushSupported();

  useEffect(() => {
    if (!pushSupported) return;
    getExistingPushSubscription().then((subscription) => {
      setPushSubscribed(Boolean(subscription));
    });
  }, [pushSupported]);

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        setNotifications({ push: false });
      } else {
        const subscription = await subscribeToPush();
        if (subscription) {
          setPushSubscribed(true);
          setNotifications({ push: true });
        }
      }
    } catch {
      setMessage({
        type: "error",
        text: t("pushNotifications.subscribeError"),
      });
    } finally {
      setPushBusy(false);
    }
  };

  // Fallback engine check for structural environment context layers
  const context = useAuthContext() || {};

  // Local state orchestration tracking matching upstream branch expectation
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinkingAddress, setUnlinkingAddress] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Reactivity lifecycles for account synchronizers
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
            text:
              error instanceof Error
                ? error.message
                : "Failed to load linked wallets.",
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

      // Execute the direct cryptographic challenge workflow required upstream
      if (typeof context.linkWallet === "function") {
        await context.linkWallet(walletAddress, "freighter");
      } else {
        await linkWalletWithChallenge(walletAddress, "freighter");
      }

      // Re-fetch datasets smoothly to preserve component tracking loop logic
      const freshWallets = await fetchLinkedWallets();
      setWallets(freshWallets);
      setMessage({ type: "success", text: "Wallet linked successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to link wallet.",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (walletAddress: string) => {
    setMessage(null);
    setUnlinkingAddress(walletAddress);

    try {
      if (typeof context.unlinkWallet === "function") {
        await context.unlinkWallet(walletAddress);
      } else {
        await unlinkWallet(walletAddress);
      }

      const freshWallets = await fetchLinkedWallets();
      setWallets(freshWallets);
      setMessage({ type: "success", text: "Wallet unlinked successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to unlink wallet.",
      });
    } finally {
      setUnlinkingAddress(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 min-h-screen bg-background">
      <h1 className="mb-6 text-3xl font-bold text-foreground">Settings</h1>

      {message && <StatusMessage type={message.type} text={message.text} />}

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-card-foreground">
            Linked Stellar Wallets
          </h2>
        </div>

        {loading || context.isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading connected profiles...
          </p>
        ) : wallets.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">
            No cryptographic keys linked.
          </p>
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
                    {wallet.createdAt
                      ? ` · Linked ${new Date(wallet.createdAt).toLocaleDateString()}`
                      : " · Recently"}
                  </p>
                </div>

                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  onClick={() => handleUnlink(wallet.walletAddress)}
                  disabled={
                    linking || unlinkingAddress === wallet.walletAddress
                  }
                >
                  <Link2Off className="h-4 w-4" />
                  {unlinkingAddress === wallet.walletAddress
                    ? "Unlinking..."
                    : "Unlink"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          onClick={handleLinkFreighter}
          disabled={linking}
        >
          <Link2 className="h-4 w-4" />
          {linking ? "Linking..." : "Link Freighter Wallet"}
        </button>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Coins className="h-5 w-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-card-foreground">
            Display Preferences
          </h2>
        </div>

        <label
          htmlFor="display-currency-select"
          className="mb-2 block text-sm font-medium text-card-foreground"
        >
          Currency
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose how prices and balances are displayed across the app.
        </p>
        <select
          id="display-currency-select"
          data-testid="display-currency-select"
          value={displayCurrency}
          onChange={(e) =>
            setDisplayCurrency(e.target.value as DisplayCurrency)
          }
          className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {DISPLAY_CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-card-foreground">
            {t("pushNotifications.settingsTitle")}
          </h2>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          {t("pushNotifications.settingsDescription")}
        </p>

        {pushSupported ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-card-foreground">
              {pushSubscribed
                ? t("pushNotifications.settingsToggleOn")
                : t("pushNotifications.settingsToggleOff")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={pushSubscribed}
              data-testid="push-settings-toggle"
              onClick={handleTogglePush}
              disabled={pushBusy}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                pushSubscribed ? "bg-purple-600" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  pushSubscribed ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("pushNotifications.unsupported")}
          </p>
        )}
      </section>
    </div>
  );
}

function StatusMessage({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  const classes =
    type === "success"
      ? "border-green-500/30 bg-green-900/30 text-green-300"
      : "border-red-500/30 bg-red-900/30 text-red-300";

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${classes}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}
