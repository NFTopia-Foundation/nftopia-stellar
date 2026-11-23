"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disconnectAllWalletConnectSessions,
  disconnectWalletConnectSession,
  getWalletConnectSessions,
  type WalletConnectSessionSummary,
} from "@/lib/stellar/wallet/walletconnect";

/**
 * Loads and manages the list of active WalletConnect sessions for the
 * session-management UI (account/wallet settings). Wraps the plain
 * lib/stellar/wallet/walletconnect functions with loading/error/busy state
 * so the UI stays presentational.
 */
export function useWalletConnectSessions() {
  const [sessions, setSessions] = useState<WalletConnectSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnectingTopic, setDisconnectingTopic] = useState<string | null>(null);
  const [disconnectingAll, setDisconnectingAll] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await getWalletConnectSessions());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load WalletConnect sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disconnectSession = useCallback(
    async (topic: string) => {
      setDisconnectingTopic(topic);
      setError(null);
      try {
        await disconnectWalletConnectSession(topic);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not disconnect that session.",
        );
      } finally {
        setDisconnectingTopic(null);
      }
    },
    [refresh],
  );

  const disconnectAll = useCallback(async () => {
    setDisconnectingAll(true);
    setError(null);
    try {
      await disconnectAllWalletConnectSessions();
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not disconnect all sessions.",
      );
    } finally {
      setDisconnectingAll(false);
    }
  }, [refresh]);

  return {
    sessions,
    loading,
    error,
    disconnectingTopic,
    disconnectingAll,
    refresh,
    disconnectSession,
    disconnectAll,
  };
}
