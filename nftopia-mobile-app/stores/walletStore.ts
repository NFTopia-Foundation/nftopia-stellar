import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { StellarWalletService } from '@/src/services/stellar/wallet.service';
import { Wallet, WalletError } from '@/src/services/stellar/types';
import { fetchXlmBalance, fetchTokenBalances, TokenBalance } from '@/src/services/stellar/balance.service';

export type NetworkType = 'testnet' | 'mainnet';

interface WalletStoreState {
  wallets: Wallet[];
  activePublicKey: string | null;
  network: NetworkType;
  balances: Record<string, { xlm: string; tokens: TokenBalance[] }>;
  isLoading: boolean;
  error: string | null;
}

interface WalletStoreActions {
  importFromSecretKey: (secretKey: string, password?: string) => Promise<Wallet>;
  importFromMnemonic: (mnemonic: string, password?: string) => Promise<Wallet>;
  createNewWallet: (password?: string) => Promise<Wallet>;
  removeWallet: (publicKey: string) => void;
  setActiveWallet: (publicKey: string) => void;
  switchNetwork: (network: NetworkType) => void;
  fetchBalances: (publicKey?: string) => Promise<void>;
  revealSecretKey: (publicKey: string) => Promise<string | null>;
  revealMnemonic: (publicKey: string) => Promise<string | null>;
  clearWallets: () => void;
  clearError: () => void;
}

type WalletStore = WalletStoreState & WalletStoreActions;

const walletService = new StellarWalletService();

const initialState: WalletStoreState = {
  wallets: [],
  activePublicKey: null,
  network: 'testnet',
  balances: {},
  isLoading: false,
  error: null,
};

async function authenticateWithBiometrics(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return true;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access wallet keys',
    fallbackLabel: 'Use passcode',
  });
  return result.success;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      importFromSecretKey: async (secretKey: string, password?: string) => {
        set({ isLoading: true, error: null });
        try {
          const wallet = await walletService.importFromSecretKey(secretKey, password);
          set((state) => {
            const exists = state.wallets.find((w) => w.publicKey === wallet.publicKey);
            if (exists) {
              return {
                wallets: state.wallets.map((w) =>
                  w.publicKey === wallet.publicKey ? wallet : w
                ),
                activePublicKey: state.activePublicKey ?? wallet.publicKey,
                isLoading: false,
              };
            }
            return {
              wallets: [...state.wallets, wallet],
              activePublicKey: state.activePublicKey ?? wallet.publicKey,
              isLoading: false,
            };
          });
          return wallet;
        } catch (err) {
          const message = err instanceof WalletError ? err.message : 'Failed to import wallet';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      importFromMnemonic: async (mnemonic: string, password?: string) => {
        set({ isLoading: true, error: null });
        try {
          const wallet = await walletService.importFromMnemonic(mnemonic, password);
          set((state) => {
            const exists = state.wallets.find((w) => w.publicKey === wallet.publicKey);
            if (exists) {
              return {
                wallets: state.wallets.map((w) =>
                  w.publicKey === wallet.publicKey ? wallet : w
                ),
                activePublicKey: state.activePublicKey ?? wallet.publicKey,
                isLoading: false,
              };
            }
            return {
              wallets: [...state.wallets, wallet],
              activePublicKey: state.activePublicKey ?? wallet.publicKey,
              isLoading: false,
            };
          });
          return wallet;
        } catch (err) {
          const message = err instanceof WalletError ? err.message : 'Failed to import wallet';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      createNewWallet: async (password?: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await walletService.createWallet(password);
          const wallet = result.wallet;
          set((state) => ({
            wallets: [...state.wallets, wallet],
            activePublicKey: wallet.publicKey,
            isLoading: false,
          }));
          return wallet;
        } catch (err) {
          const message = err instanceof WalletError ? err.message : 'Failed to create wallet';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      removeWallet: (publicKey: string) => {
        set((state) => {
          const filtered = state.wallets.filter((w) => w.publicKey !== publicKey);
          return {
            wallets: filtered,
            activePublicKey:
              state.activePublicKey === publicKey
                ? filtered.length > 0
                  ? filtered[filtered.length - 1].publicKey
                  : null
                : state.activePublicKey,
          };
        });
      },

      setActiveWallet: (publicKey: string) => {
        set({ activePublicKey: publicKey });
      },

      switchNetwork: (network: NetworkType) => {
        set({ network, balances: {} });
      },

      fetchBalances: async (publicKey?: string) => {
        const { activePublicKey, network } = get();
        const key = publicKey ?? activePublicKey;
        if (!key) return;
        set({ isLoading: true, error: null });
        try {
          const [xlm, tokens] = await Promise.all([
            fetchXlmBalance(key, network),
            fetchTokenBalances(key, network),
          ]);
          set((state) => ({
            balances: { ...state.balances, [key]: { xlm, tokens } },
            isLoading: false,
          }));
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch balances',
            isLoading: false,
          });
        }
      },

      revealSecretKey: async (publicKey: string) => {
        const wallet = get().wallets.find((w) => w.publicKey === publicKey);
        if (!wallet) {
          set({ error: 'Wallet not found' });
          return null;
        }
        const authenticated = await authenticateWithBiometrics();
        if (!authenticated) {
          set({ error: 'Authentication required' });
          return null;
        }
        return wallet.secretKey;
      },

      revealMnemonic: async (publicKey: string) => {
        const wallet = get().wallets.find((w) => w.publicKey === publicKey);
        if (!wallet) {
          set({ error: 'Wallet not found' });
          return null;
        }
        if (!wallet.mnemonic) {
          set({ error: 'No mnemonic available for this wallet' });
          return null;
        }
        const authenticated = await authenticateWithBiometrics();
        if (!authenticated) {
          set({ error: 'Authentication required' });
          return null;
        }
        return wallet.mnemonic;
      },

      clearWallets: () => {
        set({ wallets: [], activePublicKey: null, balances: {} });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'wallet-storage',
      partialize: (state: WalletStore) => ({
        wallets: state.wallets,
        activePublicKey: state.activePublicKey,
        network: state.network,
      }),
      storage: {
        getItem: async (name: string) => {
          return await SecureStore.getItemAsync(name);
        },
        setItem: async (name: string, value: string) => {
          await SecureStore.setItemAsync(name, value);
        },
        removeItem: async (name: string) => {
          await SecureStore.deleteItemAsync(name);
        },
      },
    } as unknown as PersistOptions<WalletStore>
  )
);
