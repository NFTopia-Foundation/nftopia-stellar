"use client";

import { useAuthContext } from "@/lib/context/AuthContext";
import { useState } from "react";
import { connectFreighter, getFreighterAddress } from "@/lib/stellar/wallet/freighter";

export default function SettingsPage() {
  const { user, wallets, linkWallet, unlinkWallet, isLoading } = useAuthContext();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLinkFreighter = async () => {
    setError("");
    setSuccess("");
    setLinking(true);
    try {
      // 1. Connect to Freighter and get address
      const address = await connectFreighter();
      // 2. (In a real app, get challenge from backend, sign, and send signature)
      // Here, just call linkWallet for demo (should be completed with challenge/response)
      await linkWallet(address, "freighter");
      setSuccess("Wallet linked successfully!");
    } catch (e: any) {
      setError(e.message || "Failed to link wallet");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (walletAddress: string) => {
    setError("");
    setSuccess("");
    try {
      await unlinkWallet(walletAddress);
      setSuccess("Wallet unlinked successfully!");
    } catch (e: any) {
      setError(e.message || "Failed to unlink wallet");
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-nftopia-text mb-4">Settings</h1>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Linked Stellar Wallets</h2>
        {isLoading ? (
          <div>Loading...</div>
        ) : wallets.length === 0 ? (
          <div className="text-nftopia-subtext">No wallets linked.</div>
        ) : (
          <ul className="mb-4">
            {wallets.map((w) => (
              <li key={w.walletAddress} className="flex items-center justify-between py-2 border-b">
                <span>{w.walletAddress} ({w.walletProvider}) {w.isPrimary && <span className="ml-2 text-xs text-green-500">Primary</span>}</span>
                <button
                  className="ml-4 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => handleUnlink(w.walletAddress)}
                  disabled={linking}
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          onClick={handleLinkFreighter}
          disabled={linking}
        >
          {linking ? "Linking..." : "Link Freighter Wallet"}
        </button>
        {error && <div className="text-red-500 mt-2">{error}</div>}
        {success && <div className="text-green-600 mt-2">{success}</div>}
      </div>
    </div>
  );
}