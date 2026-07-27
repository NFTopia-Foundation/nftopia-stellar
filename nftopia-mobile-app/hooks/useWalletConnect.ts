import { useWalletStore, NetworkType } from '@/stores/walletStore';
import { Wallet } from '@/src/services/stellar/types';

export function useWalletConnect() {
  const wallets = useWalletStore((s) => s.wallets);
  const activePublicKey = useWalletStore((s) => s.activePublicKey);
  const network = useWalletStore((s) => s.network);
  const balances = useWalletStore((s) => s.balances);
  const isLoading = useWalletStore((s) => s.isLoading);
  const error = useWalletStore((s) => s.error);

  const activeWallet = wallets.find((w) => w.publicKey === activePublicKey) ?? null;
  const activeBalance = activePublicKey ? balances[activePublicKey] ?? null : null;

  const importFromSecretKey = useWalletStore((s) => s.importFromSecretKey);
  const importFromMnemonic = useWalletStore((s) => s.importFromMnemonic);
  const createNewWallet = useWalletStore((s) => s.createNewWallet);
  const removeWallet = useWalletStore((s) => s.removeWallet);
  const setActiveWallet = useWalletStore((s) => s.setActiveWallet);
  const switchNetwork = useWalletStore((s) => s.switchNetwork);
  const fetchBalances = useWalletStore((s) => s.fetchBalances);
  const revealSecretKey = useWalletStore((s) => s.revealSecretKey);
  const revealMnemonic = useWalletStore((s) => s.revealMnemonic);
  const clearError = useWalletStore((s) => s.clearError);

  return {
    wallets,
    activeWallet,
    activePublicKey,
    network,
    activeBalance,
    isLoading,
    error,
    importFromSecretKey,
    importFromMnemonic,
    createNewWallet,
    removeWallet,
    setActiveWallet,
    switchNetwork: (net: NetworkType) => switchNetwork(net),
    fetchBalances: (pubKey?: string) => fetchBalances(pubKey),
    revealSecretKey,
    revealMnemonic,
    clearError,
  };
}
