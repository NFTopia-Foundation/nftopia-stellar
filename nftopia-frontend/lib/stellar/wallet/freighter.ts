import {
  isConnected,
  getAddress,
  signTransaction,
  requestAccess,
  getNetwork,
} from "@stellar/freighter-api";
import { StellarNetwork } from "@/types/stellar";

export async function connectFreighter(): Promise<string> {
  const connected = await isConnected();
  if (!connected.isConnected) {
    throw new Error(
      "Freighter extension is not installed. Please install it from freighter.app"
    );
  }

  await requestAccess();
  const addressResult = await getAddress();

  if (addressResult.error) {
    throw new Error(addressResult.error);
  }

  return addressResult.address;
}

export async function getFreighterAddress(): Promise<string> {
  const result = await getAddress();
  if (result.error) throw new Error(result.error);
  return result.address;
}

export async function getFreighterNetwork(): Promise<StellarNetwork> {
  const result = await getNetwork();
  if (result.error) throw new Error(result.error);
  return result.network.toLowerCase().includes("testnet") ? "testnet" : "mainnet";
}

export async function signWithFreighter(
  transactionXdr: string,
  network: StellarNetwork
): Promise<string> {
  const networkPassphrase =
    network === "testnet"
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015";

  const result = await signTransaction(transactionXdr, {
    networkPassphrase,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.signedTxXdr;
}

export async function isFreighterConnected(): Promise<boolean> {
  try {
    const result = await isConnected();
    return result.isConnected;
  } catch {
    return false;
  }
}