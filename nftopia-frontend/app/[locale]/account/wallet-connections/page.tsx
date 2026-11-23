"use client";

import { WalletConnectSessionsManager } from "@/components/wallet/WalletConnectSessionsManager";

export default function WalletConnectionsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Account</p>
      <h1 className="mt-2 text-2xl font-semibold">Wallet connections</h1>
      <p className="mt-2 text-sm text-slate-300">
        Review the dApps currently connected to your wallet through WalletConnect, and
        revoke any session you no longer recognize or need.
      </p>

      <div className="mt-8 border-t border-white/15 pt-6">
        <WalletConnectSessionsManager />
      </div>
    </main>
  );
}
