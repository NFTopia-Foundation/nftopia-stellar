"use client";

import { useEffect, useState } from "react";
import { initializeStores } from "./index";
import { usePreferencesStore } from "./preferences-store";

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const isHydrated = usePreferencesStore((state) => state.isHydrated);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeStores();
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize stores:", error);
        setIsInitialized(true); // Still render the app
      }
    };

    // Only initialize after preferences are hydrated
    if (isHydrated) {
      init();
    }
  }, [isHydrated]);

  // Show loading state while stores are initializing
  if (!isInitialized || !isHydrated) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-b from-[#0f0c38] via-[#181359] to-[#241970] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading NFTopia...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Optional: Hook to check if stores are ready
export const useStoresReady = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const isHydrated = usePreferencesStore((state) => state.isHydrated);

  useEffect(() => {
    if (isHydrated) {
      setIsInitialized(true);
    }
  }, [isHydrated]);

  return isInitialized && isHydrated;
};
