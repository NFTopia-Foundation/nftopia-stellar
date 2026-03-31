import { StellarNetwork } from "@/types/stellar";
import { STELLAR_NETWORKS } from "./client";

export function getNetworkConfig(network: StellarNetwork) {
  return STELLAR_NETWORKS[network];
}

export function isTestnet(network: StellarNetwork): boolean {
  return network === "testnet";
}

export function getNetworkLabel(network: StellarNetwork): string {
  return network === "testnet" ? "Testnet" : "Mainnet";
}

export function getExplorerUrl(
  network: StellarNetwork,
  txHash?: string,
  address?: string
): string {
  const base =
    network === "testnet"
      ? "https://stellar.expert/explorer/testnet"
      : "https://stellar.expert/explorer/public";

  if (txHash) return `${base}/tx/${txHash}`;
  if (address) return `${base}/account/${address}`;
  return base;
}

/**
 * Validate that the connected wallet is on the expected network.
 * Returns true if they match, false otherwise.
 */
export async function validateNetwork(
  provider: "freighter" | "albedo",
  expectedNetwork: StellarNetwork
): Promise<boolean> {
  if (provider === "freighter") {
    try {
      const { getFreighterNetwork } = await import("./wallet/freighter");
      const connectedNetwork = await getFreighterNetwork();
      return connectedNetwork === expectedNetwork;
    } catch {
      return false;
    }
  }
  // Albedo passes network in each request — always valid
  return true;
}