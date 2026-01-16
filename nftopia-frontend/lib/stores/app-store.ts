import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { AppStore } from './types';

const initialState = {
  isOnline: true,
  sidebarOpen: false,
  modalStack: [],
  toast: null,
  searchQuery: '',
  searchFilters: {
    category: '',
    priceRange: [0, 1000] as [number, number],
    sortBy: 'newest' as const,
  },
};

export const useAppStore = create<AppStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Online status
      setOnline: (online) =>
        set((state) => {
          state.isOnline = online;
        }),

      // Sidebar actions
      setSidebarOpen: (open) =>
        set((state) => {
          state.sidebarOpen = open;
        }),

      // Modal actions
      pushModal: (modalId) =>
        set((state) => {
          state.modalStack.push(modalId);
        }),

      popModal: () =>
        set((state) => {
          state.modalStack.pop();
        }),

      clearModals: () =>
        set((state) => {
          state.modalStack = [];
        }),

      // Toast actions
      showToast: (message, type) =>
        set((state) => {
          state.toast = {
            message,
            type,
            id: Date.now().toString(),
          };
        }),

      hideToast: () =>
        set((state) => {
          state.toast = null;
        }),

      // Search actions
      setSearchQuery: (query) =>
        set((state) => {
          state.searchQuery = query;
        }),

      setSearchFilters: (filters) =>
        set((state) => {
          state.searchFilters = { ...state.searchFilters, ...filters };
        }),

      resetSearchFilters: () =>
        set((state) => {
          state.searchFilters = {
            category: '',
            priceRange: [0, 1000],
            sortBy: 'newest',
          };
        }),
    })),
    {
      name: 'app-store',
    }
  )
);

// Initialize online status detection
if (typeof window !== 'undefined') {
  const { setOnline } = useAppStore.getState();
  
  // Set initial online status
  setOnline(navigator.onLine);
  
  // Listen for online/offline events
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}

// Hooks for specific app state sections
export const useOnlineStatus = () => {
  const { isOnline } = useAppStore();
  return isOnline;
};

export const useSidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  return {
    sidebarOpen,
    toggleSidebar,
    openSidebar,
    closeSidebar,
  };
};

export const useModals = () => {
  const { modalStack, pushModal, popModal, clearModals } = useAppStore();
  
  const currentModal = modalStack[modalStack.length - 1] || null;
  const hasModals = modalStack.length > 0;

  return {
    modalStack,
    currentModal,
    hasModals,
    pushModal,
    popModal,
    clearModals,
  };
};

export const useToast = () => {
  const { toast, showToast, hideToast } = useAppStore();

  const showSuccess = (message: string) => showToast(message, 'success');
  const showError = (message: string) => showToast(message, 'error');
  const showWarning = (message: string) => showToast(message, 'warning');
  const showInfo = (message: string) => showToast(message, 'info');

  return {
    toast,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
  };
};

export const useSearch = () => {
  const { searchQuery, searchFilters, setSearchQuery, setSearchFilters, resetSearchFilters } = useAppStore();

  const updateFilter = <K extends keyof typeof searchFilters>(
    key: K,
    value: typeof searchFilters[K]
  ) => {
    setSearchFilters({ [key]: value });
  };

  return {
    searchQuery,
    searchFilters,
    setSearchQuery,
    setSearchFilters,
    updateFilter,
    resetSearchFilters,
  };
};

// Hook for easier app state access
export const useAppState = () => {
  const {
    isOnline,
    sidebarOpen,
    modalStack,
    toast,
    searchQuery,
    searchFilters,
    setOnline,
    setSidebarOpen,
    pushModal,
    popModal,
    clearModals,
    showToast,
    hideToast,
    setSearchQuery,
    setSearchFilters,
    resetSearchFilters,
  } = useAppStore();

  return {
    isOnline,
    sidebarOpen,
    modalStack,
    toast,
    searchQuery,
    searchFilters,
    setOnline,
    setSidebarOpen,
    pushModal,
    popModal,
    clearModals,
    showToast,
    hideToast,
    setSearchQuery,
    setSearchFilters,
    resetSearchFilters,
  };
}; 