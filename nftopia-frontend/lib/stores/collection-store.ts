import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { CollectionStore, Collection, NFT } from './types';
import { API_CONFIG } from '../config';
import { getCookie } from '../CSRFTOKEN';

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
    collections: {
      page: 1,
      limit: 12,
      total: 0,
      hasMore: false,
    },
    nfts: {
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    },
  },
};

export const useCollectionStore = create<CollectionStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Collection actions
      setCollections: (collections: Collection[]) =>
        set((state) => {
          state.collections = collections;
        }),

      addCollection: (collection: Collection) =>
        set((state) => {
          state.collections.unshift(collection);
          state.userCollections.unshift(collection);
        }),

      updateCollection: (id: string | number, updates: Partial<Collection>) =>
        set((state) => {
          const index = state.collections.findIndex((c) => c.id === id);
          if (index !== -1) {
            state.collections[index] = { ...state.collections[index], ...updates };
          }
          
          const userIndex = state.userCollections.findIndex((c) => c.id === id);
          if (userIndex !== -1) {
            state.userCollections[userIndex] = { ...state.userCollections[userIndex], ...updates };
          }

          if (state.currentCollection?.id === id) {
            state.currentCollection = { ...state.currentCollection, ...updates };
          }
        }),

      removeCollection: (id: string | number) =>
        set((state) => {
          state.collections = state.collections.filter((c) => c.id !== id);
          state.userCollections = state.userCollections.filter((c) => c.id !== id);
          if (state.currentCollection?.id === id) {
            state.currentCollection = null;
          }
        }),

      setCurrentCollection: (collection: Collection | null) =>
        set((state) => {
          state.currentCollection = collection;
        }),

      // User collections
      setUserCollections: (collections: Collection[]) =>
        set((state) => {
          state.userCollections = collections;
        }),

      // NFT actions
      setNFTs: (nfts: NFT[]) =>
        set((state) => {
          state.nfts = nfts;
        }),

      addNFT: (nft: NFT) =>
        set((state) => {
          state.nfts.unshift(nft);
          state.userNFTs.unshift(nft);
        }),

      updateNFT: (id: string, updates: Partial<NFT>) =>
        set((state) => {
          const index = state.nfts.findIndex((n) => n.id === id);
          if (index !== -1) {
            state.nfts[index] = { ...state.nfts[index], ...updates };
          }
          
          const userIndex = state.userNFTs.findIndex((n) => n.id === id);
          if (userIndex !== -1) {
            state.userNFTs[userIndex] = { ...state.userNFTs[userIndex], ...updates };
          }
        }),

      removeNFT: (id: string) =>
        set((state) => {
          state.nfts = state.nfts.filter((n) => n.id !== id);
          state.userNFTs = state.userNFTs.filter((n) => n.id !== id);
        }),

      setUserNFTs: (nfts: NFT[]) =>
        set((state) => {
          state.userNFTs = nfts;
        }),

      // Loading states
      setLoading: (key, loading) =>
        set((state) => {
          state.loading[key] = loading;
        }),

      // Error handling
      setError: (error: string | null) =>
        set((state) => {
          state.error = error;
        }),

      clearError: () =>
        set((state) => {
          state.error = null;
        }),

      // Pagination
      setPagination: (type, pagination) =>
        set((state) => {
          state.pagination[type] = { ...state.pagination[type], ...pagination };
        }),

      // API actions
      fetchCollections: async () => {
        const { setLoading, setError, setCollections, setPagination } = get();
        
        try {
          setLoading('collections', true);
          setError(null);

          const { page, limit } = get().pagination.collections;
          const response = await fetch(`${API_CONFIG.baseUrl}/collections?page=${page}&limit=${limit}`, {
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch collections');
          }

          const data = await response.json();
          
          if (Array.isArray(data)) {
            setCollections(data);
          } else if (data.collections) {
            setCollections(data.collections);
            setPagination('collections', {
              total: data.total || data.collections.length,
              hasMore: data.hasMore || false,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch collections';
          setError(errorMessage);
          console.error('Error fetching collections:', error);
        } finally {
          setLoading('collections', false);
        }
      },

      fetchUserCollections: async () => {
        const { setLoading, setError, setUserCollections } = get();
        
        try {
          setLoading('userCollections', true);
          setError(null);

          const csrfToken = await getCookie();
          const response = await fetch(`${API_CONFIG.baseUrl}/collections/user`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch user collections');
          }

          const data = await response.json();
          setUserCollections(Array.isArray(data) ? data : data.collections || []);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user collections';
          setError(errorMessage);
          console.error('Error fetching user collections:', error);
        } finally {
          setLoading('userCollections', false);
        }
      },

      fetchNFTs: async (collectionId?: string) => {
        const { setLoading, setError, setNFTs, setPagination } = get();
        
        try {
          setLoading('nfts', true);
          setError(null);

          const { page, limit } = get().pagination.nfts;
          let url = `${API_CONFIG.baseUrl}/nfts?page=${page}&limit=${limit}`;
          
          if (collectionId) {
            url += `&collectionId=${collectionId}`;
          }

          const response = await fetch(url, {
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch NFTs');
          }

          const data = await response.json();
          
          if (Array.isArray(data)) {
            setNFTs(data);
          } else if (data.nfts) {
            setNFTs(data.nfts);
            setPagination('nfts', {
              total: data.total || data.nfts.length,
              hasMore: data.hasMore || false,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NFTs';
          setError(errorMessage);
          console.error('Error fetching NFTs:', error);
        } finally {
          setLoading('nfts', false);
        }
      },

      fetchUserNFTs: async () => {
        const { setLoading, setError, setUserNFTs } = get();
        
        try {
          setLoading('userNFTs', true);
          setError(null);

          const csrfToken = await getCookie();
          const response = await fetch(`${API_CONFIG.baseUrl}/nfts/user`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch user NFTs');
          }

          const data = await response.json();
          setUserNFTs(Array.isArray(data) ? data : data.nfts || []);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user NFTs';
          setError(errorMessage);
          console.error('Error fetching user NFTs:', error);
        } finally {
          setLoading('userNFTs', false);
        }
      },

      createCollection: async (collectionData) => {
        const { setLoading, setError, addCollection } = get();
        
        try {
          setLoading('creating', true);
          setError(null);

          const csrfToken = await getCookie();
          const response = await fetch(`${API_CONFIG.baseUrl}/collections`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({
              ...collectionData,
              createdAt: new Date().toISOString(),
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to create collection');
          }

          const newCollection = await response.json();
          addCollection(newCollection);
          
          return newCollection;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create collection';
          setError(errorMessage);
          throw error;
        } finally {
          setLoading('creating', false);
        }
      },

      createNFT: async (nftData) => {
        const { setLoading, setError, addNFT } = get();
        
        try {
          setLoading('creating', true);
          setError(null);

          const csrfToken = await getCookie();
          const response = await fetch(`${API_CONFIG.baseUrl}/nfts`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({
              ...nftData,
              createdAt: new Date().toISOString(),
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to create NFT');
          }

          const newNFT = await response.json();
          addNFT(newNFT);
          
          return newNFT;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create NFT';
          setError(errorMessage);
          throw error;
        } finally {
          setLoading('creating', false);
        }
      },
    })),
    {
      name: 'collection-store',
    }
  )
);

// Hook for easier collection state access
export const useCollections = () => {
  const {
    collections,
    userCollections,
    currentCollection,
    nfts,
    userNFTs,
    loading,
    error,
    pagination,
    fetchCollections,
    fetchUserCollections,
    fetchNFTs,
    fetchUserNFTs,
    createCollection,
    createNFT,
    setCurrentCollection,
    clearError,
  } = useCollectionStore();

  return {
    collections,
    userCollections,
    currentCollection,
    nfts,
    userNFTs,
    loading,
    error,
    pagination,
    fetchCollections,
    fetchUserCollections,
    fetchNFTs,
    fetchUserNFTs,
    createCollection,
    createNFT,
    setCurrentCollection,
    clearError,
  };
}; 