"use client";

import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useStellarWallet } from "./hooks/useStellarWallet";
import { WalletModal } from "./WalletModal";
import { WalletNetworkStatus } from "./WalletNetworkStatus";
import { useTranslation } from "@/hooks/useTranslation";
import { getExplorerUrl } from "@/lib/stellar/network";
import { useToast } from "@/lib/stores";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";

interface WalletConnectorProps {
  forceVisible?: boolean;
  fullWidth?: boolean;
}

export function WalletConnector({ forceVisible = false, fullWidth = false }: WalletConnectorProps) {
  const { t } = useTranslation();
  const { address, connected, provider, network, connecting } = useWalletStore();
  const { disconnect } = useStellarWallet();
  const { showSuccess, showError } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      showSuccess(t("connectWallet.copySuccess") || "Wallet address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError(t("connectWallet.copyError") || "Failed to copy wallet address");
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  if (!connected) {
    const wrapperClass = forceVisible ? "flex w-full justify-center" : "hidden xl:flex";

    return (
      <>
        <div className={wrapperClass}>
          <Button
            variant="wallet"
            size="pill"
            onClick={() => setModalOpen(true)}
            loading={connecting}
            loadingText={t("connectWallet.connecting") || "Connecting..."}
            className="rounded-full"
          >
            <Wallet className="h-4 w-4" />
            {t("connectWallet.connect")}
          </Button>
        </div>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <Dropdown className={fullWidth ? "w-full" : undefined}>
      <DropdownTrigger
        className={`flex items-center gap-2 rounded-full pl-3 pr-4 py-2 bg-[#4e3bff]/20 border border-[#4e3bff]/40 text-white hover:bg-[#4e3bff]/30 transition-colors text-sm ${fullWidth ? "w-full justify-between" : ""}`}
        aria-label={`Wallet menu for ${truncatedAddress}`}
      >
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
        <span className="font-mono font-medium hidden sm:inline">{truncatedAddress}</span>
        <span className="font-mono font-medium sm:hidden">{address ? `${address.slice(0, 4)}...` : ""}</span>
        <ChevronDown className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
      </DropdownTrigger>

      <DropdownMenu className="w-60 rounded-xl bg-gray-900/95">
        <div className="px-4 py-3 border-b border-purple-500/10" role="presentation">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-purple-300 uppercase tracking-wider">{provider}</span>
            <WalletNetworkStatus network={network} />
          </div>
          <p className="text-xs font-mono text-gray-300 truncate">{address}</p>
        </div>

        <DropdownItem onClick={copyAddress} closeOnSelect={false} className="text-gray-200">
          {copied ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4 text-purple-400" aria-hidden="true" />
          )}
          {copied ? "Copied!" : t("connectWallet.copyAddress") || "Copy Address"}
        </DropdownItem>

        <a
          href={getExplorerUrl(network, undefined, address!)}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-purple-500/10 transition-colors focus-visible:outline-none focus-visible:bg-purple-500/10"
        >
          <ExternalLink className="h-4 w-4 text-purple-400" aria-hidden="true" />
          {t("connectWallet.viewExplorer") || "View on Explorer"}
        </a>

        <DropdownSeparator />

        <DropdownItem
          onClick={() => disconnect()}
          className="text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t("connectWallet.disconnect")}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

export default WalletConnector;
