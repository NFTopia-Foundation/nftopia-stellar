import type { Collection, CollectionStore, NFT } from "@/lib/stores/types";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const logMiddleware =
  <T extends object>(
    config: StateCreator<T, [], [], T>
  ): StateCreator<T, [], [], T> =>
  (set, get, api) =>
    config(
      (partial, replace) => {
        if (
          typeof process !== "undefined" &&
          typeof (process as any).env !== "undefined" &&
          (process as any).env.NODE_ENV === "development"
        ) {
          console.log("[Store action]", partial);
        }
        set(partial, replace as false | undefined);
      },
      get,
      api
    );

const initialState = {
  collections: [],
  userCollections: [],
  currentCollection: null,
  nfts: [],
  userNFTs: [],
  loading: {
    collections: false,
    userCollections: false,
    nfts: false,
    userNFTs: false,
    creating: false,
    updating: false,
  },
  error: null,
  pagination: {
    collections: { page: 1, limit: 12, total: 0, hasMore: false },
    nfts: { page: 1, limit: 20, total: 0, hasMore: false },
  },
};

export const useNFTStore = create<CollectionStore>()(
  devtools(
    immer(
      logMiddleware<CollectionStore>((set, get) => ({
        ...initialState,
        setCollections: (collections: Collection[]) =>
          set((state) => ({ ...state, collections })),
        addCollection: (collection: Collection) =>
          set((state) => ({
            ...state,
            collections: [collection, ...state.collections],
            userCollections: [collection, ...state.userCollections],
          })),
        updateCollection: (id: string | number, updates: Partial<Collection>) =>
          set((state) => ({
            ...state,
            collections: state.collections.map((c) =>
              c.id === id ? { ...c, ...updates } : c
            ),
            userCollections: state.userCollections.map((c) =>
              c.id === id ? { ...c, ...updates } : c
            ),
            currentCollection:
              state.currentCollection?.id === id
                ? { ...state.currentCollection, ...updates }
                : state.currentCollection,
          })),
        removeCollection: (id: string | number) =>
          set((state) => ({
            ...state,
            collections: state.collections.filter((c) => c.id !== id),
            userCollections: state.userCollections.filter((c) => c.id !== id),
            currentCollection:
              state.currentCollection?.id === id
                ? null
                : state.currentCollection,
          })),
        setCurrentCollection: (collection: Collection | null) =>
          set((state) => ({ ...state, currentCollection: collection })),
        setUserCollections: (collections: Collection[]) =>
          set((state) => ({ ...state, userCollections: collections })),
        setNFTs: (nfts: NFT[]) => set((state) => ({ ...state, nfts })),
        addNFT: (nft: NFT) =>
          set((state) => ({
            ...state,
            nfts: [nft, ...state.nfts],
            userNFTs: [nft, ...state.userNFTs],
          })),
        updateNFT: (id: string, updates: Partial<NFT>) =>
          set((state) => ({
            ...state,
            nfts: state.nfts.map((n) =>
              n.id === id ? { ...n, ...updates } : n
            ),
            userNFTs: state.userNFTs.map((n) =>
              n.id === id ? { ...n, ...updates } : n
            ),
          })),
        removeNFT: (id: string) =>
          set((state) => ({
            ...state,
            nfts: state.nfts.filter((n) => n.id !== id),
            userNFTs: state.userNFTs.filter((n) => n.id !== id),
          })),
        setUserNFTs: (nfts: NFT[]) =>
          set((state) => ({ ...state, userNFTs: nfts })),
        setLoading: (key, loading) =>
          set((state) => ({
            ...state,
            loading: { ...state.loading, [key]: loading },
          })),
        setError: (error: string | null) =>
          set((state) => ({ ...state, error })),
        clearError: () => set((state) => ({ ...state, error: null })),
        setPagination: (type, pagination) =>
          set((state) => ({
            ...state,
            pagination: {
              ...state.pagination,
              [type]: { ...state.pagination[type], ...pagination },
            },
          })),
        createNFT: async (nftData) => {
          const tempNFT: NFT = {
            ...nftData,
            id: "temp-" + Date.now(),
            createdAt: new Date().toISOString(),
            isListed: false,
            likes: 0,
            views: 0,
          };
          get().addNFT(tempNFT);
          try {
            // Replace with real API call
            // const newNFT = await apiCreateNFT(nftData);
            // get().updateNFT(tempNFT.id, newNFT);
            return tempNFT;
          } catch (e) {
            get().removeNFT(tempNFT.id);
            throw e;
          }
        },
        fetchCollections: async () => {
          throw new Error("Not implemented");
        },
        fetchUserCollections: async () => {
          throw new Error("Not implemented");
        },
        fetchNFTs: async (collectionId?: string) => {
          throw new Error("Not implemented");
        },
        fetchUserNFTs: async () => {
          throw new Error("Not implemented");
        },
        createCollection: async (collection) => {
          throw new Error("Not implemented");
        },
      }))
    ),
    { name: "nft-store" }
  )
);

export const useNFTs = () =>
  useNFTStore((state) => ({
    nfts: state.nfts,
    userNFTs: state.userNFTs,
    collections: state.collections,
    loading: state.loading,
    error: state.error,
    addNFT: state.addNFT,
    updateNFT: state.updateNFT,
    removeNFT: state.removeNFT,
    createNFT: state.createNFT,
  }));
