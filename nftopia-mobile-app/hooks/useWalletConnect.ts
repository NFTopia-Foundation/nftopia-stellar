import { useCallback, useState } from 'react';
import { useWalletStore, NetworkType } from '@/stores/walletStore';
import { Wallet } from '@/src/services/stellar/types';
import { parseWalletConnectUri } from '@/src/utils/walletConnectUri';
import { analyticsService } from '@/src/analytics/analytics.service';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';

export interface PairingResult {
  success: boolean;
  error?: string;
  topic?: string;
}

export function useWalletConnect() {
  const wallets = useWalletStore((s) => s.wallets);
  const activePublicKey = useWalletStore((s) => s.activePublicKey);
  const network = useWalletStore((s) => s.network);
  const balances = useWalletStore((s) => s.balances);
  const isLoading = useWalletStore((s) => s.isLoading);
  const error = useWalletStore((s) => s.error);
  const lastBackupReminderShown = useWalletStore((s) => s.lastBackupReminderShown);

  const activeWallet = wallets.find((w) => w.publicKey === activePublicKey) ?? null;
  const activeBalance = activePublicKey ? balances[activePublicKey] ?? null : null;

  const importFromSecretKey = useWalletStore((s) => s.importFromSecretKey);
  const importFromMnemonic = useWalletStore((s) => s.importFromMnemonic);
  const createNewWallet = useWalletStore((s) => s.createNewWallet);
  const removeWallet = useWalletStore((s) => s.removeWallet);
  const setActiveWallet = useWalletStore((s) => s.setActiveWallet);
  const switchNetwork = useWalletStore((s) => s.switchNetwork);
  const fetchBalances = useWalletStore((s) => s.fetchBalances);
  const revealSecretKey = useWalletStore((s) => s.revealSecretKey);
  const revealMnemonic = useWalletStore((s) => s.revealMnemonic);
  const markBackupConfirmed = useWalletStore((s) => s.markBackupConfirmed);
  const updateLastReminderShown = useWalletStore((s) => s.updateLastReminderShown);
  const clearError = useWalletStore((s) => s.clearError);

  const [pendingPairingTopic, setPendingPairingTopic] = useState<string | null>(null);

  /**
   * Accepts a scanned WalletConnect pairing URI and validates its shape.
   *
   * This codebase doesn't yet integrate a WalletConnect client SDK (no
   * `@walletconnect/*` dependency exists), so there's no session/relay to
   * actually hand the URI to. This validates the URI and records the
   * pairing *intent* (topic + version, for analytics and for surfacing
   * "pairing requested" in the UI) — it's the entry point a real client
   * integration would plug into, not a completed handshake.
   */
  const pairWithUri = useCallback((uri: string): PairingResult => {
    const parsed = parseWalletConnectUri(uri);
    if (!parsed) {
      return { success: false, error: 'Not a valid WalletConnect pairing code' };
    }

    setPendingPairingTopic(parsed.topic);
    analyticsService.track(ANALYTICS_EVENTS.WALLET_CONNECT_PAIRING_INITIATED, {
      version: parsed.version,
      topic: parsed.topic,
    });

    return { success: true, topic: parsed.topic };
  }, []);

  return {
    wallets,
    activeWallet,
    activePublicKey,
    network,
    activeBalance,
    isLoading,
    error,
    lastBackupReminderShown,
    importFromSecretKey,
    importFromMnemonic,
    createNewWallet,
    removeWallet,
    setActiveWallet,
    switchNetwork: (net: NetworkType) => switchNetwork(net),
    fetchBalances: (pubKey?: string) => fetchBalances(pubKey),
    revealSecretKey,
    revealMnemonic,
    markBackupConfirmed,
    updateLastReminderShown,
    clearError,
    pendingPairingTopic,
    pairWithUri,
  };
}
