import { Horizon, Networks, rpc } from "@stellar/stellar-sdk";

export const STELLAR_NETWORKS = {
  testnet: {
    networkPassphrase: Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl:
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
      "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    networkPassphrase: Networks.PUBLIC,
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl:
      process.env.NEXT_PUBLIC_SOROBAN_MAINNET_RPC_URL ||
      "https://soroban.stellar.org",
  },
} as const;

export type StellarNetworkKey = keyof typeof STELLAR_NETWORKS;

const defaultNetwork: StellarNetworkKey =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as StellarNetworkKey) || "testnet";

export { defaultNetwork };

export function getHorizonServer(
  network: StellarNetworkKey = defaultNetwork
): Horizon.Server {
  return new Horizon.Server(STELLAR_NETWORKS[network].horizonUrl);
}

export function getSorobanServer(
  network: StellarNetworkKey = defaultNetwork
): rpc.Server {
  return new rpc.Server(STELLAR_NETWORKS[network].sorobanRpcUrl, {
    allowHttp: network === "testnet",
  });
}

export function getNetworkPassphrase(
  network: StellarNetworkKey = defaultNetwork
): string {
  return STELLAR_NETWORKS[network].networkPassphrase;
}