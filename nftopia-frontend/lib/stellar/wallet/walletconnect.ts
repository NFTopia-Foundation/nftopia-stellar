import { StellarNetwork } from "@/types/stellar";

export async function connectWalletConnect(
  _network: StellarNetwork
): Promise<string> {
  throw new Error(
    "WalletConnect is not yet implemented. Please use Freighter or Albedo."
  );
}

export async function signWithWalletConnect(
  _transactionXdr: string,
  _network: StellarNetwork
): Promise<string> {
  throw new Error(
    "WalletConnect transaction signing is not yet implemented."
  );
}