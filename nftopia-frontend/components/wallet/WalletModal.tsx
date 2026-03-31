"use client";

import { useEffect, useState } from "react";
import { X, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { WalletInfo, WalletProvider } from "@/types/stellar";
import { useStellarWallet } from "./hooks/useStellarWallet";
import { detectInstalledWallets } from "@/lib/stellar/wallet/detection";
import { useTranslation } from "@/hooks/useTranslation";
import Image from "next/image";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (address: string) => void;
}

export function WalletModal({ open, onClose, onConnected }: WalletModalProps) {
  const { t } = useTranslation();
  const { connect, connecting, error, connected, address, clearError } = useStellarWallet();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<WalletProvider | null>(null);

  useEffect(() => {
    if (open) {
      detectInstalledWallets().then(setWallets);
    }
  }, [open]);

  useEffect(() => {
    if (connected && address && open) {
      onConnected?.(address);
      onClose();
    }
  }, [connected, address, open, onConnected, onClose]);

  const handleConnect = async (provider: WalletProvider) => {
    setSelectedProvider(provider);
    clearError();
    await connect(provider);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl border border-purple-500/20 bg-gray-950/95 backdrop-blur-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-purple-500/10">
          <h2 className="text-lg font-semibold text-white">
            {t("walletModal.title") || "Connect Wallet"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-sm text-gray-400 mb-4">
            {t("walletModal.subtitle") ||
              "Choose a Stellar wallet to connect. Freighter is recommended for browser use."}
          </p>

          <div className="space-y-2">
            {wallets.map((wallet) => (
              <WalletOption
                key={wallet.id}
                wallet={wallet}
                isConnecting={connecting && selectedProvider === wallet.id}
                onConnect={handleConnect}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-purple-500/10">
          <p className="text-xs text-gray-500 text-center">
            {t("walletModal.poweredBy") || "Secured by Stellar blockchain"}{" "}
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
            >
              stellar.org <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function WalletOption({
  wallet,
  isConnecting,
  onConnect,
}: {
  wallet: WalletInfo;
  isConnecting: boolean;
  onConnect: (id: WalletProvider) => void;
}) {
  return (
    <button
      onClick={() => onConnect(wallet.id)}
      disabled={isConnecting}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/15 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <Image
          src={wallet.logo}
          alt={wallet.name}
          width={32}
          height={32}
          className="object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-sm">{wallet.name}</span>
          {wallet.available && (
            <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
              Detected
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{wallet.description}</p>
      </div>

      {isConnecting ? (
        <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
      ) : (
        <div className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
          →
        </div>
      )}
    </button>
  );
}