"use client";

import { StellarNetwork } from "@/types/stellar";

interface WalletNetworkStatusProps {
  network: StellarNetwork;
  className?: string;
}

export function WalletNetworkStatus({ network, className = "" }: WalletNetworkStatusProps) {
  const isTestnet = network === "testnet";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
        isTestnet
          ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
          : "bg-green-400/10 text-green-400 border border-green-400/20"
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isTestnet ? "bg-yellow-400" : "bg-green-400"
        }`}
      />
      {isTestnet ? "Testnet" : "Mainnet"}
    </span>
  );
}