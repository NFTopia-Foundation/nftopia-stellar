import { SignClient } from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { StellarNetwork } from "@/types/stellar";

let signClient: SignClient | undefined;
let walletConnectModal: WalletConnectModal | undefined;

// Use provided project ID or a fallback
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "9f848ed6ba0486c8f498c56ad8800000";

const getNetworkId = (network: StellarNetwork) => network === "mainnet" ? "stellar:pubnet" : "stellar:testnet";

export async function getSignClient() {
  if (!signClient) {
    signClient = await SignClient.init({
      projectId: PROJECT_ID,
      metadata: {
        name: "NFTopia",
        description: "Stellar NFT Marketplace",
        url: typeof window !== "undefined" ? window.location.origin : "https://nftopia.com",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      },
    });
  }
  return signClient;
}

function getModal() {
  if (!walletConnectModal) {
    walletConnectModal = new WalletConnectModal({
      projectId: PROJECT_ID,
      themeMode: "dark",
    });
  }
  return walletConnectModal;
}

export async function connectWalletConnect(
  network: StellarNetwork
): Promise<string> {
  const client = await getSignClient();
  const modal = getModal();
  const chainId = getNetworkId(network);

  try {
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        stellar: {
          methods: ["stellar_signXDR"],
          chains: [chainId],
          events: [],
        },
      },
    });

    if (uri) {
      modal.openModal({ uri });
    }

    const session = await approval();
    
    // Once session is approved, find the address
    const account = session.namespaces.stellar.accounts.find((a) => a.startsWith(`${chainId}:`));
    
    if (!account) {
      throw new Error(`No Stellar account provided by wallet for network ${network}`);
    }

    return account.split(":")[2];
  } finally {
    modal.closeModal();
  }
}

export async function signWithWalletConnect(
  transactionXdr: string,
  network: StellarNetwork
): Promise<string> {
  const client = await getSignClient();
  const chainId = getNetworkId(network);
  
  const lastKeyIndex = client.session.keys.length - 1;
  if (lastKeyIndex < 0) {
    throw new Error("No active WalletConnect session");
  }
  
  const session = client.session.get(client.session.keys[lastKeyIndex]);
  const account = session.namespaces.stellar.accounts.find((a) => a.startsWith(`${chainId}:`));

  if (!account) {
    throw new Error(`Session is not connected to ${chainId}`);
  }

  const result = await client.request({
    topic: session.topic,
    chainId,
    request: {
      method: "stellar_signXDR",
      params: { xdr: transactionXdr },
    },
  });

  if (typeof result === "string") return result;
  if (typeof result === "object" && result !== null) {
    if ("signedXDR" in result) return (result as any).signedXDR;
    if ("signature" in result) return (result as any).signature;
  }

  throw new Error("Invalid response from WalletConnect signing");
}

export async function disconnectWalletConnect(): Promise<void> {
  if (!signClient) return;
  const sessions = signClient.session.getAll();
  for (const session of sessions) {
    await signClient.disconnect({
      topic: session.topic,
      reason: {
        code: 6000,
        message: "User disconnected",
      },
    });
  }
}

export async function isWalletConnectConnected(network: StellarNetwork, expectedAddress: string): Promise<boolean> {
  try {
    const client = await getSignClient();
    const chainId = getNetworkId(network);
    const sessions = client.session.getAll();
    
    for (const session of sessions) {
      const account = session.namespaces.stellar?.accounts?.find((a) => a.startsWith(`${chainId}:`));
      if (account && account.split(":")[2] === expectedAddress) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}