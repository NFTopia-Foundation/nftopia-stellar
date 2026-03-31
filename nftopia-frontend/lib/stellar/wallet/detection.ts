import { WalletInfo } from "@/types/stellar";

export async function detectInstalledWallets(): Promise<WalletInfo[]> {
  const wallets: WalletInfo[] = [
    {
      id: "freighter",
      name: "Freighter",
      logo: "/wallets/freighter.svg",
      description: "Official Stellar browser extension wallet",
      installUrl: "https://www.freighter.app/",
      available: await isFreighterAvailable(),
    },
    {
      id: "albedo",
      name: "Albedo",
      logo: "/wallets/albedo.svg",
      description: "Web-based Stellar wallet with QR support",
      installUrl: "https://albedo.link/",
      available: true, 
    },
    {
      id: "walletconnect",
      name: "WalletConnect",
      logo: "/wallets/walletconnect.svg",
      description: "Connect mobile wallets via QR code",
      installUrl: "https://walletconnect.com/",
      available: true,
    },
  ];

  return wallets;
}

async function isFreighterAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const freighterApi = await import("@stellar/freighter-api");
    const connected = await freighterApi.isConnected();
    return connected.isConnected;
  } catch {
    return false;
  }
}

export function isFreighterInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).freighter;
}