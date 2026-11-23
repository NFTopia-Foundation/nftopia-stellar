"use client";

import { useState } from "react";
import { Globe, ShieldAlert, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletConnectSessions } from "@/hooks/useWalletConnectSessions";
import type { WalletConnectSessionSummary } from "@/lib/stellar/wallet/walletconnect";

type PendingAction =
  | { type: "session"; topic: string; dappName: string }
  | { type: "all" }
  | null;

function formatRelativeTime(ms: number): string {
  const diffMs = ms - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function SessionRow({
  session,
  disconnecting,
  onRequestDisconnect,
}: {
  session: WalletConnectSessionSummary;
  disconnecting: boolean;
  onRequestDisconnect: () => void;
}) {
  return (
    <li
      data-testid="wc-session-row"
      className="flex items-center gap-3 rounded-xl border border-purple-900/30 bg-[#1E1A45] p-4"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/30"
        aria-hidden="true"
      >
        {session.dappIcon ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote dApp-supplied icon, not under our control for next/image optimization
          <img src={session.dappIcon} alt="" className="h-full w-full object-cover" />
        ) : (
          <Globe className="h-5 w-5 text-purple-300" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-white">{session.dappName}</p>
          {session.isCurrent ? (
            <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
              Current
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-gray-400">
          {session.connectedAt
            ? `Connected ${formatRelativeTime(session.connectedAt)}`
            : `Expires ${formatRelativeTime(session.expiresAt)}`}
          {" · "}
          {session.network === "mainnet" ? "Mainnet" : "Testnet"}
        </p>
      </div>

      <Button
        variant="danger-ghost"
        size="sm"
        onClick={onRequestDisconnect}
        loading={disconnecting}
        loadingText="Disconnecting…"
      >
        Disconnect
      </Button>
    </li>
  );
}

/**
 * Lists the user's active WalletConnect sessions (dApp name/icon, network,
 * connected/expiry time) with per-session and disconnect-all revoke
 * actions, each gated behind an inline confirmation step so a disconnect
 * can't happen from a single accidental click mid-use.
 */
export function WalletConnectSessionsManager() {
  const {
    sessions,
    loading,
    error,
    disconnectingTopic,
    disconnectingAll,
    disconnectSession,
    disconnectAll,
  } = useWalletConnectSessions();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isConfirmBusy =
    pendingAction?.type === "session"
      ? disconnectingTopic === pendingAction.topic
      : disconnectingAll;

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.type === "session") {
      await disconnectSession(pendingAction.topic);
    } else {
      await disconnectAll();
    }
    setPendingAction(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-white">WalletConnect sessions</h2>
        {sessions.length > 0 ? (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => setPendingAction({ type: "all" })}
          >
            <Unplug className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Disconnect all
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="text-sm text-gray-400">
          Loading sessions…
        </p>
      ) : sessions.length === 0 ? (
        <p data-testid="wc-sessions-empty" className="text-sm text-gray-400">
          No active WalletConnect sessions. Connect a wallet via WalletConnect to see it
          here.
        </p>
      ) : (
        <ul role="list" className="space-y-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.topic}
              session={session}
              disconnecting={disconnectingTopic === session.topic}
              onRequestDisconnect={() =>
                setPendingAction({
                  type: "session",
                  topic: session.topic,
                  dappName: session.dappName,
                })
              }
            />
          ))}
        </ul>
      )}

      {pendingAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wc-disconnect-confirm-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-purple-900/30 bg-[#1E1A45] p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                aria-hidden="true"
              />
              <div>
                <h3
                  id="wc-disconnect-confirm-title"
                  className="text-base font-semibold text-white"
                >
                  {pendingAction.type === "all"
                    ? "Disconnect all sessions?"
                    : `Disconnect from ${pendingAction.dappName}?`}
                </h3>
                <p className="mt-1.5 text-sm text-gray-300">
                  {pendingAction.type === "all"
                    ? "This revokes every active WalletConnect session. You'll need to reconnect any app you want to keep using."
                    : "You'll need to reconnect if you want to use this app again."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setPendingAction(null)}
                disabled={isConfirmBusy}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmPendingAction()}
                loading={isConfirmBusy}
                loadingText={pendingAction.type === "all" ? "Disconnecting all…" : "Disconnecting…"}
              >
                {pendingAction.type === "all" ? "Disconnect all" : "Disconnect"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
