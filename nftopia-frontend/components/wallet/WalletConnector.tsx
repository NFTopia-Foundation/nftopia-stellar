"use client";

import { useState, useEffect } from "react";
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useStellarWallet } from "./hooks/useStellarWallet";
import { WalletModal } from "./WalletModal";
import { WalletNetworkStatus } from "./WalletNetworkStatus";
import { useTranslation } from "@/hooks/useTranslation";
import { getExplorerUrl } from "@/lib/stellar/network";

export function WalletConnector() {
  const { t } = useTranslation();
  const { address, connected, provider, network } = useWalletStore();
  const { disconnect } = useStellarWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => setDropdownOpen(false);
    if (dropdownOpen) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dropdownOpen]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  if (!connected) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="hidden xl:flex items-center gap-2 rounded-full px-6 py-2 bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90 transition-opacity font-medium text-sm"
        >
          <Wallet className="h-4 w-4" />
          {t("connectWallet.connect")}
        </button>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-3 pr-4 py-2 bg-[#4e3bff]/20 border border-[#4e3bff]/40 text-white hover:bg-[#4e3bff]/30 transition-colors text-sm"
      >
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-mono font-medium">{truncatedAddress}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-purple-300 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-purple-500/20 bg-gray-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-purple-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-purple-300 uppercase tracking-wider">
                {provider}
              </span>
              <WalletNetworkStatus network={network} />
            </div>
            <p className="text-xs font-mono text-gray-300 truncate">{address}</p>
          </div>

          <div className="py-1">
            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-purple-500/10 transition-colors"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 text-purple-400" />
              )}
              {copied ? "Copied!" : t("connectWallet.copyAddress") || "Copy Address"}
            </button>

            <a
              href={getExplorerUrl(network, undefined, address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-purple-500/10 transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-purple-400" />
              {t("connectWallet.viewExplorer") || "View on Explorer"}
            </a>

            <div className="border-t border-purple-500/10 mt-1 pt-1">
              <button
                onClick={() => { disconnect(); setDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("connectWallet.disconnect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletConnector;